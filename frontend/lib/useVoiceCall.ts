"use client";
import { useCallback, useEffect, useReducer, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { sharedMic } from "./mic";
import { createLiveSocket, liveUrl, type LiveSocket } from "./liveSocket";
import { createAutoEnd, type AutoEnd } from "./autoEnd";
import { reduce, view, isTap, initialState, type VoiceState } from "./voiceMachine";
import { browserSpeak } from "./tts";
import { buildReceipt, saveReceipt, type CallCard } from "./storage";

interface WakeLockLike { release?: () => Promise<void> }

export function useVoiceCall(opts: { threadLen: number; onBeforeStart?: () => void; onExit?: () => void }) {
  const [state, dispatch] = useReducer(reduce, initialState);
  const [active, setActive] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [cards, setCards] = useState<CallCard[]>([]);
  const [note, setNote] = useState("");

  const desktopRef = useRef(false);
  const stateRef = useRef<VoiceState>(state);
  stateRef.current = state;

  const socket = useRef<LiveSocket | null>(null);
  const closingRef = useRef(false);
  const pushedRef = useRef(false);
  const wakeRef = useRef<WakeLockLike | null>(null);
  const pressT0 = useRef(0);
  const consumed = useRef(false);
  // Set when the caller barges into an in-flight answer; suppresses the model's
  // leftover audio until the server marks the turn boundary (interrupted / turn).
  const bargedRef = useRef(false);
  const meterRAF = useRef(0);
  const startedAt = useRef(0);
  const timerId = useRef<ReturnType<typeof setInterval> | null>(null);
  const talkRef = useRef<HTMLButtonElement | null>(null);
  const orbRef = useRef<HTMLDivElement | null>(null);
  const cardsRef = useRef<CallCard[]>([]);

  const endCallRef = useRef<(fromPop?: boolean) => void>(() => {});

  const autoEnd = useRef<AutoEnd | null>(null);
  if (autoEnd.current === null) {
    autoEnd.current = createAutoEnd({
      onEnd: () => { endTurnIO(); dispatch({ type: "HOLD" }); },
      onNoSpeech: () => { endTurnIO(); dispatch({ type: "SPEECH_TIMEOUT" }); },
    });
  }

  useEffect(() => { desktopRef.current = typeof matchMedia !== "undefined" && matchMedia("(hover: hover)").matches; }, []);

  // ---- level meter + latched auto-end sampling ----
  function setLvl(v: number) {
    const s = String(Math.min(1, v * 6).toFixed(2));
    talkRef.current?.style.setProperty("--lvl", s);
    orbRef.current?.style.setProperty("--lvl", s);
  }
  function clearLvl() {
    talkRef.current?.style.removeProperty("--lvl");
    orbRef.current?.style.removeProperty("--lvl");
  }
  const meter = useCallback(() => {
    const st = stateRef.current;
    if (st.phase !== "listening") { clearLvl(); return; }
    setLvl(sharedMic.level);
    if (st.latched) autoEnd.current?.sample(sharedMic.level, performance.now());
    meterRAF.current = requestAnimationFrame(meter);
  }, []);

  // ---- turn I/O ----
  function beginTurnIO() {
    const sock = socket.current;
    if (!sock || sock.readyState !== 1) return;
    sharedMic.flushOutput();
    sharedMic.capturing = true;
    sharedMic.sink = (f) => sock.sendPCM(f);
    sock.send({ type: "start" });
    autoEnd.current?.reset();
    navigator.vibrate?.(8);
    cancelAnimationFrame(meterRAF.current);
    meterRAF.current = requestAnimationFrame(meter);
  }
  function endTurnIO() {
    sharedMic.capturing = false;
    sharedMic.sink = null;
    socket.current?.send({ type: "end" });
    autoEnd.current?.reset();
    navigator.vibrate?.(8);
    cancelAnimationFrame(meterRAF.current);
    clearLvl();
  }

  // ---- socket ----
  const connect = useCallback(() => {
    closingRef.current = false;
    socket.current = createLiveSocket(liveUrl(process.env.NEXT_PUBLIC_LIVE_WS_URL, window.location), {
      onOpen: () => { /* status stays 'connecting' until 'ready' */ },
      onClose: () => { if (!closingRef.current) dispatch({ type: "SOCKET_CLOSED" }); },
      onAudio: (buf) => {
        // Barge-in: drop the model's audio while the caller holds to talk AND until the
        // server marks the turn boundary — otherwise the old answer's leftover frames
        // (still streaming from the server) resume playing the moment they release.
        if (sharedMic.capturing || bargedRef.current) return;
        dispatch({ type: "AUDIO" });
        sharedMic.play24k(buf);
      },
      onMessage: (m) => {
        switch (m.type) {
          case "ready": dispatch({ type: "READY" }); break;
          case "card": {
            const c: CallCard = { url: m.url, title: m.title, subtitle: m.subtitle };
            cardsRef.current = [...cardsRef.current, c];
            setCards(cardsRef.current);
            break;
          }
          case "interrupted": bargedRef.current = false; sharedMic.flushOutput(); break;
          case "turn": bargedRef.current = false; dispatch({ type: "TURN" }); break;
          case "guardrail":
            sharedMic.flushOutput();
            setNote(m.text);
            dispatch({ type: "GUARDRAIL" });
            try { browserSpeak(m.text); } catch { /* ignore */ }
            break;
          case "info": if (m.text === "call-time-limit") { dispatch({ type: "TIME_LIMIT" }); endCallRef.current(); } break;
          case "error": dispatch({ type: "ERROR", text: m.text }); break;
          // "user"/"bot" transcripts are intentionally ignored: the stage shows the orb.
        }
      },
    });
  }, []);

  async function requestWake() {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<WakeLockLike> } };
      wakeRef.current = (await nav.wakeLock?.request("screen")) ?? null;
    } catch { /* ignore */ }
  }

  // ---- entry / exit ----
  const startCall = useCallback(async () => {
    if (active) return;
    opts.onBeforeStart?.();
    cardsRef.current = [];
    bargedRef.current = false;
    setCards([]); setNote(""); setElapsed(0);
    dispatch({ type: "RESET" });
    setActive(true);
    pushedRef.current = true;
    try { window.history.pushState({ voice: true }, ""); } catch { /* ignore */ }
    void requestWake();
    const ok = await sharedMic.open();
    if (!ok) { dispatch({ type: "ERROR", text: sharedMic.errMessage() }); return; }
    startedAt.current = Date.now();
    if (timerId.current) clearInterval(timerId.current);
    timerId.current = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    connect();
  }, [active, connect, opts]);

  const endCall = useCallback((fromPop = false) => {
    if (!active && !fromPop) return;
    closingRef.current = true;
    endTurnIO();
    socket.current?.close();
    socket.current = null;
    sharedMic.close();
    void wakeRef.current?.release?.().catch(() => {});
    wakeRef.current = null;
    if (timerId.current) { clearInterval(timerId.current); timerId.current = null; }
    cancelAnimationFrame(meterRAF.current);
    const ms = startedAt.current ? Date.now() - startedAt.current : 0;
    const receipt = buildReceipt(opts.threadLen, ms, cardsRef.current);
    if (receipt) saveReceipt(receipt);
    if (pushedRef.current && !fromPop) { try { window.history.back(); } catch { /* ignore */ } }
    pushedRef.current = false;
    setActive(false);
    opts.onExit?.();
  }, [active, opts]);
  endCallRef.current = endCall;

  // ---- gesture ----
  const onPointerDown = useCallback((e: RPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const st = stateRef.current;
    if (st.phase === "dropped") { dispatch({ type: "RECONNECT" }); connect(); consumed.current = true; return; }
    if (st.phase === "listening" && st.latched) { endTurnIO(); dispatch({ type: "PRESS" }); consumed.current = true; return; }
    if (st.phase === "speaking") sharedMic.flushOutput();
    if (!(st.phase === "idle" || st.phase === "thinking" || st.phase === "guardrail" || st.phase === "speaking")) { consumed.current = true; return; }
    if (st.phase === "speaking" || st.phase === "thinking") bargedRef.current = true;
    dispatch({ type: "PRESS" });
    beginTurnIO();
    pressT0.current = performance.now();
    consumed.current = false;
  }, [connect]);

  const onPointerUp = useCallback((e: RPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (consumed.current) { consumed.current = false; return; }
    if (stateRef.current.phase !== "listening") return;
    if (isTap(pressT0.current, performance.now())) { dispatch({ type: "TAP" }); autoEnd.current?.reset(); }
    else { endTurnIO(); dispatch({ type: "HOLD" }); }
  }, []);

  const onPointerCancel = useCallback(() => {
    if (stateRef.current.phase === "listening" && !stateRef.current.latched) { endTurnIO(); dispatch({ type: "HOLD" }); }
  }, []);

  // ---- window-level listeners while the call is open ----
  useEffect(() => {
    if (!active) return;
    const typin = (t: EventTarget | null) => t instanceof HTMLElement && (t.tagName === "TEXTAREA" || t.tagName === "INPUT");
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Escape") { endCall(); return; }
      if (e.code !== "Space" || e.repeat || typin(e.target)) return;
      const st = stateRef.current;
      if (st.phase !== "idle" && st.phase !== "thinking" && st.phase !== "speaking" && st.phase !== "guardrail") return;
      e.preventDefault();
      if (st.phase === "speaking") sharedMic.flushOutput();
      if (st.phase === "speaking" || st.phase === "thinking") bargedRef.current = true;
      dispatch({ type: "PRESS" });
      beginTurnIO();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space" || typin(e.target)) return;
      e.preventDefault();
      if (stateRef.current.phase === "listening") { endTurnIO(); dispatch({ type: "HOLD" }); }
    };
    const onPop = () => endCall(true);
    const onBlur = () => { if (stateRef.current.phase === "listening" && !stateRef.current.latched) { endTurnIO(); dispatch({ type: "HOLD" }); } };
    const onVis = () => {
      if (document.visibilityState === "hidden") onBlur();
      else void requestWake();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("popstate", onPop);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [active, endCall]);

  const v = view(state, desktopRef.current);
  const hint = state.phase === "listening"
    ? (state.latched ? "Tap again, or just stop talking." : "Release to answer.")
    : "";

  return {
    active, view: v, elapsed, cards, note, hint,
    startCall, endCall: () => endCall(false),
    talkRef, orbRef, onPointerDown, onPointerUp, onPointerCancel,
  };
}

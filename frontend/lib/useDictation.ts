"use client";
import { useCallback, useRef, useState } from "react";
import { sharedMic } from "./mic";

const MIN_SAMPLES = 16000 * 0.3;

export function useDictation(onText: (t: string) => void) {
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const chunks = useRef<Int16Array[]>([]);
  const supported =
    typeof navigator !== "undefined" && !!navigator.mediaDevices && !!navigator.mediaDevices.getUserMedia;

  const toggle = useCallback(async () => {
    if (listening) {
      setListening(false);
      sharedMic.capturing = false;
      sharedMic.sink = null;
      const total = chunks.current.reduce((a, c) => a + c.length, 0);
      const pcm = new Int16Array(total);
      let o = 0;
      for (const c of chunks.current) { pcm.set(c, o); o += c.length; }
      chunks.current = [];
      if (pcm.length >= MIN_SAMPLES) {
        setProcessing(true);
        try {
          const res = await fetch("/api/stt", {
            method: "POST",
            headers: { "content-type": "application/octet-stream" },
            body: pcm.buffer as ArrayBuffer,
          });
          if (res.ok) {
            const t = ((await res.json()).text || "").trim();
            if (t) onText(t);
          }
        } catch { /* ignore; leave the box unchanged */ }
        setProcessing(false);
      }
      return;
    }
    const ok = await sharedMic.open();
    if (!ok) return;
    chunks.current = [];
    sharedMic.sink = (f) => chunks.current.push(f);
    sharedMic.capturing = true;
    setListening(true);
  }, [listening, onText]);

  return { supported, listening, processing, toggle };
}

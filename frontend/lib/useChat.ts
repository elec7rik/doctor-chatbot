"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { streamChat } from "./api";
import { renderMarkdown, stripDisclaimer, stripGuideTokens, extractGuideSlugs, esc, toSpeechText } from "./markdown";
import { loadHistory, saveHistory, loadSession, saveSession, clearChat } from "./storage";
import type { Turn } from "./schemas";

export interface ChatMessage {
  role: "user" | "bot";
  html: string;
  guideSlugs: string[];
}

function renderBot(full: string): { html: string; guideSlugs: string[] } {
  const clean = stripDisclaimer(stripGuideTokens(full));
  return { html: renderMarkdown(clean), guideSlugs: extractGuideSlugs(full) };
}

function userMessage(text: string): ChatMessage {
  return { role: "user", html: esc(text).replace(/\n/g, "<br>"), guideSlugs: [] };
}

export function useChat(opts?: { onReplyComplete?: (spokenText: string) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);
  const history = useRef<Turn[]>([]);
  const session = useRef<string | null>(null);
  // Hold the latest callback in a ref so `send` (memoised on [busy]) always
  // calls the current handler, even after the read-aloud toggle changes it.
  const onReplyComplete = useRef(opts?.onReplyComplete);
  onReplyComplete.current = opts?.onReplyComplete;

  useEffect(() => {
    history.current = loadHistory();
    session.current = loadSession();
    if (history.current.length) {
      setStarted(true);
      setMessages(
        history.current.map((t) =>
          t.role === "user"
            ? userMessage(t.text)
            : { role: "bot", ...renderBot(t.text) },
        ),
      );
    }
  }, []);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || busy) return;
      setStarted(true);
      setBusy(true);
      // Append the user bubble and an empty bot placeholder together. `busy`
      // serialises sends, so the bot placeholder is always the last message
      // for the duration of this call.
      setMessages((m) => [...m, userMessage(text), { role: "bot", html: "", guideSlugs: [] }]);
      const setBot = (html: string, guideSlugs: string[]) =>
        setMessages((m) => {
          const copy = m.slice();
          copy[copy.length - 1] = { role: "bot", html, guideSlugs };
          return copy;
        });

      const prior = history.current.slice(-16);
      try {
        const res = await streamChat(
          { message: text, session_id: session.current, history: prior },
          (full) => {
            const r = renderBot(full);
            setBot(r.html, r.guideSlugs);
          },
        );
        if (res.status === 429) {
          setBot("<p>The professor’s a bit swamped right now — give it a few seconds, then try again.</p>", []);
          return;
        }
        if (res.status === 413) {
          setBot("<p>That message is a bit long for me — try trimming it down.</p>", []);
          return;
        }
        if (res.sessionId) {
          session.current = res.sessionId;
          saveSession(res.sessionId);
        }
        const r = renderBot(res.full);
        setBot(r.html, r.guideSlugs);
        history.current = [...history.current, { role: "user", text }, { role: "model", text: res.full }];
        saveHistory(history.current);
        onReplyComplete.current?.(toSpeechText(res.full));
      } catch (err) {
        const msg = esc(String((err as Error).message || err));
        setBot(
          `<p>Sorry — I couldn’t reach the professor just now. Is the server running? <span style="color:var(--color-ink-3)">(${msg})</span></p>`,
          [],
        );
      } finally {
        setBusy(false);
      }
    },
    [busy],
  );

  const newChat = useCallback(() => {
    clearChat();
    history.current = [];
    session.current = null;
    setMessages([]);
    setStarted(false);
  }, []);

  return { messages, busy, started, send, newChat };
}

"use client";
import { useEffect, useRef, useState } from "react";
import { useChat } from "@/lib/useChat";
import { useReadAloud } from "@/lib/useReadAloud";
import { Header } from "./Header";
import { SideNav } from "./SideNav";
import { Disclaimer } from "./Disclaimer";
import { Welcome } from "./Welcome";
import { Message } from "./Message";
import { TypingDots } from "./TypingDots";
import { LinkCard } from "./LinkCard";
import { Composer } from "./Composer";

const GUIDE_TITLES: Record<string, string> = {
  "better-sleep": "How to Sleep Better, Naturally",
  "why-am-i-always-tired": "Why Am I Always Tired?",
  "what-supplements-to-take": "What Supplements Should You Actually Take?",
  skincare: "Skincare That Actually Works",
  "hair-loss": "Hair Loss and Hair Growth",
  testosterone: "Low Testosterone: Signs & What Helps",
  menopause: "Menopause & Perimenopause",
};

export function ChatShell() {
  const readAloud = useReadAloud();
  const { messages, busy, started, send, newChat } = useChat({ onReplyComplete: readAloud.speakReply });
  const [drawer, setDrawer] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div className="app">
      <SideNav open={drawer} onClose={() => setDrawer(false)} onNewChat={newChat} readAloud={readAloud} />
      <div className="main">
        <Header onMenu={() => setDrawer(true)} onNewChat={newChat} />
        <div className="scroll" ref={scrollRef}>
          <Disclaimer />
          <div className="thread">
            {!started && <Welcome onChip={send} />}
            {messages.map((m, i) =>
              m.role === "bot" && m.html === "" ? (
                <Message key={i} role="bot">
                  <TypingDots />
                </Message>
              ) : (
                <Message key={i} role={m.role} html={m.html} />
              ),
            )}
            {messages.flatMap((m, i) =>
              m.guideSlugs
                .filter((s) => GUIDE_TITLES[s])
                .map((s) => (
                  <div className="thread-cards" key={`${i}-${s}`}>
                    <LinkCard href={`/guides/${s}`} title={GUIDE_TITLES[s]!} subtitle="My Longevity Hub guide" />
                  </div>
                )),
            )}
          </div>
        </div>
        <Composer busy={busy} onSend={send} />
      </div>
    </div>
  );
}

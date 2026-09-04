"use client";
import { useEffect, useRef, useState } from "react";
import { useChat } from "@/lib/useChat";
import { useReadAloud } from "@/lib/useReadAloud";
import { useVoiceCall } from "@/lib/useVoiceCall";
import { loadReceipts, type CallReceipt as Receipt } from "@/lib/storage";
import { Header } from "./Header";
import { SideNav } from "./SideNav";
import { Disclaimer } from "./Disclaimer";
import { Welcome } from "./Welcome";
import { Message } from "./Message";
import { TypingDots } from "./TypingDots";
import { LinkCard } from "./LinkCard";
import { Composer } from "./Composer";
import { VoiceStage } from "./VoiceStage";
import { CallReceipt } from "./CallReceipt";
import { guideTitle } from "@/content/guides/catalog";


export function ChatShell() {
  const readAloud = useReadAloud();
  const { messages, busy, started, send, newChat } = useChat({ onReplyComplete: readAloud.speakReply });
  const [drawer, setDrawer] = useState(false);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setReceipts(loadReceipts()); }, []);

  const voice = useVoiceCall({
    threadLen: messages.length,
    onBeforeStart: readAloud.stop,
    onExit: () => setReceipts(loadReceipts()),
  });

  const startNewChat = () => { newChat(); setReceipts([]); };

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, receipts]);

  return (
    <div className="app">
      <SideNav open={drawer} onClose={() => setDrawer(false)} onNewChat={startNewChat} onCall={voice.startCall} readAloud={readAloud} />
      <div className="main">
        <Header onMenu={() => setDrawer(true)} onNewChat={startNewChat} />
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
                .filter((s) => guideTitle(s))
                .map((s) => (
                  <div className="thread-cards" key={`${i}-${s}`}>
                    <LinkCard href={`/guides/${s}`} title={guideTitle(s)!} subtitle="My Longevity Hub guide" />
                  </div>
                )),
            )}
            {receipts.map((r, i) => (
              <CallReceipt key={`r-${r.ts}-${i}`} receipt={r} />
            ))}
          </div>
        </div>
        <Composer busy={busy} onSend={send} onCall={voice.startCall} />
      </div>
      {voice.active && (
        <VoiceStage
          view={voice.view}
          elapsed={voice.elapsed}
          cards={voice.cards}
          note={voice.note}
          hint={voice.hint}
          talkRef={voice.talkRef}
          orbRef={voice.orbRef}
          onClose={voice.endCall}
          onPointerDown={voice.onPointerDown}
          onPointerUp={voice.onPointerUp}
          onPointerCancel={voice.onPointerCancel}
        />
      )}
    </div>
  );
}

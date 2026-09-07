"use client";
import { Fragment, useEffect, useRef, useState } from "react";
import { useChat } from "@/lib/useChat";
import { useReadAloud } from "@/lib/useReadAloud";
import { useVoiceCall } from "@/lib/useVoiceCall";
import { Header } from "./Header";
import { SideNav } from "./SideNav";
import { Disclaimer } from "./Disclaimer";
import { Welcome } from "./Welcome";
import { Message } from "./Message";
import { TypingDots } from "./TypingDots";
import { LinkCard } from "./LinkCard";
import { Composer } from "./Composer";
import { VoiceStage } from "./VoiceStage";
import { guideTitle } from "@/content/guides/catalog";


export function ChatShell() {
  const readAloud = useReadAloud();
  const { messages, busy, started, send, newChat } = useChat({ onReplyComplete: readAloud.speakReply });
  const [drawer, setDrawer] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const voice = useVoiceCall({
    threadLen: messages.length,
    onBeforeStart: readAloud.stop,
  });

  const startNewChat = () => { newChat(); };

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div className="app">
      <SideNav open={drawer} onClose={() => setDrawer(false)} onNewChat={startNewChat} onCall={voice.startCall} readAloud={readAloud} />
      <div className="main">
        <Header onMenu={() => setDrawer(true)} onNewChat={startNewChat} />
        <div className="scroll" ref={scrollRef}>
          <Disclaimer />
          <div className="thread">
            {!started && <Welcome onChip={send} />}
            {messages.map((m, i) => (
              <Fragment key={i}>
                {m.role === "bot" && m.html === "" ? (
                  <Message role="bot">
                    <TypingDots />
                  </Message>
                ) : (
                  <Message role={m.role} html={m.html} />
                )}
                {m.guideSlugs
                  .filter((s) => guideTitle(s))
                  .map((s) => (
                    <div className="thread-cards" key={`${i}-${s}`}>
                      <LinkCard href={`/guides/${s}`} title={guideTitle(s)!} subtitle="My Longevity Hub guide" />
                    </div>
                  ))}
              </Fragment>
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

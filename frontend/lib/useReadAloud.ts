"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createSpeaker, type Speaker } from "./tts";
import { loadReadAloud, saveReadAloud } from "./storage";

export function useReadAloud() {
  const [on, setOn] = useState(false);
  const speaker = useRef<Speaker | null>(null);
  if (speaker.current === null) speaker.current = createSpeaker();

  useEffect(() => { setOn(loadReadAloud()); }, []);
  useEffect(() => () => speaker.current?.stop(), []);

  const toggle = useCallback(() => {
    setOn((prev) => {
      const next = !prev;
      saveReadAloud(next);
      if (!next) speaker.current?.stop();
      return next;
    });
  }, []);

  const speakReply = useCallback((text: string) => {
    if (on) speaker.current?.speak(text);
  }, [on]);

  return { on, toggle, speakReply };
}

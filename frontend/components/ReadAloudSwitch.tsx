"use client";
import { useEffect, useState } from "react";

export function ReadAloudSwitch() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    try {
      setOn(localStorage.getItem("np-readaloud") === "1");
    } catch {
      /* ignore */
    }
  }, []);

  function toggle() {
    const next = !on;
    setOn(next);
    try {
      localStorage.setItem("np-readaloud", next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  return (
    <button type="button" role="switch" aria-checked={on} onClick={toggle} className="switch-row">
      <span>Read answers aloud</span>
      <span className={"switch" + (on ? " on" : "")} aria-hidden="true">
        <span className="knob" />
      </span>
    </button>
  );
}

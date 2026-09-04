"use client";
export function ReadAloudSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={onChange} className="switch-row">
      <span>Read answers aloud</span>
      <span className={"switch" + (checked ? " on" : "")} aria-hidden="true">
        <span className="knob" />
      </span>
    </button>
  );
}

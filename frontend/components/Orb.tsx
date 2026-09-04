import clsx from "clsx";

export function Orb({
  state,
  className,
}: {
  state?: "idle" | "listening" | "thinking" | "speaking";
  className?: string;
}) {
  return (
    <div className={clsx("orb", state, className)} aria-hidden="true">
      <span className="orb-glow" />
      <span className="orb-ring" />
      <span className="orb-core" />
    </div>
  );
}

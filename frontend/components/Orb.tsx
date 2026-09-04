import clsx from "clsx";

export function Orb({
  state,
  desaturated,
  frozen,
  className,
  refEl,
}: {
  state?: "idle" | "listening" | "thinking" | "speaking";
  desaturated?: boolean;
  frozen?: boolean;
  className?: string;
  refEl?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={refEl}
      className={clsx("orb", state, desaturated && "orb-desat", frozen && "orb-frozen", className)}
      aria-hidden="true"
    >
      <span className="orb-glow" />
      <span className="orb-ring" />
      <span className="orb-core" />
    </div>
  );
}

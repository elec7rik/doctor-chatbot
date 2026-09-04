import clsx from "clsx";

export function Message({
  role,
  html,
  children,
}: {
  role: "user" | "bot";
  html?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={clsx("msg", role)}>
      <div className="b">
        {html !== undefined ? <div dangerouslySetInnerHTML={{ __html: html }} /> : children}
      </div>
    </div>
  );
}

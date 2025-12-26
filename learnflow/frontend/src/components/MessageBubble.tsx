import type { ReactNode } from "react";

export type MessageRole = "user" | "assistant" | "system";

export function MessageBubble({
  role,
  children
}: {
  role: MessageRole;
  children: ReactNode;
}) {
  const isUser = role === "user";

  return (
    <div className={"flex " + (isUser ? "justify-end" : "justify-start")}>
      <div
        className={
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-soft " +
          (isUser ? "bg-blue-600 text-white" : "bg-white text-slate-900")
        }
      >
        {children}
      </div>
    </div>
  );
}

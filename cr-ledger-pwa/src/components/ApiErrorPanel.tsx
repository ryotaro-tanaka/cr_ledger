import React from "react";

export default function ApiErrorPanel({ title, detail }: { title?: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-red-900/40 bg-red-950/30 p-4">
      <div className="text-sm font-semibold text-red-200">{title ?? "Error"}</div>
      <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-red-200/80">
        {detail}
      </pre>
    </div>
  );
}

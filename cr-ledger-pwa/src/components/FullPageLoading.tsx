import React from "react";

export default function FullPageLoading({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="flex items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-900/40 px-4 py-3">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-transparent" />
        <div className="text-sm text-neutral-200">{label ?? "Loading..."}</div>
      </div>
    </div>
  );
}

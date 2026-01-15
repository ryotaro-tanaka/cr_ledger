export default function ApiErrorPanel({ title, detail }: { title?: string; detail: string }) {
  return (
    <div className="rounded-[22px] border border-red-200 bg-red-50/80 p-4 shadow-sm backdrop-blur">
      <div className="text-sm font-semibold text-red-800">{title ?? "Error"}</div>
      <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-red-900/80">
        {detail}
      </pre>
    </div>
  );
}

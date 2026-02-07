export default function FullPageLoading({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="flex items-center gap-3 rounded-[22px] border border-slate-200 bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-transparent" />
        <div className="text-sm font-medium text-slate-700">{label ?? "Loading..."}</div>
      </div>
    </div>
  );
}

import { useMemo, useState } from "react";

type Metric = { label: string; value: string; strong?: boolean };

function cx(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

export default function CardRow(props: {
  iconUrl?: string | null;
  title: string;
  subtitle?: string;
  metrics: Metric[];
  expanded?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const metricView = useMemo(() => {
    return props.metrics.slice(0, 3).map((m) => (
      <div key={m.label} className="text-right">
        <div className="text-[10px] font-medium text-slate-500">{m.label}</div>
        <div className={cx("text-xs", m.strong ? "font-semibold text-slate-900" : "text-slate-700")}>
          {m.value}
        </div>
      </div>
    ));
  }, [props.metrics]);

  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className={cx(
        "w-full select-none text-left",
        "rounded-[22px] border border-slate-200 bg-white/80 shadow-sm backdrop-blur",
        "px-3.5 py-3.5",
        "transition hover:bg-white active:scale-[0.995]"
      )}
    >
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {props.iconUrl ? (
            <img src={props.iconUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] font-medium text-slate-400">
              no img
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-slate-900">{props.title}</div>
          {props.subtitle ? <div className="mt-0.5 truncate text-xs text-slate-500">{props.subtitle}</div> : null}
        </div>

        <div className="flex items-center gap-3">{metricView}</div>
      </div>

      {open && props.expanded ? (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white/70 p-3">
          {props.expanded}
        </div>
      ) : null}
    </button>
  );
}

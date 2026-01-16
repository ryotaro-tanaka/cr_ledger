import { useMemo, useState } from "react";
import { cx } from "../lib/cx";

type Metric = { label: string; value: string; strong?: boolean };

export default function CardRow(props: {
  iconUrl?: string | null;
  title: string;
  subtitle?: string;
  metrics: Metric[];
  expanded?: React.ReactNode;

  badge?: string;
  tone?: "default" | "warn";
}) {
  const expandable = !!props.expanded;
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

  const baseCardClass = cx(
    "w-full select-none text-left",
    "rounded-[22px] border shadow-sm backdrop-blur",
    "px-3.5 py-3.5",
    "transition",
    props.tone === "warn"
      ? "border-amber-200 bg-amber-50/70 hover:bg-amber-50"
      : "border-slate-200 bg-white/80 hover:bg-white"
  );

  const header = (
    <>
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
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{props.title}</div>

            {props.badge ? (
              <div className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                {props.badge}
              </div>
            ) : null}
          </div>

          {props.subtitle ? <div className="mt-0.5 truncate text-xs text-slate-500">{props.subtitle}</div> : null}
        </div>

        <div className="flex items-center gap-3">{metricView}</div>

        {expandable ? (
          <div className="ml-1 shrink-0 text-slate-400">
            <span className={cx("inline-block text-[14px] transition", open ? "rotate-180" : "")}>⌄</span>
          </div>
        ) : null}
      </div>

      {expandable && open ? (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white/70 p-3">{props.expanded}</div>
      ) : null}
    </>
  );

  if (!expandable) {
    return <div className={baseCardClass}>{header}</div>;
  }

  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className={cx(baseCardClass, "active:scale-[0.995]")}
    >
      {header}
    </button>
  );
}

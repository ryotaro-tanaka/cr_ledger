import React, { useMemo, useState } from "react";

type Metric = { label: string; value: string; strong?: boolean };

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
        <div className="text-[10px] text-neutral-500">{m.label}</div>
        <div className={["text-xs", m.strong ? "font-semibold text-neutral-100" : "text-neutral-200"].join(" ")}>
          {m.value}
        </div>
      </div>
    ));
  }, [props.metrics]);

  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className="w-full rounded-2xl border border-neutral-800 bg-neutral-950 px-3 py-3 text-left hover:bg-neutral-900"
    >
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/40">
          {props.iconUrl ? (
            <img
              src={props.iconUrl}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-neutral-500">
              no img
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-neutral-100">{props.title}</div>
          {props.subtitle ? (
            <div className="mt-0.5 truncate text-xs text-neutral-400">{props.subtitle}</div>
          ) : null}
        </div>

        <div className="flex items-center gap-3">{metricView}</div>
      </div>

      {open && props.expanded ? (
        <div className="mt-3 rounded-xl border border-neutral-800 bg-neutral-900/40 p-3">
          {props.expanded}
        </div>
      ) : null}
    </button>
  );
}

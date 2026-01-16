import type { ReactNode } from "react";
import ApiErrorPanel from "../../components/ApiErrorPanel";
import { useCardMaster } from "../../cards/useCardMaster";

function cx(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur">
      {children}
    </div>
  );
}

export default function CardsRefresh() {
  const { refresh, loading, error } = useCardMaster();

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">Cards</div>
          <div className="mt-1 text-xs text-slate-600">Refresh cards cache when names/icons look outdated.</div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          disabled={loading}
          onClick={() => void refresh()}
          className={cx(
            "rounded-xl px-3 py-2 text-sm font-semibold shadow-sm transition active:scale-[0.99]",
            loading ? "bg-slate-200 text-slate-500" : "bg-blue-600 text-white hover:bg-blue-700"
          )}
        >
          {loading ? "Refreshing..." : "Refresh cards (nocache=1)"}
        </button>
      </div>

      {error ? (
        <div className="mt-3">
          <ApiErrorPanel title="Cards refresh error" detail={error} />
        </div>
      ) : null}
    </Card>
  );
}

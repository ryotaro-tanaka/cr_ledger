import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import SectionCard from "../../components/SectionCard";
import ApiErrorPanel from "../../components/ApiErrorPanel";
import { cx } from "../../lib/cx";
import { useCardMaster } from "../../cards/useCardMaster";
import type { Thumb } from "./thumbs";

type PreviewCardProps<T> = {
    title: string;
    openTo: string;
    last: number;

    needsDeck?: boolean;
    emptyText: string;
    noDeckText?: string;

    load: () => Promise<T>;
    toThumbs: (data: T) => Thumb[];
};

export default function PreviewCard<T>({
    title,
    openTo,
    last,
    needsDeck,
    emptyText,
    noDeckText,
    load,
    toThumbs,
}: PreviewCardProps<T>) {
    const nav = useNavigate();
    const { master, loading: cardsLoading } = useCardMaster();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<T | null>(null);

    useEffect(() => {
    let cancelled = false;

    void (async () => {
        setLoading(true);
        setError(null);
        try {
        const res = await load();
        if (!cancelled) setData(res);
        } catch (e) {
        if (!cancelled) setError(String(e));
        } finally {
        if (!cancelled) setLoading(false);
        }
    })();

    return () => {
        cancelled = true;
    };
    }, [load]);

    const thumbs = useMemo(() => {
        if (!data) return [];
        return toThumbs(data);
    }, [data, toThumbs]);

    return (
    <SectionCard>
        <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <button
            onClick={() => nav(openTo)}
            className="text-xs font-medium text-blue-700 hover:text-blue-800"
        >
            Open →
        </button>
        </div>

        <div className="mt-2 text-xs text-slate-500">last={last} · top 5 cards</div>

        {error ? (
        <div className="mt-3">
            <ApiErrorPanel detail={error} />
        </div>
        ) : null}

        {needsDeck && !data && noDeckText ? (
        <div className="mt-3 text-sm text-slate-600">{noDeckText}</div>
        ) : null}

        <div className="mt-3">
        {loading || cardsLoading ? (
            <div className="text-sm text-slate-500">Loading...</div>
        ) : thumbs.length === 0 ? (
            <div className="text-sm text-slate-600">{emptyText}</div>
        ) : (
            <div className="flex gap-3 overflow-x-auto pb-1">
            {thumbs.map((c) => {
                const name = master?.getName(c.card_id) ?? `#${c.card_id}`;
                const icon = master?.getIconUrl(c.card_id, c.slot_kind) ?? null;

                return (
                <div key={`${c.card_id}:${c.slot_kind}`} className="shrink-0">
                    <div
                    className={cx(
                        "h-14 w-14 rounded-2xl border border-slate-200 bg-white shadow-sm"
                    )}
                    >
                    {icon ? (
                        <img
                        src={icon}
                        alt={name}
                        className="h-full w-full rounded-2xl object-cover"
                        loading="lazy"
                        />
                    ) : (
                        <div className="grid h-full w-full place-items-center text-[10px] text-slate-500">
                        #{c.card_id}
                        </div>
                    )}
                    </div>
                </div>
                );
            })}
            </div>
        )}
        </div>
    </SectionCard>
    );
}

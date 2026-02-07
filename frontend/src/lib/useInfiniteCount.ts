import { useEffect, useMemo, useRef, useState } from "react";

export function useInfiniteCount(opts: { total: number; initial?: number; step?: number }) {
  const initial = opts.initial ?? 15;
  const step = opts.step ?? 15;

  const [count, setCount] = useState(() => Math.min(initial, opts.total));
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // totalが変わったら表示数も安全に補正
  useEffect(() => {
    setCount((c) => Math.min(Math.max(initial, c), opts.total));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.total]);

  const hasMore = count < opts.total;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const ent of entries) {
          if (!ent.isIntersecting) continue;
          setCount((c) => Math.min(opts.total, c + step));
        }
      },
      { root: null, rootMargin: "200px", threshold: 0 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, opts.total, step]);

  const reset = useMemo(() => () => setCount(Math.min(initial, opts.total)), [initial, opts.total]);

  return { count, hasMore, sentinelRef, reset };
}

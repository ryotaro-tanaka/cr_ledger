import type { ReactNode } from "react";
import { cx } from "../lib/cx";

export default function SectionCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-[22px] border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur",
        className
      )}
    >
      {children}
    </div>
  );
}

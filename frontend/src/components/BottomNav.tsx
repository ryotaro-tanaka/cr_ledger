import React from "react";
import { NavLink } from "react-router-dom";

type Item = { to: string; label: string; icon: React.ReactNode };

function cx(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

export default function BottomNav() {
  const items: Item[] = [
    { to: "/", label: "Overview", icon: <span className="text-[18px] leading-none">🏠</span> },
    { to: "/improve", label: "Improve", icon: <span className="text-[18px] leading-none">🛠</span> },
    { to: "/settings", label: "Settings", icon: <span className="text-[18px] leading-none">⚙️</span> },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50"
      style={{ paddingBottom: "var(--safe-bottom)" }}
    >
      {/* full width bar */}
      <div className="border-t border-slate-200 bg-white/90 backdrop-blur py-4">
        <div className="mx-auto max-w-md">
          <div className="grid grid-cols-3">
            {items.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                className={({ isActive }) =>
                  cx(
                    "relative flex flex-col items-center justify-center py-2",
                    "text-[11px] font-medium",
                    "transition-colors",
                    isActive ? "text-blue-700" : "text-slate-500 hover:text-slate-700"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {/* subtle active indicator */}
                    <div
                      className={cx(
                        "absolute left-1/2 top-0 h-[3px] w-10 -translate-x-1/2 rounded-b-full",
                        isActive ? "bg-blue-600/60" : "bg-transparent"
                      )}
                    />
                    <div
                      className={cx(
                        "grid place-items-center",
                        isActive ? "text-blue-700" : "text-slate-500"
                      )}
                    >
                      {it.icon}
                    </div>
                    <div className="mt-1 leading-none">{it.label}</div>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}

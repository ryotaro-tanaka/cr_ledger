import React from "react";
import { NavLink } from "react-router-dom";

type Item = {
  to: string;
  label: string;
  icon: (active: boolean) => React.ReactNode;
};

function cls(active: boolean) {
  return active
    ? "text-white"
    : "text-neutral-400 hover:text-neutral-200";
}

const items: Item[] = [
  {
    to: "/",
    label: "Home",
    icon: (active) => (
      <span className={active ? "opacity-100" : "opacity-70"}>⌂</span>
    ),
  },
  {
    to: "/decks",
    label: "Decks",
    icon: (active) => (
      <span className={active ? "opacity-100" : "opacity-70"}>🃏</span>
    ),
  },
  {
    to: "/trend",
    label: "Trend",
    icon: (active) => (
      <span className={active ? "opacity-100" : "opacity-70"}>📈</span>
    ),
  },
  {
    to: "/settings",
    label: "Settings",
    icon: (active) => (
      <span className={active ? "opacity-100" : "opacity-70"}>⚙</span>
    ),
  },
];

export default function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-neutral-800 bg-neutral-950/90 backdrop-blur">
      <div className="mx-auto max-w-md px-2 pb-[env(safe-area-inset-bottom)]">
        <div className="flex h-16 items-center justify-between">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              className={({ isActive }) =>
                [
                  "flex w-full flex-col items-center justify-center gap-1 rounded-xl py-2",
                  isActive ? "bg-neutral-900/60" : "bg-transparent",
                ].join(" ")
              }
              end={it.to === "/"}
            >
              {({ isActive }) => (
                <>
                  <div className={cls(isActive)}>{it.icon(isActive)}</div>
                  <div
                    className={[
                      "text-[11px] leading-none",
                      cls(isActive),
                    ].join(" ")}
                  >
                    {it.label}
                  </div>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}

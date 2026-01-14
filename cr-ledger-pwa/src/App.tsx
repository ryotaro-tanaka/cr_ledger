import React from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import BottomNav from "./components/BottomNav";
import HomePage from "./pages/HomePage";
import DecksPage from "./pages/DecksPage";
import DeckDetailPage from "./pages/DeckDetailPage";
import TrendPage from "./pages/TrendPage";
import SettingsPage from "./pages/SettingsPage";
import { usePlayer } from "./lib/player";

function RequirePlayer({ children }: { children: React.ReactNode }) {
  const { player } = usePlayer();
  const loc = useLocation();

  if (!player) {
    return <Navigate to="/settings" replace state={{ from: loc.pathname }} />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-50">
      <header className="sticky top-0 z-40 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
          <div className="font-semibold tracking-tight">CR Ledger</div>
          <div className="text-xs text-neutral-400">PWA</div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pb-24 pt-4">
        <Routes>
          <Route
            path="/"
            element={
              <RequirePlayer>
                <HomePage />
              </RequirePlayer>
            }
          />

          <Route
            path="/decks"
            element={
              <RequirePlayer>
                <DecksPage />
              </RequirePlayer>
            }
          />
          <Route
            path="/decks/:deckKey"
            element={
              <RequirePlayer>
                <DeckDetailPage />
              </RequirePlayer>
            }
          />

          <Route
            path="/trend"
            element={
              <RequirePlayer>
                <TrendPage />
              </RequirePlayer>
            }
          />

          <Route path="/settings" element={<SettingsPage />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <BottomNav />
    </div>
  );
}

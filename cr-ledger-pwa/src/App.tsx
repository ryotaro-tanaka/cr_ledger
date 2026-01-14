import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import BottomNav from "./components/BottomNav";
import HomePage from "./pages/HomePage";
import DecksPage from "./pages/DecksPage";
import DeckDetailPage from "./pages/DeckDetailPage";
import TrendPage from "./pages/TrendPage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-50">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
          <div className="font-semibold tracking-tight">CR Ledger</div>
          <div className="text-xs text-neutral-400">PWA</div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-md px-4 pb-24 pt-4">
        <Routes>
          <Route path="/" element={<HomePage />} />

          <Route path="/decks" element={<DecksPage />} />
          <Route path="/decks/:deckKey" element={<DeckDetailPage />} />

          <Route path="/trend" element={<TrendPage />} />
          <Route path="/settings" element={<SettingsPage />} />

          {/* fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Bottom navigation (fixed) */}
      <BottomNav />
    </div>
  );
}

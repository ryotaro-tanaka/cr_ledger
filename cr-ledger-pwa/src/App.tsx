import React from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import BottomNav from "./components/BottomNav";
import HomePage from "./pages/HomePage";
import PriorityPage from "./pages/PriorityPage";
import MatchupPage from "./pages/MatchupPage";
import TrendPage from "./pages/TrendPage";
import SettingsPage from "./pages/SettingsPage";
import { useSelection } from "./lib/selection";

function RequireSelection({ children }: { children: React.ReactNode }) {
  const { player, deckKey } = useSelection();
  const loc = useLocation();

  if (!player || !deckKey) {
    return <Navigate to="/settings" replace state={{ from: loc.pathname }} />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <div className="min-h-dvh text-neutral-50">
      <main className="mx-auto max-w-md px-4 pb-24 pt-4">
        <Routes>
          <Route
            path="/"
            element={
              <RequireSelection>
                <HomePage />
              </RequireSelection>
            }
          />
          <Route
            path="/priority"
            element={
              <RequireSelection>
                <PriorityPage />
              </RequireSelection>
            }
          />
          <Route
            path="/matchup"
            element={
              <RequireSelection>
                <MatchupPage />
              </RequireSelection>
            }
          />
          <Route
            path="/trend"
            element={
              <RequireSelection>
                <TrendPage />
              </RequireSelection>
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

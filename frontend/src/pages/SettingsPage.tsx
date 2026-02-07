import InstallGuide from "./settings/InstallGuide";
import Selected from "./settings/Selected";
import Players from "./settings/Players";
import Decks from "./settings/Decks";
import CardsRefresh from "./settings/CardsRefresh";

function isStandalonePWA(): boolean {
  const mql = window.matchMedia?.("(display-mode: standalone)");
  const displayModeStandalone = !!mql?.matches;

  const nav = window.navigator as Navigator & { standalone?: boolean };
  const iosStandalone = nav.standalone === true;

  return displayModeStandalone || iosStandalone;
}

export default function SettingsPage() {
  const standalone = isStandalonePWA();

  return (
    <section className="mx-auto max-w-md space-y-4 px-4 pt-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">Settings</h1>
          {/* <div className="mt-1 text-xs text-slate-500">ready.</div> */}
        </div>
        <div className="text-[11px] text-slate-500">standalone: {String(standalone)}</div>
      </div>

      <InstallGuide />
      <Selected />
      <Players />
      <Decks />
      <CardsRefresh />
    </section>
  );
}

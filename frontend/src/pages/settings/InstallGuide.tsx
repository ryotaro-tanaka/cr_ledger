import { useMemo } from "react";
import SectionCard from "../../components/SectionCard";

function isStandalonePWA(): boolean {
  const mql = window.matchMedia?.("(display-mode: standalone)");
  const displayModeStandalone = !!mql?.matches;

  // iOS Safari legacy: navigator.standalone
  const nav = window.navigator as Navigator & { standalone?: boolean };
  const iosStandalone = nav.standalone === true;

  return displayModeStandalone || iosStandalone;
}

type InstallHint = { title: string; steps: string[]; note: string };

function getInstallHint(): InstallHint {
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);

  if (isIOS) {
    return {
      title: "Install on iPhone (Safari)",
      steps: [
        "Open this site in Safari.",
        "Tap the Share button (square with arrow).",
        'Tap "Add to Home Screen".',
        'Enable "Open as Web App" (if the toggle is shown).',
        "Launch from the Home Screen icon.",
      ],
      note: "If you see the URL bar inside the installed app, you may be opening an old icon or a different domain.",
    };
  }

  if (isAndroid) {
    return {
      title: "Install on Android (Chrome)",
      steps: [
        "Open this site in Chrome.",
        "Tap the ︙ menu.",
        'Tap "Install app" or "Add to Home screen".',
        "Launch from the installed icon.",
      ],
      note: "If the install option doesn’t appear, the site may be missing PWA files (manifest/service worker) or you’re not on HTTPS.",
    };
  }

  return {
    title: "Install as PWA",
    steps: [
      "Use Chrome on Android or Safari on iPhone.",
      "Look for “Install app” / “Add to Home screen”.",
      "Launch from the installed icon.",
    ],
    note: "Desktop browsers may show different UI.",
  };
}

export default function InstallGuide() {
  const standalone = isStandalonePWA();
  const installHint = useMemo(() => getInstallHint(), []);

  if (standalone) return null;

  return (
    <SectionCard>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">{installHint.title}</div>
          <div className="mt-1 text-xs text-slate-600">
            Install to remove the URL bar and use the app like a native screen.
          </div>
        </div>
        <div className="shrink-0 rounded-full bg-blue-600/10 px-2 py-1 text-[11px] font-semibold text-blue-700">
          PWA
        </div>
      </div>

      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-800">
        {installHint.steps.map((s, i) => (
          <li key={i} className="leading-6">
            {s}
          </li>
        ))}
      </ol>

      <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-slate-800">
        <span className="font-semibold text-blue-800">iPhone note:</span>{" "}
        When adding to Home Screen, make sure <span className="font-semibold">“Open as Web App”</span> is enabled.
      </div>

      <div className="mt-3 text-xs text-slate-600">Note: {installHint.note}</div>
    </SectionCard>
  );
}

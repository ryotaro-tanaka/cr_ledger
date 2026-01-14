import React from "react";
import { Link } from "react-router-dom";

export default function DecksPage() {
  const dummyDeckKey =
    "26000010:normal|26000014:hero|26000058:evolution|26000084:normal|...";

  return (
    <section className="space-y-3">
      <h1 className="text-xl font-semibold">Decks</h1>

      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4">
        <div className="text-sm text-neutral-300">
          Deck list will be here.
        </div>

        <div className="mt-3">
          <Link
            to={`/decks/${encodeURIComponent(dummyDeckKey)}`}
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 hover:bg-neutral-900"
          >
            Open dummy deck detail →
          </Link>
        </div>
      </div>
    </section>
  );
}

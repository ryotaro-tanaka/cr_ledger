import { useEffect, useState } from "react";
import { getMyDeckCards } from "../../../api/api";
import type { MyDeckCardsResponse } from "../../../api/types";
import { toErrorText } from "../../../lib/errors";

export function useDeckCardsCache(decks: Array<{ my_deck_key: string }> | undefined) {
	const [deckCardsMap, setDeckCardsMap] = useState<Record<string, MyDeckCardsResponse["cards"]>>({});
	const [deckCardsErrMap, setDeckCardsErrMap] = useState<Record<string, string>>({});

	useEffect(() => {
		if (!decks || decks.length === 0) return;

		let cancelled = false;

		void (async () => {
			const targets = decks
				.map((d) => d.my_deck_key)
				.filter((k) => !(k in deckCardsMap) && !(k in deckCardsErrMap));

			if (targets.length === 0) return;

			// burst回避（必要なら調整）
			const limited = targets.slice(0, 30);

			await Promise.all(
				limited.map(async (k) => {
					try {
						const res = await getMyDeckCards(k);
						const sorted = [...res.cards].sort((a, b) => a.slot - b.slot);

						if (cancelled) return;
						setDeckCardsMap((prev) => ({ ...prev, [k]: sorted }));
					} catch (e) {
						if (cancelled) return;
						setDeckCardsErrMap((prev) => ({ ...prev, [k]: toErrorText(e) }));
					}
				})
			);
		})();

		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [decks]);

	const reset = () => {
		setDeckCardsMap({});
		setDeckCardsErrMap({});
	};

	return { deckCardsMap, deckCardsErrMap, reset };
}

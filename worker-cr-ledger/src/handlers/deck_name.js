export function normalizeDeckNameAllowClear(v) {
  // undefined/null はエラーにしたいならここで分ける
  if (v === undefined) return { ok: false, error: "deck_name required" };

  const s = (v ?? "").toString().trim();

  // 空なら「クリア」扱いで NULL
  if (s === "") return { ok: true, value: null };

  // 長さ制限（好みで）
  if (s.length > 40) return { ok: false, error: "deck_name too long (max 40)" };

  return { ok: true, value: s };
}

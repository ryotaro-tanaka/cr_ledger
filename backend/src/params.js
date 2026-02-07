import { normalizeTagForApi, normalizeTagForDb } from "./domain.js";

export function requirePlayerTagDb(url) {
  const p = (url.searchParams.get("player_tag") || "").trim().toUpperCase();
  if (!p) throw new Error("player_tag required");
  // DBは #なしで持つ想定なので、#が来ても許容して外す
  return normalizeTagForDb(p);
}

export function requirePlayerTagApi(url) {
  const p = (url.searchParams.get("player_tag") || "").trim().toUpperCase();
  if (!p) throw new Error("player_tag required");
  return normalizeTagForApi(p);
}

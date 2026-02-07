const CR_PROXY = "https://proxy.royaleapi.dev";

/**
 * RoyaleAPI proxy 経由で Clash Royale API を呼び出し、JSONを返す。
 * - env.CR_API_TOKEN が必要
 * - 失敗時は例外を投げる（呼び出し側で catch）
 */
export async function crJson(path, env) {
  const res = await fetch(`${CR_PROXY}${path}`, {
    headers: { Authorization: `Bearer ${env.CR_API_TOKEN}` },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Upstream ${res.status}: ${text}`);
  return JSON.parse(text);
}

export async function crCards(env) {
  return crJson("/v1/cards", env);
}

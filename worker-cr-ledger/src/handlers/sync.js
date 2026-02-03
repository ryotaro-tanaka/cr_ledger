import { json } from "../http.js";
import { requirePlayerTagApi } from "../params.js";
import { syncCore } from "../sync.js";

export async function handleSyncHttp(env, url) {
  const tagApi = requirePlayerTagApi(url);
  const out = await syncCore(env, tagApi);
  if (!out.ok) return json(out, 400);
  return json(out, 200);
}

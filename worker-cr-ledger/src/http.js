// http.js
// HTTP周りの雑務（CORS / auth / json / router / errors）をここに集約

export function normalizePathname(pathname) {
	if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
	return pathname;
}

export function json(obj, status = 200, extraHeaders = {}) {
	return new Response(JSON.stringify(obj), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
			...extraHeaders,
		},
	});
}

export function clampInt(v, min, max, fallback) {
	const n = Number(v);
	if (!Number.isFinite(n)) return fallback;
	return Math.min(max, Math.max(min, Math.trunc(n)));
}

/** ---------- CORS ---------- */

export function makeCorsHeaders(req, env) {
	// 個人用APIかつBearer運用なら "*" で問題になりにくい（credentials未使用前提）
	// Pagesへデプロイ後に絞りたいなら env.CORS_ORIGINS を使う（下記コメント参照）
	const allowOrigin = "*";

	// 絞りたい場合（例）:
	// const origin = req.headers.get("Origin") || "";
	// const allowed = (env.CORS_ORIGINS || "")
	//   .split(",")
	//   .map((s) => s.trim())
	//   .filter(Boolean);
	// const allowOrigin = allowed.includes(origin) ? origin : "";

	return {
		"Access-Control-Allow-Origin": allowOrigin,
		"Access-Control-Allow-Methods": "GET,POST,OPTIONS",
		"Access-Control-Allow-Headers": "Authorization,Content-Type",
		"Access-Control-Max-Age": "86400",
		"Vary": "Origin",
	};
}

export function withCors(req, env, res) {
	const cors = makeCorsHeaders(req, env);
	const h = new Headers(res.headers);
	for (const [k, v] of Object.entries(cors)) {
		if (v !== "") h.set(k, v);
	}
	return new Response(res.body, { status: res.status, headers: h });
}

export function handleOptions(req, env) {
	return new Response(null, { status: 204, headers: makeCorsHeaders(req, env) });
}

/** ---------- Auth ---------- */

export function requireAuthOrNull(req, env) {
	// CORS preflight は auth 不要（ここで弾くとブラウザが実リクエストを送れない）
	if (req.method === "OPTIONS") return null;

	const expectedToken = env.CR_LEDGER_AUTH;
	if (!expectedToken) {
		// サーバー側設定ミスなので 500 が妥当
		return json({ ok: false, error: "server auth not configured" }, 500);
	}

	const header = req.headers.get("authorization") || "";
	const expected = `Bearer ${expectedToken}`;

	if (header !== expected) {
		return json({ ok: false, error: "unauthorized" }, 401);
	}

	return null;
}

/** ---------- Router helper ---------- */
/**
 * map: { "METHOD /path": async (req, env, url) => Response }
 */
export async function route(req, env, url, map) {
	const path = normalizePathname(url.pathname);
	const key = `${req.method.toUpperCase()} ${path}`;
	const handler = map[key];
	if (!handler) return new Response(`Not Found: ${path}`, { status: 404 });
	return await handler(req, env, url);
}

/** ---------- Safe wrapper ---------- */
/**
 * fetch全体を包む：OPTIONS/CORS/auth/例外を一元化
 */
export async function handleFetch(req, env, routerFn) {
	// preflight
	if (req.method === "OPTIONS") return handleOptions(req, env);

	// auth
	const authRes = requireAuthOrNull(req, env);
	if (authRes) return withCors(req, env, authRes);

	try {
		const res = await routerFn();
		return withCors(req, env, res);
	} catch (e) {
		// 例外時も必ずCORSを付ける（ブラウザでCORSに見える事故を防ぐ）
		const err = json({ ok: false, error: String(e?.message || e) }, 500);
		return withCors(req, env, err);
	}
}

/**
 *
 */
export async function readJson(req) {
	const ct = req.headers.get("content-type") || "";
	if (!ct.includes("application/json")) throw new Error("content-type must be application/json");
	return await req.json();
}

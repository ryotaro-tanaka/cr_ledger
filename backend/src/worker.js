import { route, handleFetch, normalizePathname } from "./http.js";
import { listPlayers } from "./db/read.js";
import { syncCore } from "./sync.js";
import { handleRoot } from "./handlers/core.js";
import {
  handleCommonPlayers,
  handleCommonSync,
  handleCommonUpdateDeckName,
} from "./handlers/common.js";
import { handleDeckOffenseCounters, handleDeckSummary } from "./handlers/decks.js";
import {
  handleCards,
  handleMyDeckCards,
  handleMyDecks,
  handleOpponentTrend,
  handleMatchupByCard,
  handlePlayers,
  handlePriority,
  handleSyncHttp,
  handleUpdateDeckName,
} from "./handlers/legacy.js";
import { handleTrendTraits, handleTrendWinConditions } from "./handlers/trend.js";

/** ---------- worker ---------- */

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    return handleFetch(req, env, async () => {
      const path = normalizePathname(url.pathname);
      if (req.method.toUpperCase() === "GET") {
        const prefix = "/api/decks/";
        const suffix = "/summary";
        if (path.startsWith(prefix) && path.endsWith(suffix)) {
          const myDeckKeyRaw = path.slice(prefix.length, path.length - suffix.length);
          return await handleDeckSummary(env, myDeckKeyRaw);
        }

        const offenseCountersSuffix = "/offense/counters";
        if (path.startsWith(prefix) && path.endsWith(offenseCountersSuffix)) {
          return await handleDeckOffenseCounters(env, url, path);
        }

        const trendPrefix = "/api/trend/";
        const trendSuffix = "/traits";
        if (path.startsWith(trendPrefix) && path.endsWith(trendSuffix)) {
          return await handleTrendTraits(env, url, path);
        }
      }

      return route(req, env, url, {
        "GET /": async () => await handleRoot(),

        // legacy endpoints (to be replaced)
        "GET /api/cards": async (req, env) => await handleCards(req, env),

        "GET /api/players": async (_req, env, _url) => await handlePlayers(env),

        "GET /api/my-deck-cards": async (_req, env, url) => await handleMyDeckCards(env, url),

        "POST /api/sync": async (_req, env, url) => await handleSyncHttp(env, url),

        "GET /api/stats/my-decks": async (_req, env, url) => await handleMyDecks(env, url),

        "GET /api/stats/opponent-trend": async (_req, env, url) => await handleOpponentTrend(env, url),

        "GET /api/stats/matchup-by-card": async (_req, env, url) => await handleMatchupByCard(env, url),

        "GET /api/stats/priority": async (_req, env, url) => await handlePriority(env, url),

        "PATCH /api/my-decks/name": async (req, env) => await handleUpdateDeckName(req, env),

        // common utility endpoints
        "GET /api/common/players": async (_req, env, url) => await handleCommonPlayers(env, url),

        "PATCH /api/common/my-decks/name": async (req, env) => await handleCommonUpdateDeckName(req, env),

        "POST /api/common/sync": async (req, env) => await handleCommonSync(req, env),

        "GET /api/common/cards": async (req, env) => await handleCards(req, env),

        "GET /api/trend/win-conditions": async (_req, env, url) => await handleTrendWinConditions(env, url),
      });
    });
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      const { players } = await listPlayers(env);

      for (const p of players) {
        const tagDb = p.player_tag;
        const tagApi = `#${tagDb}`;
        await syncCore(env, tagApi);
      }
    })());
  },
};

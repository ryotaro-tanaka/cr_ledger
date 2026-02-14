import { route, handleFetch, normalizePathname } from "./http.js";
import { listPlayers } from "./db/read.js";
import { syncCore } from "./sync.js";
import { handleRoot } from "./handlers/core.js";
import {
  handleCommonCards,
  handleCommonPlayers,
  handleCommonSync,
  handleCommonUpdateDeckName,
} from "./handlers/common.js";
import {
  handleDeckDefenseThreats,
  handleDeckOffenseCounters,
  handleDeckSummary,
} from "./handlers/decks.js";
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

        const defenseThreatsSuffix = "/defense/threats";
        if (path.startsWith(prefix) && path.endsWith(defenseThreatsSuffix)) {
          return await handleDeckDefenseThreats(env, url, path);
        }

        const trendPrefix = "/api/trend/";
        const trendSuffix = "/traits";
        if (path.startsWith(trendPrefix) && path.endsWith(trendSuffix)) {
          return await handleTrendTraits(env, url, path);
        }
      }

      return route(req, env, url, {
        "GET /": async () => await handleRoot(),

        // common utility endpoints
        "GET /api/common/players": async (_req, env, url) => await handleCommonPlayers(env, url),

        "PATCH /api/common/my-decks/name": async (req, env) => await handleCommonUpdateDeckName(req, env),

        "POST /api/common/sync": async (req, env) => await handleCommonSync(req, env),

        "GET /api/common/cards": async (req, env) => await handleCommonCards(req, env),

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

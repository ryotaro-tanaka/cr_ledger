import { route, handleFetch } from "./http.js";
import { listPlayers } from "./db.js";
import { syncCore } from "./sync.js";
import {
  handleRoot,
  handlePlayers,
  handleSyncHttp,
  handleMyDecks,
  handleCards,
  handleUpdateDeckName,
  handleMyDeckCards,
} from "./handlers.js";
import {
  handleOpponentTrend,
  handleMatchupByCard,
  handlePriority,
} from "./legacy_handlers.js";

/** ---------- worker ---------- */

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    return handleFetch(req, env, async () => {
      return route(req, env, url, {
        "GET /": async () => await handleRoot(),

        "GET /api/cards": async (req, env) => await handleCards(req, env),

        "GET /api/players": async (_req, env, _url) => await handlePlayers(env),

        "GET /api/my-deck-cards": async (_req, env, url) => await handleMyDeckCards(env, url),

        "POST /api/sync": async (_req, env, url) => await handleSyncHttp(env, url),

        "GET /api/stats/my-decks": async (_req, env, url) => await handleMyDecks(env, url),

        // legacy endpoints (to be replaced)
        "GET /api/stats/opponent-trend": async (_req, env, url) => await handleOpponentTrend(env, url),

        "GET /api/stats/matchup-by-card": async (_req, env, url) => await handleMatchupByCard(env, url),

        "GET /api/stats/priority": async (_req, env, url) => await handlePriority(env, url),

        "PATCH /api/my-decks/name": async (req, env) => await handleUpdateDeckName(req, env),
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

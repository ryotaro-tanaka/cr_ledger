export async function handleRoot() {
  return new Response(
    [
      "OK",
      "Try:",
      "POST  /api/sync?player_tag=GYVCJJCR0",
      "GET   /api/players",
      "GET   /api/my-deck-cards?my_deck_key=...",
      "GET   /api/stats/opponent-trend?player_tag=GYVCJJCR0&last=200",
      "GET   /api/stats/opponent-trend?player_tag=GYVCJJCR0&since=20260101T000000.000Z",
      "GET   /api/stats/my-decks?player_tag=GYVCJJCR0&last=200",
      "GET   /api/stats/matchup-by-card?my_deck_key=...&last=500&min=10",
      "GET   /api/stats/priority?player_tag=GYVCJJCR0&my_deck_key=...&last=500&min=10",
      "GET   /api/cards?nocache=1",
      "PATCH /api/my-decks/name",
    ].join("\n"),
    { headers: { "content-type": "text/plain; charset=utf-8" } }
  );
}

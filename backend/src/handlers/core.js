export async function handleRoot() {
  return new Response(
    [
      "OK",
      "Try:",
      "GET   /api/common/players?last=200",
      "PATCH /api/common/my-decks/name",
      "POST  /api/common/sync",
      "GET   /api/common/cards?nocache=1",
      "GET   /api/trend/GYVCJJCR0/win-conditions?last=200",
    ].join("\n"),
    { headers: { "content-type": "text/plain; charset=utf-8" } }
  );
}

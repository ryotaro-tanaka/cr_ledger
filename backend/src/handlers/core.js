export async function handleRoot() {
  return new Response(
    [
      "OK",
      "Try:",
      "GET   /api/common/players?seasons=2",
      "PATCH /api/common/my-decks/name",
      "POST  /api/common/sync",
      "GET   /api/common/cards?nocache=1",
      "GET   /api/common/classes",
      "GET   /api/common/traits",
      "GET   /api/trend/GYVCJJCR0/win-conditions?seasons=2",
    ].join("\n"),
    { headers: { "content-type": "text/plain; charset=utf-8" } }
  );
}

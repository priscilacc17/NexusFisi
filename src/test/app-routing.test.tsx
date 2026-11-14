import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it.each([
    ["/registro", "/registro"],
    ["/app/solicitudes/FISI-2026-00001", "/app/solicitudes/$codigo"],
    ["/app/bandeja", "/app/bandeja"],
    ["/app/admin", "/app/admin"],
    ["/app/perfil", "/app/perfil"],
  ])("%s resuelve a la ruta %s", (url, id) => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    expect(router.matchRoutes(url).at(-1)?.routeId).toBe(id);
  });
});

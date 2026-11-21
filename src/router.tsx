import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { routeTree } from "./routeTree.gen";

// Nonce de la CSP de esta petición (lo genera src/server.ts). En el navegador no hace falta.
const nonceDeLaPeticion = createIsomorphicFn()
  .server(() =>
    (globalThis as { __nexusNonces?: WeakMap<Request, string> }).__nexusNonces?.get(getRequest()),
  )
  .client(() => undefined);

export const getRouter = () => {
  const nonce = nonceDeLaPeticion();
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        // Solo se reintentan fallas de red o del servidor; un 4xx (permiso,
        // validación, no encontrado) no va a cambiar por repetir la petición.
        retry: (intentos, error) => {
          const status = (error as { status?: number }).status ?? 0;
          return intentos < 2 && (status === 0 || status >= 500);
        },
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    ...(nonce ? { ssr: { nonce } } : {}),
  });

  return router;
};

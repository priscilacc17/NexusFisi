// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// En desarrollo, /api se redirige a la API local (cd api && npm run dev).
const API_DEV = process.env["API_DEV_URL"] ?? "http://127.0.0.1:4000";

// Los archivos públicos (/assets, robots.txt…) los sirve Nitro sin pasar por
// src/server.ts: con estas reglas reciben las mismas cabeceras de seguridad
// (hallazgo del escaneo DAST con ZAP). Los de /assets llevan hash en el nombre,
// así que pueden guardarse en caché un año.
function nitroNode(preset: string) {
  const opciones = {
    preset,
    routeRules: {
      "/**": {
        headers: {
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "DENY",
          "Referrer-Policy": "strict-origin-when-cross-origin",
          "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
        },
      },
      "/assets/**": { headers: { "Cache-Control": "public, max-age=31536000, immutable" } },
    },
  };
  // El tipo de la configuración de Lovable solo declara preset/output, pero el
  // objeto se entrega completo a Nitro, que sí admite routeRules.
  return opciones as { preset: string };
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Despliegue con Docker (VM o Render): servidor Node. Sin NITRO_PRESET se usa el
  // destino por defecto de Lovable (Cloudflare), así el editor sigue funcionando.
  ...(process.env["NITRO_PRESET"] ? { nitro: nitroNode(process.env["NITRO_PRESET"]) } : {}),
  vite: {
    server: { proxy: { "/api": { target: API_DEV, changeOrigin: false } } },
  },
});

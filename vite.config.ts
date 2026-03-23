import { qwikVite } from "@builder.io/qwik/optimizer";
import { imagetools } from "vite-imagetools";
import { qwikCity } from "@builder.io/qwik-city/vite";
import { type PWAOptions, qwikPwa } from "@qwikdev/pwa";

const unsetBlankEnv = (...keys: string[]) => {
  for (const key of keys) {
    if (typeof process.env[key] === "string" && process.env[key]?.trim() === "") {
      delete process.env[key];
    }
  }
};

unsetBlankEnv("ORIGIN", "HOST", "PORT");

export default (async (env?: { command?: string }) => {
  const tsconfigPaths = (await import("vite-tsconfig-paths")).default;
  const tailwindcssPlugin = (await import("@tailwindcss/vite")).default;
  const isDevServer = env?.command === "serve";
  const pwaConfig: PWAOptions = isDevServer
    ? { config: false, overrideManifestIcons: false }
    : { config: true };

  return {
    define: {
      // Let Workbox use the real NODE_ENV so debug logging is OFF in production
      "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "production"),
    },
    plugins: [
      qwikCity(),
      qwikVite(),
      imagetools(),
      tsconfigPaths(),
      qwikPwa(pwaConfig),
      tailwindcssPlugin(),
      {
        name: 'webSocketServerPlugin',
        configureServer(server) {
          if (server.httpServer) {
            import('./src/server/websocket').then((mod) => {
              mod.initWebSocketServer(server.httpServer);
            });
          }
        },
      },
    ],
    optimizeDeps: {
      esbuildOptions: {
        define: {
          global: "globalThis",
        },
      },
    },
  };
})();

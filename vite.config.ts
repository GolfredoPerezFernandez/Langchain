import { qwikVite } from "@builder.io/qwik/optimizer";
import { imagetools } from "vite-imagetools";
import { qwikCity } from "@builder.io/qwik-city/vite";
import type { PWAOptions } from "@qwikdev/pwa";

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
  const isBuild = env?.command === "build";
  const pwaPlugin = isBuild
    ? [
        (
          await import("@qwikdev/pwa")
        ).qwikPwa({ config: true } satisfies PWAOptions),
      ]
    : [];

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
      ...pwaPlugin,
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

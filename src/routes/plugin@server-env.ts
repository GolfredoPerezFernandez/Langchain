import type { RequestHandler } from "@builder.io/qwik-city";
import { initializeServerEnv } from "~/lib/server-env";

export const onRequest: RequestHandler = async ({ env }) => {
  initializeServerEnv(env);
};

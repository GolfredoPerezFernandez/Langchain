import type { RequestHandler } from "@builder.io/qwik-city";
import { clearLegalchainSession } from "../../../../../lib/legalchain/store";

export const onGet: RequestHandler = async (event) => {
  await clearLegalchainSession(event);
  throw event.redirect(302, "/auth?mode=login");
};

export const onPost: RequestHandler = async (event) => {
  await clearLegalchainSession(event);
  event.json(200, { ok: true });
};


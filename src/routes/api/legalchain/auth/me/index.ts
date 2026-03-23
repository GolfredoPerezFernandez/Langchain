import type { RequestHandler } from "@builder.io/qwik-city";
import { getCurrentLegalchainUser } from "../../../../../lib/legalchain/store";

export const onGet: RequestHandler = async (event) => {
  const user = await getCurrentLegalchainUser(event);
  if (!user) {
    event.json(401, { ok: false, user: null });
    return;
  }

  event.json(200, { ok: true, user });
};


import type { RequestHandler } from "@builder.io/qwik-city";
import { getLegalchainSessionFromEvent, getLegalchainWorkspace } from "../../../../lib/legalchain/store";

export const onGet: RequestHandler = async (event) => {
  const session = await getLegalchainSessionFromEvent(event);
  if (!session) {
    event.json(401, { ok: false, error: "Not authenticated." });
    return;
  }

  const workspace = await getLegalchainWorkspace(session.userId);
  event.json(200, { ok: true, workspace });
};


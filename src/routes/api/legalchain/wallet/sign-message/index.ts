import type { RequestHandler } from "@builder.io/qwik-city";
import { getLegalchainSessionFromEvent } from "../../../../../lib/legalchain/store";
import { signMessageWithLegalchainWallet } from "../../../../../lib/legalchain/web3";

export const onPost: RequestHandler = async (event) => {
  const session = await getLegalchainSessionFromEvent(event);
  if (!session) {
    event.json(401, { ok: false, error: "Not authenticated." });
    return;
  }

  try {
    const body = await event.request.json();
    const message = String(body.message ?? "").trim();
    if (!message) {
      event.json(400, { ok: false, error: "Message is required." });
      return;
    }

    const signed = await signMessageWithLegalchainWallet(session.userId, message);
    event.json(200, { ok: true, ...signed });
  } catch (error) {
    event.json(400, {
      ok: false,
      error: error instanceof Error ? error.message : "Message signing failed.",
    });
  }
};


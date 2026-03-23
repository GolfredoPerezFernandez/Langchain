import type { RequestHandler } from "@builder.io/qwik-city";
import { getLegalchainSessionFromEvent, getLegalchainWalletByUserId } from "../../../../lib/legalchain/store";

export const onGet: RequestHandler = async (event) => {
  const session = await getLegalchainSessionFromEvent(event);
  if (!session) {
    event.json(401, { ok: false, error: "Not authenticated." });
    return;
  }

  const wallet = await getLegalchainWalletByUserId(session.userId);
  if (!wallet) {
    event.json(404, { ok: false, error: "Wallet not found." });
    return;
  }

  event.json(200, {
    ok: true,
    wallet: {
      address: wallet.address,
      chainId: wallet.chainId,
      createdAt: wallet.createdAt,
    },
  });
};


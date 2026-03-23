import type { RequestHandler } from "@builder.io/qwik-city";
import type { Abi, Address } from "viem";
import { getLegalchainSessionFromEvent } from "../../../../../lib/legalchain/store";
import { writeContractWithLegalchainWallet } from "../../../../../lib/legalchain/web3";

export const onPost: RequestHandler = async (event) => {
  const session = await getLegalchainSessionFromEvent(event);
  if (!session) {
    event.json(401, { ok: false, error: "Not authenticated." });
    return;
  }

  try {
    const body = await event.request.json();
    const address = String(body.address ?? "").trim() as Address;
    const functionName = String(body.functionName ?? "").trim();
    const abi = body.abi as Abi;
    const args = Array.isArray(body.args) ? body.args : [];
    const value =
      body.value === undefined || body.value === null || body.value === ""
        ? undefined
        : BigInt(String(body.value));

    if (!address || !functionName || !Array.isArray(abi)) {
      event.json(400, {
        ok: false,
        error: "address, abi and functionName are required.",
      });
      return;
    }

    const result = await writeContractWithLegalchainWallet({
      userId: session.userId,
      address,
      abi,
      functionName,
      args,
      value,
    });

    event.json(200, { ok: true, ...result });
  } catch (error) {
    event.json(400, {
      ok: false,
      error: error instanceof Error ? error.message : "Contract write failed.",
    });
  }
};


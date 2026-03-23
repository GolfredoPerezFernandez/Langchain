import type { RequestHandler } from "@builder.io/qwik-city";
import { getLegalchainSessionFromEvent } from "../../../../../lib/legalchain/store";
import { mintLegalchainNft } from "../../../../../lib/legalchain/nft";

export const onPost: RequestHandler = async (event) => {
  const session = await getLegalchainSessionFromEvent(event);
  if (!session) {
    event.json(401, { ok: false, error: "Not authenticated." });
    return;
  }

  try {
    const body = (await event.request.json()) as {
      title?: string;
      description?: string;
      templateSlug?: string;
      templateTitle?: string;
      duration?: string;
      visibility?: string;
      pin?: string;
      tokenURI?: string;
      metadata?: Record<string, unknown>;
      image?: {
        bytes?: number[];
        name?: string;
        type?: string;
      } | null;
    };

    const title = String(body.title ?? "").trim();
    if (!title) {
      event.json(400, { ok: false, error: "title is required." });
      return;
    }

    const result = await mintLegalchainNft(
      {
        userId: session.userId,
        title,
        description: typeof body.description === "string" ? body.description : "",
        templateSlug: typeof body.templateSlug === "string" ? body.templateSlug : "",
        templateTitle: typeof body.templateTitle === "string" ? body.templateTitle : "",
        duration: typeof body.duration === "string" ? body.duration : "",
        visibility: typeof body.visibility === "string" ? body.visibility : "",
        pin: typeof body.pin === "string" ? body.pin : "",
        tokenURI: typeof body.tokenURI === "string" ? body.tokenURI : "",
        metadata: typeof body.metadata === "object" && body.metadata ? body.metadata : {},
        image:
          body.image && Array.isArray(body.image.bytes)
            ? {
                bytes: body.image.bytes,
                name: body.image.name,
                type: body.image.type,
              }
            : null,
      },
      event,
    );

    event.json(200, result);
  } catch (error) {
    event.json(400, {
      ok: false,
      error: error instanceof Error ? error.message : "NFT mint failed.",
    });
  }
};

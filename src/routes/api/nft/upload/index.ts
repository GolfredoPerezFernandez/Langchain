import type { RequestHandler } from "@builder.io/qwik-city";
import { uploadMetadataToStoracha } from "../../../../lib/legalchain/storacha";

export const onPost: RequestHandler = async (event) => {
  try {
    const contentType = event.request.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      event.json(400, { ok: false, error: "Content-Type must be application/json." });
      return;
    }

    const body = (await event.request.json()) as {
      metadata?: Record<string, unknown>;
      image?: {
        bytes?: number[];
        name?: string;
        type?: string;
      } | null;
    };

    const result = await uploadMetadataToStoracha(
      {
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

    event.json(200, { ok: true, ...result });
  } catch (error) {
    event.json(500, {
      ok: false,
      error: error instanceof Error ? error.message : "Server error.",
    });
  }
};

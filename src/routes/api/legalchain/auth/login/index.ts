import type { RequestHandler } from "@builder.io/qwik-city";
import { loginLegalchainUser } from "../../../../../lib/legalchain/store";

export const onPost: RequestHandler = async (event) => {
  try {
    const body = await event.request.json();
    const user = await loginLegalchainUser(
      {
        email: String(body.email ?? ""),
        password: String(body.password ?? ""),
        pin: String(body.pin ?? ""),
      },
      event,
    );

    event.json(200, { ok: true, user });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "PIN_REQUIRED") {
      event.json(200, {
        ok: false,
        pinRequired: true,
        error: error instanceof Error ? error.message : "PIN is required to complete sign in.",
      });
      return;
    }

    event.json(401, {
      ok: false,
      error: error instanceof Error ? error.message : "Legalchain login failed.",
    });
  }
};

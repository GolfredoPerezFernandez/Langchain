import type { RequestHandler } from "@builder.io/qwik-city";
import { registerLegalchainUser } from "../../../../../lib/legalchain/store";

export const onPost: RequestHandler = async (event) => {
  try {
    const body = await event.request.json();
    const password = String(body.password ?? "");
    const repeatPassword = String(body.repeatPassword ?? "");

    if (password !== repeatPassword) {
      event.json(400, { ok: false, error: "Passwords do not match." });
      return;
    }

    const user = await registerLegalchainUser(
      {
        fullName: String(body.fullName ?? ""),
        email: String(body.email ?? ""),
        phone: String(body.phone ?? ""),
        username: String(body.username ?? ""),
        password,
        pin: String(body.pin ?? ""),
      },
      event,
    );

    event.json(200, { ok: true, user });
  } catch (error) {
    event.json(400, {
      ok: false,
      error: error instanceof Error ? error.message : "Legalchain registration failed.",
    });
  }
};


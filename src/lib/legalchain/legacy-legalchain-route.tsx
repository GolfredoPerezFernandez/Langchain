import { component$ } from "@builder.io/qwik";
import type { RequestHandler } from "@builder.io/qwik-city";

export const resolveLegacyLegalchainRedirect = (pathname: string) => {
  if (pathname === "/legalchain" || pathname === "/legalchain/") {
    return "/";
  }

  if (pathname === "/legalchain/signIn") {
    return "/auth?mode=login";
  }

  if (pathname === "/legalchain/signUp") {
    return "/auth?mode=signup";
  }

  return pathname.replace(/^\/legalchain/, "") || "/";
};

export const redirectLegacyLegalchainRequest: RequestHandler = async (event) => {
  throw event.redirect(302, resolveLegacyLegalchainRedirect(event.url.pathname));
};

export const LegacyLegalchainRedirect = component$(() => null);

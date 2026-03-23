import { component$ } from "@builder.io/qwik";
import type { RequestHandler } from "@builder.io/qwik-city";

export const resolveLegacyDashboardRedirect = (pathname: string) => {
  if (pathname === "/dashboard" || pathname === "/dashboard/") {
    return "/controlPanel";
  }

  if (
    pathname.startsWith("/dashboard/payment") ||
    pathname.startsWith("/dashboard/admin/comisiones") ||
    pathname.startsWith("/dashboard/admin/transacciones-bdv")
  ) {
    return "/payments";
  }

  if (pathname.startsWith("/dashboard/chat") || pathname.startsWith("/dashboard/notifications")) {
    return "/history";
  }

  if (pathname.startsWith("/dashboard/caregiver-search")) {
    return "/templates";
  }

  return "/controlPanel";
};

export const redirectLegacyDashboardRequest: RequestHandler = async (event) => {
  throw event.redirect(302, resolveLegacyDashboardRedirect(event.url.pathname));
};

export const LegacyDashboardRedirect = component$(() => null);

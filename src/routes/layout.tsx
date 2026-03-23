import { Slot, component$, useStyles$ } from "@builder.io/qwik";
import type { RequestHandler } from "@builder.io/qwik-city";
import { Link, routeLoader$, useLocation } from "@builder.io/qwik-city";
import { LegalchainPill } from "~/components/legalchain/ui";
import { PushManager } from "~/components/push-manager";
import { LegalchainLogo } from "~/components/legalchain/logo";
import { legalchainPrivateNav, legalchainPublicNav } from "~/lib/legalchain/nav";
import { getCurrentLegalchainUser, getLegalchainSessionFromEvent, getLegalchainWorkspace } from "~/lib/legalchain/store";

const legalchainPrivatePrefixes = [
  "/controlPanel",
  "/templates",
  "/record",
  "/preview",
  "/history",
  "/payments",
  "/buy-token",
  "/ProcessStripe",
  "/profile-nft",
];

const isLegalchainPrivatePath = (pathname: string) =>
  legalchainPrivatePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

export const onGet: RequestHandler = async (event) => {
  const pathname = event.url.pathname;

  if (isLegalchainPrivatePath(pathname)) {
    event.cacheControl({
      public: false,
      maxAge: 0,
      sMaxAge: 0,
      staleWhileRevalidate: 0,
    });

    const session = await getLegalchainSessionFromEvent(event);
    if (!session) {
      throw event.redirect(302, "/auth?mode=login");
    }
    return;
  }

  if (pathname === "/") {
    const cacheOptions = {
      public: true,
      maxAge: 5,
      staleWhileRevalidate: 60 * 60 * 24 * 7,
    };
    event.cacheControl(cacheOptions);
    event.cacheControl(cacheOptions, "CDN-Cache-Control");
    return;
  }

  event.cacheControl({
    public: false,
    maxAge: 0,
    sMaxAge: 0,
    staleWhileRevalidate: 0,
  });
};

export const useRootLayoutLoader = routeLoader$(async (event) => {
  const pathname = event.url.pathname;
  if (!isLegalchainPrivatePath(pathname)) {
    return {
      privateWorkspace: null,
    };
  }

  const user = await getCurrentLegalchainUser(event);
  if (!user) {
    return {
      privateWorkspace: null,
    };
  }

  const workspace = await getLegalchainWorkspace(user.id);
  const pendingPayments = workspace.payments.filter((payment: { status: string }) => payment.status !== "Approved").length;
  const reviewItems =
    workspace.templates.filter((template: { status: string }) => template.status === "Review").length +
    workspace.records.filter((record: { status: string }) => record.status === "Review").length +
    pendingPayments;

  return {
    privateWorkspace: {
      userName: user.fullName,
      walletAddress: workspace.wallet?.address ?? "",
      hasCollection: Boolean(workspace.collection),
      collectionName: workspace.collection?.name ?? "",
      recordsCount: workspace.records.length,
      templatesCount: workspace.templates.length,
      pendingPayments,
      reviewItems,
      draftTitle: workspace.draft?.title ?? "",
    },
  };
});

export default component$(() => {
  const location = useLocation();
  const layoutData = useRootLayoutLoader().value;
  const path = location.url.pathname;
  const activeLanguage = location.url.searchParams.get("lang") === "es" ? "es" : "en";
  const passThrough =
    path.startsWith("/legalchain") ||
    path.startsWith("/dashboard") ||
    path.startsWith("/api") ||
    path === "/service-worker.js";
  const isAuth = path === "/auth";
  const isHome = path === "/";
  const isPrivateApp = [
    "/controlPanel",
    "/templates",
    "/record",
    "/preview",
    "/history",
    "/payments",
    "/buy-token",
    "/ProcessStripe",
    "/profile-nft",
  ].some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

  useStyles$(`
    .root-legalchain {
      position: relative;
      min-height: 100vh;
      color: #f7f3fb;
      background:
        radial-gradient(circle at top left, rgba(220, 98, 219, 0.22), transparent 34%),
        radial-gradient(circle at top right, rgba(255, 255, 255, 0.06), transparent 24%),
        radial-gradient(circle at bottom left, rgba(78, 12, 88, 0.45), transparent 38%),
        linear-gradient(145deg, #7c1183 0%, #481052 48%, #18071f 100%);
      overflow: hidden;
    }
    .root-legalchain::before,
    .root-legalchain::after {
      content: "";
      position: absolute;
      border-radius: 999px;
      pointer-events: none;
      filter: blur(18px);
    }
    .root-legalchain::before {
      top: -140px;
      right: -120px;
      width: 340px;
      height: 340px;
      background: rgba(255,255,255,0.08);
    }
    .root-legalchain::after {
      bottom: -180px;
      left: -120px;
      width: 420px;
      height: 420px;
      background: rgba(255,255,255,0.06);
    }
    .root-legalchain nav summary {
      list-style: none;
    }
    .root-legalchain nav summary::-webkit-details-marker {
      display: none;
    }
  `);

  if (passThrough) {
    return (
      <>
        <Slot />
        <PushManager />
      </>
    );
  }

  const navItems = isPrivateApp ? legalchainPrivateNav : legalchainPublicNav;
  const buildLanguageHref = (lang: "en" | "es") => {
    const params = new URLSearchParams(location.url.search);
    params.set("lang", lang);
    const query = params.toString();
    return query ? `${location.url.pathname}?${query}` : location.url.pathname;
  };
  const quickLinks = [
    { label: "Preview", href: "/preview", badge: "Media" },
    { label: "Process Stripe", href: "/ProcessStripe", badge: "Stripe" },
  ];
  const privateWorkspace = layoutData.privateWorkspace;
  const workspaceCards = privateWorkspace
    ? [
        {
          label: "Minted records",
          value: `${privateWorkspace.recordsCount}`.padStart(2, "0"),
          hint: privateWorkspace.hasCollection
            ? `${privateWorkspace.collectionName || "Base collection"} is already active for this user.`
            : "The first mint will deploy the user's Base collection.",
        },
        {
          label: "Pending queue",
          value: `${privateWorkspace.reviewItems}`.padStart(2, "0"),
          hint: privateWorkspace.draftTitle
            ? `Draft ready: ${privateWorkspace.draftTitle}.`
            : privateWorkspace.pendingPayments > 0
              ? `${privateWorkspace.pendingPayments} treasury item(s) need follow-up.`
              : "No active blockers in the current workspace.",
        },
      ]
    : [];

  return (
    <div class="root-legalchain">
      <div class="relative z-10 min-h-screen">
        <header class="border-b border-white/10 bg-black/10 backdrop-blur">
          <div class="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-4 sm:px-6">
            <Link href="/" class="shrink-0">
              <LegalchainLogo />
            </Link>
            <nav class="hidden items-center gap-2 md:flex">
              {navItems.map((item) => {
                const active =
                  item.href === "/"
                    ? path === "/"
                    : path === item.href ||
                      path.startsWith(`${item.href}/`) ||
                      (item.href === "/auth?mode=login" && path === "/auth");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    class={[
                      "rounded-full px-4 py-2 text-sm font-semibold transition",
                      active
                        ? "bg-white text-[#6f0f74]"
                        : "bg-white/[0.08] text-white/78 hover:bg-white/[0.13]",
                    ]}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div class="flex items-center gap-3">
              <div class="hidden items-center gap-2 xl:flex">
                {[
                  { code: "en" as const, label: "English" },
                  { code: "es" as const, label: "Español" },
                ].map((language) => (
                  <Link
                    key={language.code}
                    href={buildLanguageHref(language.code)}
                    class={[
                      "rounded-full px-3 py-2 text-xs font-black uppercase tracking-[0.18em] transition",
                      activeLanguage === language.code
                        ? "bg-white text-[#6f0f74]"
                        : "border border-white/12 bg-white/[0.06] text-white/72 hover:bg-white/[0.12]",
                    ]}
                  >
                    {language.label}
                  </Link>
                ))}
              </div>
              {isPrivateApp && privateWorkspace && (
                <div class="hidden items-center gap-3 rounded-full border border-white/12 bg-white/[0.08] px-3 py-2 xl:flex">
                  <div>
                    <div class="text-[10px] uppercase tracking-[0.22em] text-white/40">Wallet</div>
                    <div class="mt-1 text-sm font-black text-white">
                      {privateWorkspace.walletAddress
                        ? `${privateWorkspace.walletAddress.slice(0, 6)}...${privateWorkspace.walletAddress.slice(-4)}`
                        : "Pending"}
                    </div>
                  </div>
                  <LegalchainPill
                    label={privateWorkspace.walletAddress ? "Base lista" : "Base pending"}
                    tone={privateWorkspace.walletAddress ? "success" : "warning"}
                  />
                </div>
              )}
              <details class="relative md:hidden">
                <summary class="rounded-full border border-white/12 bg-white/[0.08] px-4 py-2 text-sm font-semibold text-white">
                  Menu
                </summary>
                <div class="absolute right-0 top-14 z-20 w-72 rounded-[24px] border border-white/12 bg-[#14091c]/96 p-4 shadow-[0_22px_80px_rgba(8,4,18,0.4)]">
                  <div class="space-y-2">
                    {navItems.map((item) => (
                      <Link
                        key={`${item.href}-mobile`}
                        href={item.href}
                        class="block rounded-2xl bg-white/[0.06] px-4 py-3 text-sm text-white/80"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </details>
              {isPrivateApp && (
                <Link
                  href="/api/legalchain/auth/logout"
                  class="rounded-full border border-white/12 bg-white/[0.08] px-4 py-2 text-sm font-semibold text-white"
                >
                  Exit
                </Link>
              )}
              <Link
                href={isPrivateApp ? "/record" : "/auth?mode=login"}
                class="rounded-full bg-white px-4 py-2 text-sm font-black uppercase tracking-[0.22em] text-[#7e0f84]"
              >
                {isPrivateApp ? "Record now" : "Sign in"}
              </Link>
            </div>
          </div>
        </header>

        <div
          class={
            isPrivateApp
              ? "mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[300px_minmax(0,1fr)]"
              : "mx-auto max-w-7xl px-4 py-10 sm:px-6"
          }
        >
          {isPrivateApp && (
            <aside class="h-fit rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(22,8,29,0.94),rgba(13,7,18,0.92))] p-5 shadow-[0_28px_90px_rgba(10,4,22,0.45)] backdrop-blur">
              <div class="text-[11px] uppercase tracking-[0.32em] text-white/45">Workspace</div>
              <div class="mt-3 text-xl font-black text-white">Legalchain operations</div>
              <p class="mt-3 text-sm leading-6 text-white/65">
                Templates, record, review and treasury now share the same left rail, closer to the original product
                rhythm.
              </p>
              {privateWorkspace && <div class="mt-4 text-sm font-semibold text-white/72">{privateWorkspace.userName}</div>}
              <div class="mt-6 space-y-2">
                {legalchainPrivateNav.map((item) => {
                  const active = path === item.href || path.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      class={[
                        "flex items-center justify-between rounded-2xl px-4 py-3 text-sm transition",
                        active ? "bg-white text-[#710f77]" : "bg-white/[0.07] text-white/78 hover:bg-white/[0.1]",
                      ]}
                    >
                      <span>{item.label}</span>
                      {item.badge && (
                        <span
                          class={
                            active
                              ? "rounded-full bg-[#710f77]/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-[#710f77]"
                              : "rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-white/65"
                          }
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>

              <div class="mt-7 rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
                <div class="text-[10px] uppercase tracking-[0.28em] text-white/42">Quick access</div>
                <div class="mt-3 space-y-2">
                  {quickLinks.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      class="flex items-center justify-between rounded-2xl bg-white/[0.06] px-4 py-3 text-sm text-white/78"
                    >
                      <span>{item.label}</span>
                      <LegalchainPill label={item.badge} />
                    </Link>
                  ))}
                </div>
              </div>

              <div class="mt-7 grid gap-3">
                {workspaceCards.map((item) => (
                  <div key={item.label} class="rounded-[22px] border border-white/8 bg-white/[0.04] px-4 py-4">
                    <div class="text-[10px] uppercase tracking-[0.24em] text-white/38">{item.label}</div>
                    <div class="mt-2 text-2xl font-black text-white">{item.value}</div>
                    {item.hint && <div class="mt-1 text-sm leading-6 text-white/55">{item.hint}</div>}
                  </div>
                ))}
              </div>
            </aside>
          )}
          <main class={isAuth || isHome ? "" : "min-w-0"}>
            <Slot />
          </main>
        </div>
      </div>
      <PushManager />
    </div>
  );
});

import { component$ } from "@builder.io/qwik";
import { Form, Link, routeAction$, routeLoader$ } from "@builder.io/qwik-city";
import { LegalchainPageShell } from "~/components/legalchain/page-shell";
import {
  LegalchainChecklist,
  LegalchainPanel,
  LegalchainPill,
  LegalchainStatGrid,
  LegalchainValueList,
} from "~/components/legalchain/ui";
import {
  createLegalchainCheckout,
  hasLegalchainStripeConfigured,
  legalchainTokenPlans,
} from "~/lib/legalchain/payments";
import { getCurrentLegalchainUser } from "~/lib/legalchain/store";

export const useBuyTokenLoader = routeLoader$(async (event) => {
  const user = await getCurrentLegalchainUser(event);
  if (!user) {
    throw event.redirect(302, "/auth?mode=login");
  }

  return {
    user,
    stripeConfigured: hasLegalchainStripeConfigured(),
  };
});

export const useCreateCheckoutAction = routeAction$(async (form, event) => {
  const user = await getCurrentLegalchainUser(event);
  if (!user) {
    throw event.redirect(302, "/auth?mode=login");
  }

  const planId = String(form.planId ?? "").trim();
  if (!planId) {
    return {
      ok: false,
      error: "Select a package before continuing.",
    };
  }

  const result = await createLegalchainCheckout({
    event,
    planId,
    user,
  });

  if (result.checkoutUrl) {
    throw event.redirect(302, result.checkoutUrl);
  }

  throw event.redirect(302, `/ProcessStripe?ref=${encodeURIComponent(result.payment?.reference ?? "")}`);
});

export default component$(() => {
  const { stripeConfigured } = useBuyTokenLoader().value;
  const checkoutAction = useCreateCheckoutAction();
  const selectedPlan = legalchainTokenPlans[1];

  return (
    <LegalchainPageShell
      eyebrow="Treasury flow"
      title="Buy Token"
      description="The token purchase route now creates a real backend checkout reference before handoff into Stripe or sandbox review."
      actions={[
        { label: "Open payments", href: "/payments" },
        { label: "Continue to Stripe", href: "/ProcessStripe" },
      ]}
    >
      <LegalchainStatGrid
        items={[
          {
            label: "Wallet state",
            value: "Ready",
            hint: "The user already has a custodial wallet and treasury profile.",
          },
          {
            label: "Reference rate",
            value: "10 LC/$1",
            hint: "Current static token mapping kept from the original Legalchain flow.",
          },
          {
            label: "Reserve",
            value: "$5",
            hint: "Gas and payment overhead remain visible before checkout.",
          },
          {
            label: "Checkout path",
            value: stripeConfigured ? "Stripe hosted" : "Sandbox",
            hint: "The server decides whether to open Stripe or keep the flow in sandbox mode.",
          },
        ]}
      />

      <div class="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <LegalchainPanel
          eyebrow="Token packs"
          title="Choose a package"
          description="Each package now triggers backend checkout creation instead of linking to a placeholder route."
        >
          {checkoutAction.value && !checkoutAction.value.ok && (
            <div class="mb-5 rounded-[18px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
              {checkoutAction.value.error}
            </div>
          )}

          <div class="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
            {legalchainTokenPlans.map((plan) => (
              <article
                key={plan.id}
                class={[
                  "flex h-full flex-col rounded-[30px] border p-6 shadow-[0_20px_60px_rgba(8,3,18,0.22)]",
                  plan.id === selectedPlan.id
                    ? "border-white/20 bg-white/[0.09]"
                    : "border-white/10 bg-white/[0.04]",
                ]}
              >
                <div class="flex items-start justify-between gap-4">
                  <div class="min-w-0">
                    <div class="text-[10px] uppercase tracking-[0.24em] text-white/40">Package</div>
                    <h2 class="mt-2 text-2xl font-black text-white">{plan.name}</h2>
                  </div>
                  <LegalchainPill
                    label={plan.badge}
                    tone={plan.id === selectedPlan.id ? "light" : "default"}
                  />
                </div>

                <div class="mt-6 text-5xl font-black tracking-tight text-white">{plan.amount}</div>
                <div class="mt-3 flex flex-wrap gap-2">
                  <span class="rounded-full border border-white/10 bg-black/10 px-3 py-1 text-xs font-semibold text-white/78">
                    {plan.tokens}
                  </span>
                  <span class="rounded-full border border-white/10 bg-black/10 px-3 py-1 text-xs font-semibold text-white/78">
                    {plan.eth}
                  </span>
                </div>
                <p class="mt-5 min-h-[104px] text-sm leading-7 text-white/66">{plan.note}</p>

                <div class="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <div
                      key={feature}
                      class="rounded-[20px] border border-white/8 bg-[#14071d]/86 px-4 py-4 text-sm leading-6 text-white/68"
                    >
                      {feature}
                    </div>
                  ))}
                </div>

                <Form action={checkoutAction} class="mt-6">
                  <input type="hidden" name="planId" value={plan.id} />
                  <button
                    type="submit"
                    class={[
                      "inline-flex w-full items-center justify-center rounded-full px-4 py-3 text-center text-sm font-black tracking-[0.14em]",
                      plan.id === selectedPlan.id
                        ? "bg-white text-[#7e0f84]"
                        : "border border-white/12 bg-white/[0.05] text-white",
                    ]}
                  >
                    {checkoutAction.isRunning ? "Creating..." : "Select plan"}
                  </button>
                </Form>
              </article>
            ))}
          </div>
        </LegalchainPanel>

        <div class="space-y-6">
          <LegalchainPanel
            eyebrow="Order summary"
            title="Current purchase draft"
            description="The handoff now starts from a server-side payment reference, not from a client-only link."
          >
            <LegalchainValueList
              items={[
                { label: "Selected pack", value: selectedPlan.name, tone: "light" },
                { label: "Token amount", value: selectedPlan.tokens },
                { label: "Estimated chain cost", value: selectedPlan.eth },
                { label: "Card reserve", value: "$5" },
              ]}
            />
            <div class="mt-5 rounded-[24px] border border-white/8 bg-white/[0.05] p-5">
              <div class="text-[10px] uppercase tracking-[0.24em] text-white/40">Amount to pay</div>
              <div class="mt-3 text-4xl font-black text-white">$80</div>
              <p class="mt-2 text-sm leading-7 text-white/62">
                The backend locks the selected plan, stores the reference in Turso and then resolves to Stripe or sandbox.
              </p>
            </div>
          </LegalchainPanel>

          <LegalchainPanel eyebrow="Purchase checklist" title="Before checkout">
            <LegalchainChecklist
              items={[
                {
                  title: "Confirm the operating profile",
                  text: "Use the same entity that will later own the record, preview and NFT evidence.",
                },
                {
                  title: "Keep gas visible",
                  text: "The route still surfaces an extra reserve so treasury expectations are clear before payment.",
                },
                {
                  title: "Checkout remains server-issued",
                  text: "The selected pack becomes a real payment record before any redirect happens.",
                },
              ]}
            />

            <div class="mt-5">
              <Link
                href="/payments"
                class="rounded-full border border-white/12 bg-white/[0.08] px-4 py-3 text-center text-sm font-semibold text-white"
              >
                Open treasury ledger
              </Link>
            </div>
          </LegalchainPanel>
        </div>
      </div>
    </LegalchainPageShell>
  );
});

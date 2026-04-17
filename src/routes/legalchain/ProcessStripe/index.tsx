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
  confirmLegalchainSandboxPayment,
  hasLegalchainStripeConfigured,
  syncLegalchainCheckoutStatus,
} from "~/lib/legalchain/payments";
import {
  getCurrentLegalchainUser,
  getLatestLegalchainPaymentByUserId,
  getLegalchainPaymentByReference,
  type LegalchainPaymentRow,
} from "~/lib/legalchain/store";

export const useProcessStripeLoader = routeLoader$(async (event) => {
  const user = await getCurrentLegalchainUser(event);
  if (!user) {
    throw event.redirect(302, "/auth?mode=login");
  }

  const reference = event.url.searchParams.get("ref")?.trim() || "";
  const sessionId = event.url.searchParams.get("session_id")?.trim() || "";
  const checkoutState = event.url.searchParams.get("checkout")?.trim() || "";
  let payment: LegalchainPaymentRow | null = reference
    ? await getLegalchainPaymentByReference(reference, user.id)
    : await getLatestLegalchainPaymentByUserId(user.id);

  if (payment && (sessionId || checkoutState === "success")) {
    payment =
      (await syncLegalchainCheckoutStatus({
        reference: payment.reference,
        userId: user.id,
        sessionId,
      })) ?? payment;
  }

  return {
    user,
    checkoutState,
    payment,
    stripeConfigured: hasLegalchainStripeConfigured(),
  };
});

export const useSandboxPaymentAction = routeAction$(async (form, event) => {
  const user = await getCurrentLegalchainUser(event);
  if (!user) {
    throw event.redirect(302, "/auth?mode=login");
  }

  const reference = String(form.reference ?? "").trim();
  if (!reference) {
    return {
      ok: false,
      error: "Missing payment reference.",
    };
  }

  await confirmLegalchainSandboxPayment({
    reference,
    userId: user.id,
  });

  throw event.redirect(302, `/ProcessStripe?ref=${encodeURIComponent(reference)}&checkout=success`);
});

export default component$(() => {
  const { checkoutState, payment, stripeConfigured } = useProcessStripeLoader().value;
  const sandboxAction = useSandboxPaymentAction();
  const details = payment?.detailsJson ?? {};
  const checkoutUrl = String(details.checkoutUrl ?? "");
  const paymentStatus = String(details.paymentStatus ?? "");
  const sessionStatus = String(details.sessionStatus ?? "");
  const tokens = String(details.tokens ?? "");
  const estimatedChainCost = String(details.eth ?? "");
  const onchainStatus = String(details.onchainStatus ?? "");
  const onchainMessage = String(details.onchainMessage ?? "");
  const tokenTransferHash = String(details.tokenTransferHash ?? "");
  const gasTransferHash = String(details.gasTransferHash ?? "");
  const isApproved = payment?.status === "Approved";
  const isPending = payment?.status === "Pending";
  const isReview = payment?.status === "Review";

  return (
    <LegalchainPageShell
      eyebrow="Stripe flow"
      title="Process Stripe"
      description="This route now tracks a real Legalchain payment reference and reconciles Stripe checkout state back into Turso."
      actions={[
        { label: "Back to payments", href: "/payments" },
        { label: "Review packs", href: "/buy-token" },
      ]}
    >
      <LegalchainStatGrid
        items={[
          {
            label: "Session mode",
            value: stripeConfigured ? "Stripe hosted" : "Sandbox",
            hint: "The server decides whether to use Stripe checkout or the internal sandbox flow.",
          },
          {
            label: "Reference",
            value: payment?.reference || "Pending",
            hint: "This reference ties the UI, treasury ledger and provider callback together.",
          },
          {
            label: "Charge",
            value: payment?.amount || "$0",
            hint: "The amount is frozen when the checkout record is created.",
          },
          {
            label: "Status",
            value: payment?.status || "Draft",
            hint: "Status is derived from Stripe session state or sandbox confirmation.",
          },
        ]}
      />

      <div class="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <LegalchainPanel
          eyebrow="Checkout"
          title="Secure payment handoff"
          description="This panel now reflects the actual payment reference, checkout URL and Stripe return state instead of a placeholder mount only."
        >
          <div class="rounded-[30px] border border-dashed border-white/15 bg-[#100619]/88 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div class="text-lg font-black text-white">
                  {payment ? `${payment.flow} checkout` : "Checkout not started"}
                </div>
                <p class="mt-2 max-w-xl text-sm leading-7 text-white/62">
                  {payment
                    ? `Reference ${payment.reference} is now the canonical payment record for this token purchase.`
                    : "Create a checkout from Buy Token to start a real payment session."}
                </p>
              </div>
              <LegalchainPill
                label={payment?.status || "Draft"}
                tone={isApproved ? "success" : isReview ? "warning" : "default"}
              />
            </div>

            <div class="mt-6 grid gap-4 md:grid-cols-3">
              {[
                ["Provider", stripeConfigured ? "Stripe" : "Sandbox"],
                ["Payment status", paymentStatus || "pending"],
                ["Session state", sessionStatus || checkoutState || "draft"],
                ["Base settlement", onchainStatus || "pending-payment"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  class="rounded-[22px] border border-white/8 bg-white/[0.05] px-4 py-4 text-center"
                >
                  <div class="text-[10px] uppercase tracking-[0.22em] text-white/38">{label}</div>
                  <div class="mt-2 text-sm font-black text-white">{value}</div>
                </div>
              ))}
            </div>

            <div class="mt-6 grid min-h-[320px] place-items-center rounded-[24px] bg-[radial-gradient(circle_at_top,rgba(126,15,132,0.2),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.01))] text-center">
              <div class="max-w-md space-y-4 px-6">
                <div class="text-[11px] font-black uppercase tracking-[0.28em] text-white/42">Payment status</div>
                {payment ? (
                  <>
                    <div class="text-2xl font-black text-white">
                      {isApproved ? "Payment reconciled" : isPending ? "Awaiting payment" : "Needs review"}
                    </div>
                    <p class="text-sm leading-7 text-white/62">
                      {isApproved
                        ? onchainMessage || "Treasury has a confirmed record and the payment ledger is already updated."
                        : stripeConfigured
                          ? "Open the hosted Stripe page to complete the payment and then return here."
                          : "Use sandbox mode to simulate a successful charge while backend work continues."}
                    </p>
                    {stripeConfigured && checkoutUrl && !isApproved ? (
                      <a
                        href={checkoutUrl}
                        class="inline-flex rounded-full bg-white px-4 py-3 text-sm font-black uppercase tracking-[0.22em] text-[#7e0f84]"
                      >
                        Open Stripe checkout
                      </a>
                    ) : !stripeConfigured && payment && !isApproved ? (
                      <Form action={sandboxAction}>
                        <input type="hidden" name="reference" value={payment.reference} />
                        <button
                          type="submit"
                          class="inline-flex rounded-full bg-white px-4 py-3 text-sm font-black uppercase tracking-[0.22em] text-[#7e0f84]"
                        >
                          {sandboxAction.isRunning ? "Confirming..." : "Mark sandbox payment as paid"}
                        </button>
                      </Form>
                    ) : null}
                  </>
                ) : (
                  <>
                    <div class="text-2xl font-black text-white">Payment element goes here</div>
                    <p class="text-sm leading-7 text-white/62">
                      Start in Buy Token to create a payment reference, then return here for the provider handoff.
                    </p>
                    <Link
                      href="/buy-token"
                      class="inline-flex rounded-full bg-white px-4 py-3 text-sm font-black uppercase tracking-[0.22em] text-[#7e0f84]"
                    >
                      Open buy token
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </LegalchainPanel>

        <div class="space-y-6">
          <LegalchainPanel eyebrow="Order summary" title="Immutable charge data">
            <LegalchainValueList
              items={[
                { label: "Package", value: payment?.flow || "Pending", tone: payment ? "light" : undefined },
                { label: "Tokens", value: tokens || "Pending" },
                { label: "Estimated chain cost", value: estimatedChainCost || "Pending" },
                { label: "Provider reference", value: payment?.providerReference || "None yet" },
                { label: "Base settlement", value: onchainStatus || "Pending payment" },
                { label: "ERC20 tx", value: tokenTransferHash || "Waiting" },
                { label: "Gas tx", value: gasTransferHash || "Waiting" },
              ]}
            />
            <div class="mt-5 grid gap-3 sm:grid-cols-2">
              <Link
                href="/payments"
                class="rounded-full border border-white/12 bg-white/[0.08] px-4 py-3 text-center text-sm font-semibold text-white"
              >
                Return to payments
              </Link>
              <Link
                href="/buy-token"
                class="rounded-full bg-white px-4 py-3 text-center text-sm font-black uppercase tracking-[0.22em] text-[#7e0f84]"
              >
                Change package
              </Link>
            </div>
          </LegalchainPanel>

          <LegalchainPanel eyebrow="Rules" title="Backend responsibilities">
            <LegalchainChecklist
              items={[
                {
                  title: "Server creates the checkout reference",
                  text: "Each token purchase now writes to Turso before any redirect to Stripe or sandbox happens.",
                },
                {
                  title: "Provider state syncs back into treasury",
                  text: "Return URLs and webhook reconciliation update the same payment record used by the ledger.",
                },
                {
                  title: "No amount mutation in the browser",
                  text: "Package, amount and metadata stay frozen once the Legalchain reference is created.",
                },
              ]}
            />
          </LegalchainPanel>
        </div>
      </div>
    </LegalchainPageShell>
  );
});

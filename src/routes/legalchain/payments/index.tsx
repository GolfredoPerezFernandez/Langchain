import { component$ } from "@builder.io/qwik";
import { Form, Link, routeAction$, routeLoader$ } from "@builder.io/qwik-city";
import { LegalchainPageShell } from "~/components/legalchain/page-shell";
import {
  LegalchainPanel,
  LegalchainPill,
  LegalchainStatGrid,
  LegalchainTable,
  LegalchainValueList,
} from "~/components/legalchain/ui";
import {
  getCurrentLegalchainUser,
  listLegalchainPayments,
  type LegalchainPaymentRow,
} from "~/lib/legalchain/store";

const getOnchainStatus = (payment: LegalchainPaymentRow) =>
  String(payment.detailsJson.onchainStatus ?? (payment.status === "Approved" ? "queued" : "pending-payment"));

const getOnchainTone = (status: string) => {
  if (status === "completed") {
    return "success";
  }

  if (status === "pending-config" || status === "token-transferred") {
    return "warning";
  }

  if (status === "failed" || status === "partial") {
    return "danger";
  }

  return "default";
};

export const usePaymentsLoader = routeLoader$(async (event) => {
  const user = await getCurrentLegalchainUser(event);
  if (!user) {
    throw event.redirect(302, "/auth?mode=login");
  }

  const payments = await listLegalchainPayments(user.id);
  return { user, payments };
});

export const useRetrySettlementAction = routeAction$(async (form, event) => {
  const { settleLegalchainApprovedPayment } = await import("~/lib/legalchain/payments.server");
  const user = await getCurrentLegalchainUser(event);
  if (!user) {
    throw event.redirect(302, "/auth?mode=login");
  }

  const reference = String(form.reference ?? "").trim();
  if (!reference) {
    return {
      error: "Missing payment reference.",
      ok: false,
    };
  }

  const payment = await settleLegalchainApprovedPayment({
    reference,
    userId: user.id,
  });

  if (!payment) {
    return {
      error: "Payment reference not found.",
      ok: false,
    };
  }

  return {
    message: String(payment.detailsJson.onchainMessage ?? "Treasury settlement refreshed."),
    ok: true,
    status: String(payment.detailsJson.onchainStatus ?? ""),
  };
});

export default component$(() => {
  const { payments } = usePaymentsLoader().value;
  const retrySettlementAction = useRetrySettlementAction();
  const paymentRows: LegalchainPaymentRow[] = payments;
  const pendingPayments = paymentRows.filter((payment: LegalchainPaymentRow) => payment.status !== "Approved");
  const approvedPayments = paymentRows.filter((payment: LegalchainPaymentRow) => payment.status === "Approved");
  const reviewPayments = paymentRows.filter((payment: LegalchainPaymentRow) => payment.status === "Review");
  const actionRequiredPayments = paymentRows.filter(
    (payment: LegalchainPaymentRow) => payment.status !== "Approved" && payment.status !== "Review",
  );
  const settledOnBasePayments = approvedPayments.filter(
    (payment: LegalchainPaymentRow) => getOnchainStatus(payment) === "completed",
  );
  const trackedVolume = paymentRows.reduce((total: number, payment: LegalchainPaymentRow) => {
    const numericAmount = Number(payment.amount.replace(/[^\d.]/g, ""));
    return total + (Number.isFinite(numericAmount) ? numericAmount : 0);
  }, 0);

  return (
    <LegalchainPageShell
      eyebrow="Treasury route"
      title="Payments"
      description="Legalchain keeps payments split between items that still need action and items already reconciled. The Qwik version now mirrors that operator workflow instead of showing a placeholder ledger."
      actions={[
        { label: "Process Stripe", href: "/ProcessStripe" },
        { label: "Buy token", href: "/buy-token" },
      ]}
    >
      <LegalchainStatGrid
        items={[
          {
            label: "Pending",
            value: `${pendingPayments.length}`.padStart(2, "0"),
            hint: "Waiting on bank validation, proof review or final approval.",
          },
          {
            label: "Settled on Base",
            value: `${settledOnBasePayments.length}`.padStart(2, "0"),
            hint: "Payments that already delivered the token package and gas top-up onchain.",
          },
          {
            label: "Tracked volume",
            value: `$${trackedVolume.toFixed(0)}`,
            hint: "Combined volume across current legal evidence flows.",
          },
          {
            label: "Next action",
            value: "Review",
            hint: "Operators can jump from any payment into Stripe or record history.",
          },
        ]}
      />

      <div class="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <LegalchainPanel
          eyebrow="Pending queue"
          title="Payments waiting on action"
          description="The original product exposed pending payments first. That ordering stays intact here so treasury work starts with the unresolved items."
        >
          {pendingPayments.length > 0 ? (
            <div class="space-y-4">
              {pendingPayments.map((payment) => (
                <article
                  key={payment.reference}
                  class="rounded-[24px] border border-white/10 bg-white/[0.05] p-5"
                >
                  <div class="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div class="text-[10px] font-black uppercase tracking-[0.28em] text-white/40">
                        Ref {payment.reference}
                      </div>
                      <h2 class="mt-2 text-lg font-black text-white">{payment.flow}</h2>
                      <p class="mt-2 text-sm leading-7 text-white/62">
                        Requested {payment.requestedAt} through {payment.method}.
                      </p>
                    </div>
                    <LegalchainPill
                      label={payment.status}
                      tone={payment.status === "Review" ? "warning" : "danger"}
                    />
                  </div>

                  <div class="mt-5 grid gap-3 md:grid-cols-3">
                    <div class="rounded-[20px] bg-white/[0.05] px-4 py-3">
                      <div class="text-[10px] uppercase tracking-[0.24em] text-white/38">Amount</div>
                      <div class="mt-2 text-sm font-semibold text-white">{payment.amount}</div>
                    </div>
                    <div class="rounded-[20px] bg-white/[0.05] px-4 py-3">
                      <div class="text-[10px] uppercase tracking-[0.24em] text-white/38">Method</div>
                      <div class="mt-2 text-sm font-semibold text-white">{payment.method}</div>
                    </div>
                    <div class="rounded-[20px] bg-white/[0.05] px-4 py-3">
                      <div class="text-[10px] uppercase tracking-[0.24em] text-white/38">Route</div>
                      <div class="mt-2 text-sm font-semibold text-white">
                        {String(payment.detailsJson.onchainMessage ?? "Treasury review")}
                      </div>
                    </div>
                  </div>
                  <div class="mt-4 flex flex-wrap gap-3">
                    <LegalchainPill
                      label={`Base ${getOnchainStatus(payment)}`}
                      tone={getOnchainTone(getOnchainStatus(payment))}
                    />
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p class="text-sm leading-7 text-white/62">
              No pending payments yet. This queue will fill as checkout and treasury flows come online.
            </p>
          )}
        </LegalchainPanel>

        <div class="space-y-6">
          <LegalchainPanel
            eyebrow="Completed"
            title="Reconciled payments"
            description="Completed items remain close by for audit and support, but they no longer compete with the unresolved queue."
          >
            {approvedPayments.length > 0 ? (
              <div class="space-y-4">
                {approvedPayments.map((payment) => (
                  <div
                    key={payment.reference}
                    class="rounded-[24px] border border-white/8 bg-white/[0.04] p-5"
                  >
                    <div class="flex items-start justify-between gap-4">
                      <div>
                        <div class="text-[10px] uppercase tracking-[0.24em] text-white/38">
                          Ref {payment.reference}
                        </div>
                        <div class="mt-2 text-base font-black text-white">{payment.flow}</div>
                      </div>
                      <div class="flex flex-wrap gap-2">
                        <LegalchainPill label="Approved" tone="success" />
                        <LegalchainPill
                          label={`Base ${getOnchainStatus(payment)}`}
                          tone={getOnchainTone(getOnchainStatus(payment))}
                        />
                      </div>
                    </div>

                    <p class="mt-3 text-sm leading-7 text-white/62">
                      {payment.amount} captured with {payment.method} on {payment.requestedAt}.
                    </p>
                    <p class="mt-2 text-xs leading-6 text-white/45">
                      {String(payment.detailsJson.onchainMessage ?? "Waiting for treasury settlement state.")}
                    </p>
                    {getOnchainStatus(payment) !== "completed" ? (
                      <Form action={retrySettlementAction} class="mt-4">
                        <input type="hidden" name="reference" value={payment.reference} />
                        <button
                          type="submit"
                          class="rounded-full border border-white/12 bg-white/[0.08] px-4 py-3 text-xs font-black uppercase tracking-[0.22em] text-white"
                        >
                          {retrySettlementAction.isRunning ? "Retrying..." : "Retry Base settlement"}
                        </button>
                      </Form>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p class="text-sm leading-7 text-white/62">
                Approved payments will appear here once a checkout flow is completed and reconciled.
              </p>
            )}
          </LegalchainPanel>

          <LegalchainPanel eyebrow="Treasury snapshot" title="Current status">
            <LegalchainValueList
              items={[
                { label: "Stripe approved", value: `${approvedPayments.length}` },
                { label: "Settled on Base", value: `${settledOnBasePayments.length}`, tone: "success" },
                { label: "Manual review", value: `${reviewPayments.length}`, tone: "warning" },
                { label: "Pending bank proof", value: `${actionRequiredPayments.length}`, tone: "danger" },
                { label: "Checkout route", value: "Process Stripe", tone: "light" },
              ]}
            />
            <div class="mt-5 grid gap-3 sm:grid-cols-2">
              <Link
                href="/ProcessStripe"
                class="rounded-full bg-white px-4 py-3 text-center text-sm font-black uppercase tracking-[0.22em] text-[#7e0f84]"
              >
                Open checkout
              </Link>
              <Link
                href="/history"
                class="rounded-full border border-white/12 bg-white/[0.08] px-4 py-3 text-center text-sm font-semibold text-white"
              >
                Review records
              </Link>
            </div>
          </LegalchainPanel>
        </div>
      </div>

      <LegalchainPanel
        eyebrow="Ledger"
        title="Payment register"
        description="Compact register for operators who prefer a dense table over the card view."
      >
        {paymentRows.length > 0 ? (
          <LegalchainTable
            columns={["Reference", "Flow", "Status", "Onchain", "Amount", "Method"]}
            rows={paymentRows.map((payment: LegalchainPaymentRow) => [
              payment.reference,
              payment.flow,
              {
                label: payment.status,
                tone:
                  payment.status === "Approved"
                    ? "success"
                    : payment.status === "Review"
                      ? "warning"
                      : "danger",
              },
              {
                label: getOnchainStatus(payment),
                tone: getOnchainTone(getOnchainStatus(payment)),
              },
              payment.amount,
              payment.method,
            ])}
          />
        ) : (
          <p class="text-sm leading-7 text-white/62">
            The payment ledger is empty until the first real checkout is recorded.
          </p>
        )}
        {retrySettlementAction.value?.ok === false ? (
          <p class="mt-4 text-sm text-[#ff9ce8]">{retrySettlementAction.value.error}</p>
        ) : null}
        {retrySettlementAction.value?.ok ? (
          <p class="mt-4 text-sm text-[#aefccf]">
            {retrySettlementAction.value.message} ({retrySettlementAction.value.status || "updated"})
          </p>
        ) : null}
      </LegalchainPanel>
    </LegalchainPageShell>
  );
});

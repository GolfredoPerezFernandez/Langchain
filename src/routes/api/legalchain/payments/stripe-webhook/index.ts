import type { RequestHandler } from "@builder.io/qwik-city";
import Stripe from "stripe";
import { settleLegalchainApprovedPayment } from "../../../../../lib/legalchain/payments.server";
import { getServerEnv } from "../../../../../lib/server-env";
import { getLegalchainPaymentByReference, upsertLegalchainPayment } from "../../../../../lib/legalchain/store";

const resolveStripeSecretKey = () =>
  getServerEnv("PRIVATE_STRIPE_SECRET_KEY") ||
  getServerEnv("STRIPE_SECRET_KEY") ||
  "";

let stripeClient: Stripe | null = null;

const getStripe = () => {
  const secretKey = resolveStripeSecretKey();
  if (!secretKey) {
    return null;
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      maxNetworkRetries: 1,
      timeout: 20_000,
    });
  }

  return stripeClient;
};

const mapStripeStatusToLegalchain = (paymentStatus: string, sessionStatus: string) => {
  if (paymentStatus === "paid" || sessionStatus === "complete") {
    return "Approved";
  }

  if (sessionStatus === "expired") {
    return "Review";
  }

  return "Pending";
};

export const onPost: RequestHandler = async (event) => {
  const stripe = getStripe();
  const webhookSecret =
    event.env.get("PRIVATE_STRIPE_WEBHOOK_SECRET") ||
    event.env.get("STRIPE_WEBHOOK_SECRET") ||
    getServerEnv("PRIVATE_STRIPE_WEBHOOK_SECRET") ||
    getServerEnv("STRIPE_WEBHOOK_SECRET") ||
    "";

  if (!stripe || !webhookSecret) {
    event.json(400, { ok: false, error: "Stripe webhook is not configured." });
    return;
  }

  const signature = event.request.headers.get("stripe-signature");
  if (!signature) {
    event.json(400, { ok: false, error: "Missing Stripe signature." });
    return;
  }

  const payload = await event.request.text();

  try {
    const stripeEvent = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

    if (
      stripeEvent.type === "checkout.session.completed" ||
      stripeEvent.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = stripeEvent.data.object as Stripe.Checkout.Session;
      const reference = String(session.client_reference_id ?? session.metadata?.reference ?? "");
      if (reference) {
        const payment = await getLegalchainPaymentByReference(reference);
        if (payment) {
          const nextPayment = await upsertLegalchainPayment({
            reference: payment.reference,
            userId: payment.userId,
            flow: payment.flow,
            status: mapStripeStatusToLegalchain(String(session.payment_status ?? ""), String(session.status ?? "")),
            amount: payment.amount,
            method: "Stripe hosted",
            requestedAt: payment.requestedAt,
            providerReference: String(session.id),
            detailsJson: {
              ...payment.detailsJson,
              checkoutUrl: String(session.url ?? payment.detailsJson.checkoutUrl ?? ""),
              paymentStatus: String(session.payment_status ?? ""),
              sessionStatus: String(session.status ?? ""),
              webhookEventId: stripeEvent.id,
            },
          });

          if (nextPayment?.status === "Approved") {
            await settleLegalchainApprovedPayment({
              reference: nextPayment.reference,
              userId: nextPayment.userId,
            });
          }
        }
      }
    }

    event.json(200, { ok: true });
  } catch (error) {
    event.json(400, {
      ok: false,
      error: error instanceof Error ? error.message : "Invalid webhook.",
    });
  }
};

import type { RequestEventBase } from "@builder.io/qwik-city";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { getPublicEnv, getServerEnv } from "../server-env";
import {
  getLegalchainTokenPlanById,
  resolveStripeSecretKey,
} from "./payments";
import {
  hasLegalchainTreasuryConfigured,
  topUpLegalchainGasFromTreasury,
  transferLegalchainTokensFromTreasury,
} from "./web3";
import type { LegalchainUser } from "./store";
import {
  getLegalchainWalletByUserId,
  getLegalchainPaymentByReference,
  upsertLegalchainPayment,
  type LegalchainPaymentRow,
} from "./store";

const sanitizeOrigin = (event: RequestEventBase) => {
  const configured =
    getPublicEnv("PUBLIC_APP_URL") ||
    getPublicEnv("PUBLIC_SITE_URL") ||
    getServerEnv("LEGALCHAIN_APP_URL") ||
    "";

  if (configured) {
    return configured.replace(/\/$/, "");
  }

  return event.url.origin.replace(/\/$/, "");
};

let stripeClient: Stripe | null = null;

const getStripe = () => {
  const secretKey = resolveStripeSecretKey();
  if (!secretKey) {
    return null;
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      appInfo: {
        name: "Legalchain Qwik",
        url: "https://legalchain.local",
      },
      maxNetworkRetries: 1,
      timeout: 20_000,
    });
  }

  return stripeClient;
};

const parseUsdAmountToCents = (amount: string) => {
  const numericAmount = Number(amount.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error(`Invalid payment amount: ${amount}`);
  }

  return Math.round(numericAmount * 100);
};

const createStripeCheckoutSession = async (input: {
  amountCents: number;
  description: string;
  event: RequestEventBase;
  planId: string;
  planName: string;
  reference: string;
  user: LegalchainUser;
}) => {
  const stripe = getStripe();
  if (!stripe) {
    return null;
  }

  const appOrigin = sanitizeOrigin(input.event);
  const data = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: `${appOrigin}/ProcessStripe?ref=${encodeURIComponent(input.reference)}&checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appOrigin}/ProcessStripe?ref=${encodeURIComponent(input.reference)}&checkout=cancel`,
    client_reference_id: input.reference,
    customer_email: input.user.email,
    metadata: {
      userId: input.user.id,
      reference: input.reference,
      planId: input.planId,
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: input.amountCents,
          product_data: {
            name: `Legalchain ${input.planName}`,
            description: input.description,
          },
        },
      },
    ],
  });

  return {
    id: String(data.id),
    paymentStatus: String(data.payment_status ?? ""),
    status: String(data.status ?? ""),
    url: String(data.url ?? ""),
  };
};

const retrieveStripeCheckoutSession = async (sessionId: string) => {
  const stripe = getStripe();
  if (!stripe || !sessionId) {
    return null;
  }

  const data = await stripe.checkout.sessions.retrieve(sessionId);

  return {
    paymentStatus: String(data.payment_status ?? ""),
    status: String(data.status ?? ""),
    url: String(data.url ?? ""),
  };
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

const nowIso = () => new Date().toISOString();

const parseTokenAmountLabel = (value: string) => {
  const normalized = value.trim().toLowerCase().replace(/,/g, "").replace(/\s+lc$/, "");
  const match = /^(\d+(?:\.\d+)?)(k)?$/.exec(normalized);
  if (!match) {
    return "";
  }

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) {
    return "";
  }

  return match[2] ? String(amount * 1000) : match[1];
};

const parseEthAmountLabel = (value: string) => {
  const match = /(\d+(?:\.\d+)?)/.exec(value.trim().toLowerCase());
  if (!match) {
    return "";
  }

  const amount = Number(match[1]);
  return Number.isFinite(amount) && amount > 0 ? match[1] : "";
};

const patchLegalchainPayment = async (
  payment: LegalchainPaymentRow,
  detailsPatch: Record<string, unknown>,
  status = payment.status,
) => {
  return await upsertLegalchainPayment({
    reference: payment.reference,
    userId: payment.userId,
    flow: payment.flow,
    status,
    amount: payment.amount,
    method: payment.method,
    requestedAt: payment.requestedAt,
    providerReference: payment.providerReference,
    detailsJson: {
      ...payment.detailsJson,
      ...detailsPatch,
    },
  });
};

const resolveGasTopUpEth = (payment: LegalchainPaymentRow) =>
  (
    getServerEnv("PRIVATE_LEGALCHAIN_GAS_TOPUP_ETH") ||
    getServerEnv("LEGALCHAIN_GAS_TOPUP_ETH") ||
    parseEthAmountLabel(String(payment.detailsJson.eth ?? ""))
  ).trim();

const toErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export const settleLegalchainApprovedPayment = async (input: {
  reference: string;
  userId?: string | null;
}) => {
  const payment = await getLegalchainPaymentByReference(input.reference, input.userId);
  if (!payment || payment.status !== "Approved") {
    return payment;
  }

  const existingDetails = payment.detailsJson ?? {};
  const existingTokenTransferHash = String(existingDetails.tokenTransferHash ?? "");
  const existingGasTransferHash = String(existingDetails.gasTransferHash ?? "");
  const existingOnchainStatus = String(existingDetails.onchainStatus ?? "");

  if (existingOnchainStatus === "completed" && existingTokenTransferHash) {
    return payment;
  }

  const userWallet = await getLegalchainWalletByUserId(payment.userId);
  if (!userWallet) {
    return (
      (await patchLegalchainPayment(payment, {
        onchainError: "User wallet not found for treasury settlement.",
        onchainMessage: "Treasury settlement could not start because the custodial wallet is missing.",
        onchainStatus: "failed",
        onchainUpdatedAt: nowIso(),
      })) ?? payment
    );
  }

  const tokenAmount = parseTokenAmountLabel(String(existingDetails.tokens ?? ""));
  const gasTopUpEth = resolveGasTopUpEth(payment);

  if (!tokenAmount) {
    return (
      (await patchLegalchainPayment(payment, {
        onchainError: "Token package could not be parsed for treasury settlement.",
        onchainMessage: "Settlement is blocked until the token amount is valid.",
        onchainStatus: "failed",
        onchainUpdatedAt: nowIso(),
      })) ?? payment
    );
  }

  if (!hasLegalchainTreasuryConfigured()) {
    return (
      (await patchLegalchainPayment(payment, {
        gasTopUpEth,
        onchainError: "",
        onchainMessage: "Stripe is approved. Treasury settlement is waiting for Base env configuration.",
        onchainStatus: "pending-config",
        onchainUpdatedAt: nowIso(),
        tokenAmount,
      })) ?? payment
    );
  }

  let latestPayment = payment;
  let latestTokenTransferHash = existingTokenTransferHash;
  let latestGasTransferHash = existingGasTransferHash;

  if (!latestTokenTransferHash) {
    try {
      const transfer = await transferLegalchainTokensFromTreasury({
        paymentReference: payment.reference,
        recipientAddress: userWallet.address as `0x${string}`,
        recipientWalletId: userWallet.id,
        tokenAmount,
        userId: payment.userId,
      });

      latestTokenTransferHash = transfer.hash;
      latestPayment =
        (await patchLegalchainPayment(latestPayment, {
          gasTopUpEth,
          onchainError: "",
          onchainMessage: gasTopUpEth
            ? "Token transfer submitted. Gas top-up is the remaining treasury step."
            : "Treasury settlement completed with token delivery.",
          onchainStatus: gasTopUpEth ? "token-transferred" : "completed",
          onchainUpdatedAt: nowIso(),
          settledAt: gasTopUpEth ? String(latestPayment.detailsJson.settledAt ?? "") : nowIso(),
          tokenAmount,
          tokenAmountUnits: transfer.amountUnits,
          tokenContract: transfer.tokenAddress,
          tokenTransferHash: transfer.hash,
        })) ?? latestPayment;
    } catch (error) {
      return (
        (await patchLegalchainPayment(latestPayment, {
          gasTopUpEth,
          onchainError: toErrorMessage(error, "Token transfer failed."),
          onchainMessage: "Treasury could not deliver the ERC20 package on Base.",
          onchainStatus: "failed",
          onchainUpdatedAt: nowIso(),
          tokenAmount,
        })) ?? latestPayment
      );
    }
  }

  if (!gasTopUpEth) {
    return (
      (await patchLegalchainPayment(latestPayment, {
        onchainError: "",
        onchainMessage: "Treasury settlement completed.",
        onchainStatus: "completed",
        onchainUpdatedAt: nowIso(),
        settledAt: nowIso(),
        tokenAmount,
        tokenTransferHash: latestTokenTransferHash,
      })) ?? latestPayment
    );
  }

  if (latestGasTransferHash) {
    return (
      (await patchLegalchainPayment(latestPayment, {
        gasTopUpEth,
        onchainError: "",
        onchainMessage: "Treasury settlement completed.",
        onchainStatus: "completed",
        onchainUpdatedAt: nowIso(),
        settledAt: String(latestPayment.detailsJson.settledAt ?? "") || nowIso(),
        tokenAmount,
        tokenTransferHash: latestTokenTransferHash,
      })) ?? latestPayment
    );
  }

  try {
    const gasTransfer = await topUpLegalchainGasFromTreasury({
      amountEth: gasTopUpEth,
      paymentReference: payment.reference,
      recipientAddress: userWallet.address as `0x${string}`,
      recipientWalletId: userWallet.id,
      userId: payment.userId,
    });

    latestGasTransferHash = gasTransfer?.hash ?? "";

    return (
      (await patchLegalchainPayment(latestPayment, {
        gasTopUpEth,
        gasTransferHash: latestGasTransferHash,
        onchainError: "",
        onchainMessage: "Treasury settlement completed.",
        onchainStatus: "completed",
        onchainUpdatedAt: nowIso(),
        settledAt: nowIso(),
        tokenAmount,
        tokenTransferHash: latestTokenTransferHash,
      })) ?? latestPayment
    );
  } catch (error) {
    return (
      (await patchLegalchainPayment(latestPayment, {
        gasTopUpEth,
        onchainError: toErrorMessage(error, "Gas top-up failed."),
        onchainMessage: "Token delivery succeeded, but the Base gas top-up still needs a retry.",
        onchainStatus: "partial",
        onchainUpdatedAt: nowIso(),
        tokenAmount,
        tokenTransferHash: latestTokenTransferHash,
      })) ?? latestPayment
    );
  }
};

export const createLegalchainCheckout = async (input: {
  event: RequestEventBase;
  planId: string;
  user: LegalchainUser;
}) => {
  const plan = getLegalchainTokenPlanById(input.planId);
  if (!plan) {
    throw new Error("Selected token package does not exist.");
  }

  const reference = `LC-${randomUUID().slice(0, 8).toUpperCase()}`;
  const amountCents = parseUsdAmountToCents(plan.amount);
  const description = `${plan.name} package for ${plan.tokens} with Base treasury support.`;
  const stripeSession = await createStripeCheckoutSession({
    amountCents,
    description,
    event: input.event,
    planId: plan.id,
    planName: plan.name,
    reference,
    user: input.user,
  });

  const payment = await upsertLegalchainPayment({
    reference,
    userId: input.user.id,
    flow: plan.name,
    status: stripeSession ? mapStripeStatusToLegalchain(stripeSession.paymentStatus, stripeSession.status) : "Pending",
    amount: plan.amount,
    method: stripeSession ? "Stripe hosted" : "Stripe sandbox",
    requestedAt: new Date().toISOString(),
    providerReference: stripeSession?.id ?? null,
    detailsJson: {
      amountCents,
      checkoutUrl: stripeSession?.url ?? "",
      eth: plan.eth,
      onchainMessage: "Waiting for payment approval before treasury settlement starts.",
      onchainStatus: "pending-payment",
      packageId: plan.id,
      paymentStatus: stripeSession?.paymentStatus ?? "sandbox-pending",
      sessionStatus: stripeSession?.status ?? "draft",
      tokens: plan.tokens,
    },
  });

  return {
    payment,
    plan,
    checkoutMode: stripeSession ? "stripe" : "sandbox",
    checkoutUrl: stripeSession?.url ?? "",
  };
};

export const syncLegalchainCheckoutStatus = async (input: {
  reference: string;
  userId: string;
  sessionId?: string | null;
}) => {
  const payment = await getLegalchainPaymentByReference(input.reference, input.userId);
  if (!payment) {
    throw new Error("Payment reference not found.");
  }

  const stripeSessionId =
    (input.sessionId && input.sessionId.trim()) ||
    payment.providerReference ||
    "";

  if (!stripeSessionId || !resolveStripeSecretKey()) {
    return payment;
  }

  const stripeSession = await retrieveStripeCheckoutSession(stripeSessionId);
  if (!stripeSession) {
    return payment;
  }

  const nextPayment = await upsertLegalchainPayment({
    reference: payment.reference,
    userId: payment.userId,
    flow: payment.flow,
    status: mapStripeStatusToLegalchain(stripeSession.paymentStatus, stripeSession.status),
    amount: payment.amount,
    method: payment.method,
    requestedAt: payment.requestedAt,
    providerReference: stripeSessionId,
    detailsJson: {
      ...payment.detailsJson,
      checkoutUrl: stripeSession.url || String(payment.detailsJson.checkoutUrl ?? ""),
      paymentStatus: stripeSession.paymentStatus,
      sessionStatus: stripeSession.status,
    },
  });

  if (nextPayment?.status === "Approved") {
    return (await settleLegalchainApprovedPayment({
      reference: nextPayment.reference,
      userId: nextPayment.userId,
    })) ?? nextPayment;
  }

  return nextPayment;
};

export const confirmLegalchainSandboxPayment = async (input: {
  reference: string;
  userId: string;
}) => {
  const payment = await getLegalchainPaymentByReference(input.reference, input.userId);
  if (!payment) {
    throw new Error("Payment reference not found.");
  }

  const nextPayment = await upsertLegalchainPayment({
    reference: payment.reference,
    userId: payment.userId,
    flow: payment.flow,
    status: "Approved",
    amount: payment.amount,
    method: payment.method,
    requestedAt: payment.requestedAt,
    providerReference: payment.providerReference,
    detailsJson: {
      ...payment.detailsJson,
      paymentStatus: "sandbox-paid",
      sandboxConfirmedAt: new Date().toISOString(),
      sessionStatus: "complete",
    },
  });

  return (
    (await settleLegalchainApprovedPayment({
      reference: nextPayment?.reference ?? payment.reference,
      userId: nextPayment?.userId ?? payment.userId,
    })) ?? nextPayment
  );
};

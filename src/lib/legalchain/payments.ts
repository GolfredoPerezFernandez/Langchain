import { getServerEnv } from "../server-env";

export interface LegalchainTokenPlan {
  id: string;
  name: string;
  amount: string;
  tokens: string;
  eth: string;
  badge: string;
  note: string;
  features: string[];
}

export const legalchainTokenPlans: LegalchainTokenPlan[] = [
  {
    id: "starter",
    name: "Starter",
    amount: "$25",
    tokens: "250 LC",
    eth: "0.007 ETH",
    badge: "Fast start",
    note: "Best for demos, short evidence captures and intake sessions.",
    features: [
      "Ideal for legal intro and onboarding flows.",
      "Enough balance for pilot reviews and one-off previews.",
      "Quickest path into Stripe checkout.",
    ],
  },
  {
    id: "standard",
    name: "Standard",
    amount: "$75",
    tokens: "900 LC",
    eth: "0.021 ETH",
    badge: "Most used",
    note: "Balanced package for recurring teams handling record, preview and payment approvals.",
    features: [
      "Fits weekly operations and template testing.",
      "Supports draft plus published evidence cycles.",
      "Pairs well with admin treasury review.",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    amount: "$150",
    tokens: "2.1k LC",
    eth: "0.043 ETH",
    badge: "High volume",
    note: "Recommended for firms handling heavy playback, revisions and multi-step reviews.",
    features: [
      "Built for larger review teams and repeated exports.",
      "Leaves headroom for manual chain verification and retries.",
      "Future-ready for viem based proof workflows.",
    ],
  },
];

/** Env-only; safe to import from isomorphic modules (no Stripe SDK). */
export const resolveStripeSecretKey = () =>
  getServerEnv("PRIVATE_STRIPE_SECRET_KEY") ||
  getServerEnv("STRIPE_SECRET_KEY") ||
  "";

export const hasLegalchainStripeConfigured = () => Boolean(resolveStripeSecretKey());

export const getLegalchainTokenPlanById = (planId: string) =>
  legalchainTokenPlans.find((plan) => plan.id === planId) ?? null;

type ServerEnvReader = {
  get(key: string): string | undefined;
};

const globalStore = globalThis as {
  __legalchainServerEnv?: Map<string, string>;
};

if (!globalStore.__legalchainServerEnv) {
  globalStore.__legalchainServerEnv = new Map<string, string>();
}

const SERVER_ENV_KEYS = [
  "ORIGIN",
  "PRIVATE_TURSO_DATABASE_URL",
  "TURSO_DATABASE_URL",
  "TURSO_URL",
  "PRIVATE_TURSO_AUTH_TOKEN",
  "TURSO_AUTH_TOKEN",
  "FLY_APP_NAME",
  "UPLOAD_DIR",
  "PRIVATE_LEGALCHAIN_WALLET_SECRET",
  "LEGALCHAIN_WALLET_SECRET",
  "PRIVATE_LEGALCHAIN_TREASURY_PRIVATE_KEY",
  "LEGALCHAIN_TREASURY_PRIVATE_KEY",
  "PRIVATE_LEGALCHAIN_CHAIN_ID",
  "PRIVATE_LEGALCHAIN_ERC20_ADDRESS",
  "LEGALCHAIN_ERC20_ADDRESS",
  "PRIVATE_LEGALCHAIN_ERC20_DECIMALS",
  "LEGALCHAIN_ERC20_DECIMALS",
  "PRIVATE_LEGALCHAIN_GAS_TOPUP_ETH",
  "LEGALCHAIN_GAS_TOPUP_ETH",
  "LEGALCHAIN_RPC_URL",
  "PRIVATE_LEGALCHAIN_RPC_URL",
  "TFHKA_API_URL",
  "TFHKA_USER",
  "TFHKA_PASSWORD",
  "TFHKA_SERIE",
  "TFHKA_UNIT",
  "TFHKA_TIPO_DOCUMENTO",
  "STORACHA_KEY",
  "STORACHA_PROOF",
  "PRIVATE_STRIPE_SECRET_KEY",
  "STRIPE_SECRET_KEY",
  "PRIVATE_STRIPE_WEBHOOK_SECRET",
  "STRIPE_WEBHOOK_SECRET",
  "PRIVATE_VAPID_KEY",
  "LEGALCHAIN_APP_URL",
];

export const initializeServerEnv = (env: ServerEnvReader) => {
  const store = globalStore.__legalchainServerEnv!;

  for (const key of SERVER_ENV_KEYS) {
    const value = env.get(key);
    if (typeof value === "string" && value.length > 0) {
      store.set(key, value);
    }
  }
};

export const getServerEnv = (key: string) => {
  return globalStore.__legalchainServerEnv?.get(key) ?? "";
};

export const getPublicEnv = (key: string) => {
  const env = import.meta.env as Record<string, string | boolean | undefined>;
  const value = env[key];
  return typeof value === "string" ? value : "";
};

export const isProductionEnv = () => {
  const env = import.meta.env as Record<string, boolean | string | undefined>;
  return Boolean(env.PROD);
};

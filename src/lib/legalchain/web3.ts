import type { Abi, Address, Hex } from "viem";
import { createPublicClient, createWalletClient, http, isAddress, parseEther, parseUnits, publicActions } from "viem";
import { base, baseSepolia, mainnet, sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { getPublicEnv, getServerEnv } from "../server-env";
import { abiContractERC20 } from "./abi";
import {
  completeLegalchainTransactionLog,
  createLegalchainTransactionLog,
  decryptLegalchainPrivateKey,
  failLegalchainTransactionLog,
  getLegalchainWalletByUserId,
} from "./store";

const supportedChains = {
  [base.id]: base,
  [baseSepolia.id]: baseSepolia,
  [mainnet.id]: mainnet,
  [sepolia.id]: sepolia,
} as const;

const safeJsonStringify = (value: unknown) =>
  JSON.stringify(value, (_, nestedValue) => (typeof nestedValue === "bigint" ? nestedValue.toString() : nestedValue));

const resolveChain = (chainId?: number) => {
  const requestedChainId =
    chainId ||
    Number.parseInt(getPublicEnv("PUBLIC_LEGALCHAIN_CHAIN_ID") || getServerEnv("PRIVATE_LEGALCHAIN_CHAIN_ID") || "8453", 10);

  return supportedChains[requestedChainId as keyof typeof supportedChains] ?? base;
};

const resolveRpcUrl = (chainId?: number) => {
  const chain = resolveChain(chainId);
  return (
    getServerEnv("PRIVATE_LEGALCHAIN_RPC_URL") ||
    getServerEnv("LEGALCHAIN_RPC_URL") ||
    chain.rpcUrls.default.http[0]
  );
};

const resolveTreasuryPrivateKey = () =>
  getServerEnv("PRIVATE_LEGALCHAIN_TREASURY_PRIVATE_KEY") ||
  getServerEnv("LEGALCHAIN_TREASURY_PRIVATE_KEY") ||
  "";

const resolveLegalchainErc20Address = () => {
  const value =
    getServerEnv("PRIVATE_LEGALCHAIN_ERC20_ADDRESS") ||
    getServerEnv("LEGALCHAIN_ERC20_ADDRESS") ||
    "";

  return isAddress(value) ? (value as Address) : null;
};

const resolveLegalchainTokenDecimals = () => {
  const rawValue =
    getServerEnv("PRIVATE_LEGALCHAIN_ERC20_DECIMALS") ||
    getServerEnv("LEGALCHAIN_ERC20_DECIMALS") ||
    "18";
  const parsed = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 18;
};

const getLegalchainTreasuryWalletClient = (chainId?: number) => {
  const privateKey = resolveTreasuryPrivateKey();
  if (!privateKey) {
    throw new Error("Missing PRIVATE_LEGALCHAIN_TREASURY_PRIVATE_KEY for treasury settlement.");
  }

  const account = privateKeyToAccount(privateKey as Hex);
  const chain = resolveChain(chainId);

  const client = createWalletClient({
    account,
    chain,
    transport: http(resolveRpcUrl(chain.id)),
  }).extend(publicActions);

  return { client, account, chain };
};

export const hasLegalchainTreasuryConfigured = () =>
  Boolean(resolveTreasuryPrivateKey() && resolveLegalchainErc20Address());

export const createLegalchainPublicClient = (chainId?: number) => {
  const chain = resolveChain(chainId);
  return createPublicClient({
    chain,
    transport: http(resolveRpcUrl(chain.id)),
    batch: {
      multicall: true,
    },
  });
};

export const getLegalchainWalletClientForUser = async (userId: string, chainId?: number) => {
  const wallet = await getLegalchainWalletByUserId(userId);
  if (!wallet) {
    throw new Error("Legalchain wallet not found for user.");
  }

  const privateKey = decryptLegalchainPrivateKey(wallet.encryptedPrivateKey);
  const account = privateKeyToAccount(privateKey as Hex);
  const chain = resolveChain(chainId ?? wallet.chainId);

  const client = createWalletClient({
    account,
    chain,
    transport: http(resolveRpcUrl(chain.id)),
  }).extend(publicActions);

  return { client, account, wallet, chain };
};

export const signMessageWithLegalchainWallet = async (userId: string, message: string) => {
  const { client, account, wallet, chain } = await getLegalchainWalletClientForUser(userId);

  const transactionId = await createLegalchainTransactionLog({
    userId,
    walletId: wallet.id,
    kind: "sign-message",
    chainId: chain.id,
    payloadJson: safeJsonStringify({ message }),
  });

  const signature = await client.signMessage({
    account,
    message,
  });

  await completeLegalchainTransactionLog(transactionId, signature);
  return {
    address: wallet.address,
    chainId: chain.id,
    signature,
  };
};

export const writeContractWithLegalchainWallet = async (input: {
  userId: string;
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
}) => {
  const { client, account, wallet, chain } = await getLegalchainWalletClientForUser(input.userId);

  const transactionId = await createLegalchainTransactionLog({
    userId: input.userId,
    walletId: wallet.id,
    kind: "contract-write",
    chainId: chain.id,
    contractAddress: input.address,
    payloadJson: safeJsonStringify({
      address: input.address,
      functionName: input.functionName,
      args: input.args ?? [],
      value: input.value?.toString() ?? null,
    }),
  });

  const { request } = await (client as any).simulateContract({
    account,
    address: input.address,
    abi: input.abi,
    functionName: input.functionName,
    args: input.args,
    value: input.value,
  });

  const hash = await (client as any).writeContract(request);
  await completeLegalchainTransactionLog(transactionId, hash);

  return {
    address: wallet.address,
    chainId: chain.id,
    hash,
  };
};

export const transferLegalchainTokensFromTreasury = async (input: {
  userId: string;
  recipientAddress: Address;
  recipientWalletId: string;
  paymentReference: string;
  tokenAmount: string;
  chainId?: number;
}) => {
  const tokenAddress = resolveLegalchainErc20Address();
  if (!tokenAddress) {
    throw new Error("Missing PRIVATE_LEGALCHAIN_ERC20_ADDRESS for treasury settlement.");
  }

  const decimals = resolveLegalchainTokenDecimals();
  const amountUnits = parseUnits(input.tokenAmount, decimals);
  const { client, account, chain } = getLegalchainTreasuryWalletClient(input.chainId);

  const transactionId = await createLegalchainTransactionLog({
    userId: input.userId,
    walletId: input.recipientWalletId,
    kind: "treasury-token-transfer",
    chainId: chain.id,
    toAddress: input.recipientAddress,
    contractAddress: tokenAddress,
    payloadJson: safeJsonStringify({
      paymentReference: input.paymentReference,
      tokenAddress,
      tokenAmount: input.tokenAmount,
      tokenAmountUnits: amountUnits.toString(),
    }),
  });

  try {
    const { request } = await (client as any).simulateContract({
      account,
      address: tokenAddress,
      abi: abiContractERC20,
      functionName: "transfer",
      args: [input.recipientAddress, amountUnits],
    });

    const hash = await (client as any).writeContract(request);
    await completeLegalchainTransactionLog(transactionId, hash);

    return {
      amountUnits: amountUnits.toString(),
      chainId: chain.id,
      hash,
      tokenAddress,
    };
  } catch (error) {
    await failLegalchainTransactionLog(transactionId);
    throw error;
  }
};

export const topUpLegalchainGasFromTreasury = async (input: {
  userId: string;
  recipientAddress: Address;
  recipientWalletId: string;
  paymentReference: string;
  amountEth: string;
  chainId?: number;
}) => {
  const normalizedAmount = input.amountEth.trim();
  if (!normalizedAmount) {
    return null;
  }

  const value = parseEther(normalizedAmount);
  if (value <= 0n) {
    return null;
  }

  const { client, account, chain } = getLegalchainTreasuryWalletClient(input.chainId);
  const transactionId = await createLegalchainTransactionLog({
    userId: input.userId,
    walletId: input.recipientWalletId,
    kind: "treasury-gas-topup",
    chainId: chain.id,
    toAddress: input.recipientAddress,
    payloadJson: safeJsonStringify({
      amountEth: normalizedAmount,
      paymentReference: input.paymentReference,
      value: value.toString(),
    }),
  });

  try {
    const hash = await client.sendTransaction({
      account,
      to: input.recipientAddress,
      value,
    });

    await completeLegalchainTransactionLog(transactionId, hash);

    return {
      amountEth: normalizedAmount,
      chainId: chain.id,
      hash,
      value: value.toString(),
    };
  } catch (error) {
    await failLegalchainTransactionLog(transactionId);
    throw error;
  }
};

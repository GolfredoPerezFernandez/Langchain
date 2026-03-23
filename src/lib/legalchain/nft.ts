import type { RequestEventBase } from "@builder.io/qwik-city";
import { decodeEventLog } from "viem";
import type { Address, Hex } from "viem";
import { abiContractERC721 } from "./abi";
import { byteCodeERC721 } from "./byteCode";
import {
  completeLegalchainTransactionLog,
  createLegalchainRecord,
  createLegalchainTransactionLog,
  getLegalchainCollectionByUserId,
  getLegalchainTemplateBySlug,
  getLegalchainUserById,
  upsertLegalchainCollection,
  verifyLegalchainPinForUser,
} from "./store";
import { uploadMetadataToStoracha } from "./storacha";
import { createLegalchainPublicClient, getLegalchainWalletClientForUser } from "./web3";

const normalizeHex = (value: string) => (value.startsWith("0x") ? value : `0x${value}`) as Hex;

const resolveCollectionName = (username: string, fullName: string) =>
  `${(username || fullName || "Legalchain").trim()} Legalchain`;

interface MintUploadResult {
  tokenURI: string;
  http: {
    token: string;
    image?: string;
  };
  imageCid?: string;
}

const findMintedTokenId = (
  receipt: { logs: readonly { address: Address; data: Hex; topics: readonly Hex[] }[] },
  collectionAddress: Address,
) => {
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== collectionAddress.toLowerCase()) {
      continue;
    }

    try {
      const decoded = decodeEventLog({
        abi: abiContractERC721,
        data: log.data,
        topics: log.topics as [Hex, ...Hex[]],
      });

      if (decoded.eventName === "Transfer") {
        const args = decoded.args as { tokenId?: bigint };
        if (typeof args.tokenId === "bigint") {
          return args.tokenId.toString();
        }
      }
    } catch {
      // Ignore logs from unrelated contracts.
    }
  }

  throw new Error("Mint transaction completed but token ID could not be parsed.");
};

export const ensureLegalchainCollection = async (userId: string) => {
  const existing = await getLegalchainCollectionByUserId(userId);
  if (existing) {
    return existing;
  }

  const user = await getLegalchainUserById(userId);
  if (!user) {
    throw new Error("Legalchain user not found.");
  }

  const { client, account, wallet, chain } = await getLegalchainWalletClientForUser(userId);
  const publicClient = createLegalchainPublicClient(chain.id);
  const collectionName = resolveCollectionName(user.username, user.fullName);

  const deploymentTransactionId = await createLegalchainTransactionLog({
    userId,
    walletId: wallet.id,
    kind: "contract-deploy",
    chainId: chain.id,
    payloadJson: JSON.stringify({
      name: collectionName,
      symbol: "LG",
    }),
  });

  const deploymentHash = await client.deployContract({
    abi: abiContractERC721,
    account,
    args: [account.address, collectionName, "LG"],
    bytecode: normalizeHex(byteCodeERC721),
  });

  await completeLegalchainTransactionLog(deploymentTransactionId, deploymentHash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: deploymentHash });
  if (!receipt.contractAddress) {
    throw new Error("Contract deployment succeeded but no collection address was returned.");
  }

  const collection = await upsertLegalchainCollection({
    userId,
    address: receipt.contractAddress,
    name: collectionName,
    symbol: "LG",
    deploymentHash,
    chainId: chain.id,
  });

  if (!collection) {
    throw new Error("Collection deployment succeeded but could not be persisted.");
  }

  return collection;
};

export interface MintLegalchainNftInput {
  userId: string;
  title: string;
  description?: string;
  templateSlug?: string;
  templateTitle?: string;
  duration?: string;
  visibility?: string;
  pin?: string;
  tokenURI?: string;
  image?: {
    bytes: number[];
    name?: string;
    type?: string;
  } | null;
  metadata?: Record<string, unknown>;
}

export const mintLegalchainNft = async (
  input: MintLegalchainNftInput,
  event?: Pick<RequestEventBase, "env">,
) => {
  await verifyLegalchainPinForUser(input.userId, input.pin);

  const user = await getLegalchainUserById(input.userId);
  if (!user) {
    throw new Error("Legalchain user not found.");
  }

  const template = input.templateSlug ? await getLegalchainTemplateBySlug(input.templateSlug) : null;
  const templateTitle = input.templateTitle || template?.title || "Proof of Record";
  const templateSlug = input.templateSlug || template?.slug || "proof-of-record";
  const providedStartDate = String(input.metadata?.startDateRecord ?? "").trim();
  const providedEndDate = String(input.metadata?.endDateRecord ?? "").trim();
  const startedAt = providedStartDate || new Date().toISOString();
  const endedAt = providedEndDate || startedAt;

  const baseMetadata = {
    name: input.title,
    title: input.title,
    description: input.description || template?.summary || "",
    templateSlug,
    templateTitle,
    startDateRecord: startedAt,
    endDateRecord: endedAt,
    attributes: [
      {
        trait_type: "birthday",
        value: Math.floor(Date.now() / 1000),
        display_type: "date",
      },
    ],
    ...(input.metadata ?? {}),
  } as Record<string, unknown>;

  const upload: MintUploadResult =
    input.tokenURI && input.tokenURI.trim()
      ? {
          tokenURI: input.tokenURI.trim(),
          http: {
            token: input.tokenURI.trim(),
            image: undefined,
          },
          imageCid: undefined,
        }
      : await uploadMetadataToStoracha(
          {
            metadata: baseMetadata,
            image:
              input.image && Array.isArray(input.image.bytes)
                ? {
                    bytes: input.image.bytes,
                    name: input.image.name,
                    type: input.image.type,
                  }
                : null,
          },
          event,
        );

  const metadata = {
    ...baseMetadata,
    image: upload.http.image || String(baseMetadata.image ?? ""),
  } as Record<string, unknown>;
  const resolvedMediaUrl =
    upload.http.image ||
    String(metadata.animation_url ?? metadata.external_url ?? metadata.image ?? "");

  const collection = await ensureLegalchainCollection(input.userId);
  const { client, account, wallet, chain } = await getLegalchainWalletClientForUser(input.userId, collection.chainId);
  const publicClient = createLegalchainPublicClient(chain.id);

  const mintTransactionId = await createLegalchainTransactionLog({
    userId: input.userId,
    walletId: wallet.id,
    kind: "nft-mint",
    chainId: chain.id,
    contractAddress: collection.address,
    payloadJson: JSON.stringify({
      to: account.address,
      tokenURI: upload.tokenURI,
      templateSlug,
      templateTitle,
    }),
  });

  const { request } = await client.simulateContract({
    account,
    address: collection.address as Address,
    abi: abiContractERC721,
    functionName: "safeMint",
    args: [account.address, upload.tokenURI],
  });

  const mintHash = await client.writeContract(request);
  await completeLegalchainTransactionLog(mintTransactionId, mintHash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: mintHash });
  const tokenId = findMintedTokenId(
    receipt as { logs: readonly { address: Address; data: Hex; topics: readonly Hex[] }[] },
    collection.address as Address,
  );

  const record = await createLegalchainRecord({
    userId: input.userId,
    hash: mintHash,
    title: input.title,
    templateSlug,
    templateTitle,
    tokenId,
    contractAddress: collection.address,
    collectionName: collection.name,
    tokenUri: upload.tokenURI,
    mediaUrl: resolvedMediaUrl,
    metadataJson: metadata,
    visibility: input.visibility,
    duration: input.duration,
    status: "Published",
    network: chain.name,
  });

  return {
    ok: true,
    chainId: chain.id,
    chainName: chain.name,
    collection,
    tokenId,
    txHash: mintHash,
    tokenURI: upload.tokenURI,
    gateway: upload.http,
    record,
  };
};

import type { RequestEventBase } from "@builder.io/qwik-city";
import * as Client from "@storacha/client";
import * as Proof from "@storacha/client/proof";
import * as Signer from "@storacha/client/principal/ed25519";
import { StoreMemory } from "@storacha/client/stores/memory";
import { getPublicEnv, getServerEnv } from "../server-env";

const ALLOWED_IMAGE_TYPES = new Set<string>([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "application/octet-stream",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/wav",
  "audio/ogg",
  "application/pdf",
]);

const MAX_ASSET_BYTES = 100 * 1024 * 1024;

export const ipfsToHttp = (uri: string, host = "storacha.link") => {
  if (!uri) return "";
  if (!uri.startsWith("ipfs://")) return uri;

  const withoutPrefix = uri.slice("ipfs://".length);
  const [cid, ...rest] = withoutPrefix.split("/");
  if (!cid) return "";
  const path = rest.join("/");
  return path ? `https://${cid}.ipfs.${host}/${path}` : `https://${cid}.ipfs.${host}`;
};

const readEnv = (event: Pick<RequestEventBase, "env"> | undefined, key: string) => {
  const fromEvent = event?.env?.get?.(key);
  if (fromEvent) return fromEvent;
  if (key.startsWith("PUBLIC_")) {
    return getPublicEnv(key);
  }
  return getServerEnv(key);
};

function toRealArrayBuffer(input: Uint8Array | ArrayBuffer | ArrayBufferLike): ArrayBuffer {
  if (input instanceof ArrayBuffer) {
    const out = new ArrayBuffer(input.byteLength);
    new Uint8Array(out).set(new Uint8Array(input));
    return out;
  }

  if (input instanceof Uint8Array) {
    const out = new ArrayBuffer(input.byteLength);
    new Uint8Array(out).set(input);
    return out;
  }

  const view = new Uint8Array(input);
  const out = new ArrayBuffer(view.byteLength);
  new Uint8Array(out).set(view);
  return out;
}

function toFileFromBytes(
  bytes: Uint8Array | ArrayBuffer | ArrayBufferLike,
  name: string,
  type: string,
): File {
  const realArrayBuffer = toRealArrayBuffer(bytes);
  const blob = new Blob([realArrayBuffer], { type });

  try {
    return new File([blob], name, { type });
  } catch {
    (blob as Blob & { name?: string }).name = name;
    return blob as File;
  }
}

async function retry<T>(fn: () => Promise<T>, times = 2): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= times; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

const createStorachaSession = async (event?: Pick<RequestEventBase, "env">) => {
  const key = readEnv(event, "STORACHA_KEY");
  const proofValue = readEnv(event, "STORACHA_PROOF");
  if (!key || !proofValue) {
    throw new Error("Missing STORACHA_KEY/STORACHA_PROOF in server env.");
  }

  const gatewayHost = readEnv(event, "PUBLIC_STORACHA_GATEWAY_HOST") || "storacha.link";
  const principal = Signer.parse(key);
  const store = new StoreMemory();
  const client = await Client.create({ principal, store });

  const proof = await Proof.parse(proofValue);
  const space = await client.addSpace(proof);
  await client.setCurrentSpace(space.did());

  return {
    client,
    gatewayHost,
    spaceDid: space.did(),
  };
};

export interface StorachaUploadInput {
  metadata: Record<string, unknown>;
  image?: {
    bytes: Uint8Array | number[];
    name?: string;
    type?: string;
  } | null;
}

export interface StorachaUploadResult {
  spaceDid: string;
  tokenCid: string;
  tokenURI: string;
  imageCid?: string;
  http: {
    token: string;
    image?: string;
  };
}

export interface StorachaAssetUploadResult {
  spaceDid: string;
  assetCid: string;
  assetURI: string;
  httpUrl: string;
}

export const uploadAssetToStoracha = async (
  input: {
    bytes: Uint8Array | number[];
    name?: string;
    type?: string;
  },
  event?: Pick<RequestEventBase, "env">,
): Promise<StorachaAssetUploadResult> => {
  const { client, gatewayHost, spaceDid } = await createStorachaSession(event);
  const bytes = new Uint8Array(input.bytes);
  if (bytes.byteLength > MAX_ASSET_BYTES) {
    throw new Error(`Asset exceeds ${Math.round(MAX_ASSET_BYTES / 1024 / 1024)}MB.`);
  }

  const type = input.type || "application/octet-stream";
  if (!ALLOWED_IMAGE_TYPES.has(type)) {
    throw new Error(`Invalid asset type: ${type}`);
  }

  const file = toFileFromBytes(bytes, input.name || "asset.bin", type);
  const assetCid = String(await retry(() => client.uploadFile(file)));
  const assetURI = `ipfs://${assetCid}`;

  return {
    spaceDid,
    assetCid,
    assetURI,
    httpUrl: ipfsToHttp(assetURI, gatewayHost),
  };
};

export const uploadMetadataToStoracha = async (
  input: StorachaUploadInput,
  event?: Pick<RequestEventBase, "env">,
): Promise<StorachaUploadResult> => {
  const { client, gatewayHost, spaceDid } = await createStorachaSession(event);

  const metadata = { ...input.metadata };
  if (typeof metadata.name !== "string" || !metadata.name.trim()) {
    metadata.name = "NFT";
  }
  if (typeof metadata.description !== "string") {
    metadata.description = "";
  }
  if (!Array.isArray(metadata.attributes)) {
    metadata.attributes = [];
  }

  let imageCid: string | undefined;
  const image = input.image ?? null;

  if (image && Array.isArray(image.bytes) && image.bytes.length) {
    const bytes = new Uint8Array(image.bytes);
    if (bytes.byteLength > MAX_ASSET_BYTES) {
      throw new Error(`Image exceeds ${Math.round(MAX_ASSET_BYTES / 1024 / 1024)}MB.`);
    }

    const type = image.type || "image/png";
    if (!ALLOWED_IMAGE_TYPES.has(type)) {
      throw new Error(`Invalid image type: ${type}`);
    }

    const file = toFileFromBytes(bytes, image.name || "asset.bin", type);
    imageCid = String(await retry(() => client.uploadFile(file)));
    metadata.image = `ipfs://${imageCid}`;
  }

  const encodedMetadata = new TextEncoder().encode(JSON.stringify(metadata, null, 2));
  const metadataFile = toFileFromBytes(encodedMetadata, "metadata.json", "application/json");
  const tokenCid = String(await retry(() => client.uploadFile(metadataFile)));
  const tokenURI = `ipfs://${tokenCid}`;

  return {
    spaceDid,
    tokenCid,
    tokenURI,
    imageCid,
    http: {
      token: ipfsToHttp(tokenURI, gatewayHost),
      ...(imageCid ? { image: ipfsToHttp(`ipfs://${imageCid}`, gatewayHost) } : {}),
    },
  };
};

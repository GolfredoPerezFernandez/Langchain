import type { RequestEventBase } from "@builder.io/qwik-city";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";
import { getTursoClient, isSchemaEnsured, markSchemaAsEnsured } from "../turso";
import { getPublicEnv, getServerEnv, isProductionEnv } from "../server-env";
import { templateLibrary } from "./mock";

const LEGALCHAIN_SESSION_COOKIE = "legalchain_session";
const LEGALCHAIN_SCHEMA_KEY = "legalchain-v2";
const LEGALCHAIN_SHARED_SESSION_KEY = "legalchain:session";
const LEGALCHAIN_SHARED_USER_KEY = "legalchain:user";

export interface LegalchainSession {
  userId: string;
  token: string;
}

export interface LegalchainUser {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  username: string;
  walletAddress: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
}

export interface RegisterLegalchainInput {
  fullName: string;
  email: string;
  phone?: string;
  username?: string;
  password: string;
  pin?: string;
}

export interface LoginLegalchainInput {
  email: string;
  password: string;
  pin?: string;
}

export interface LegalchainWalletRecord {
  id: string;
  userId: string;
  address: string;
  encryptedPrivateKey: string;
  chainId: number;
  createdAt: string;
  updatedAt: string;
}

export interface LegalchainCollectionRecord {
  id: string;
  userId: string;
  address: string;
  name: string;
  symbol: string;
  deploymentHash: string;
  chainId: number;
  createdAt: string;
  updatedAt: string;
}

export interface LegalchainDraftRecord {
  id: string;
  userId: string;
  title: string;
  description: string;
  templateSlug: string;
  templateTitle: string;
  duration: string;
  visibility: string;
  assetUri: string;
  assetHttpUrl: string;
  assetName: string;
  assetType: string;
  captureStartedAt: string;
  captureEndedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface LegalchainTemplateRecord {
  slug: string;
  title: string;
  category: string;
  duration: string;
  status: string;
  version: string;
  uses: string;
  summary: string;
  audience: string;
  scriptBlocks: { title: string; copy: string }[];
  checkpoints: string[];
}

export interface LegalchainRecordRow {
  hash: string;
  userId: string;
  title: string;
  templateSlug: string;
  templateTitle: string;
  status: string;
  updated: string;
  duration: string;
  visibility: string;
  owner: string;
  tokenId: string;
  contract: string;
  collectionName: string;
  ipfs: string;
  mediaUrl: string;
  metadataJson: Record<string, unknown>;
  network: string;
  createdAt: string;
  txHash: string;
  startDateRecord: string;
  endDateRecord: string;
}

export interface LegalchainPaymentRow {
  reference: string;
  userId: string;
  flow: string;
  status: string;
  amount: string;
  method: string;
  requestedAt: string;
  providerReference: string;
  detailsJson: Record<string, unknown>;
}

const nowIso = () => new Date().toISOString();

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const sanitizeText = (value?: string | null) => (value ?? "").trim();

const createLegalchainPinRequiredError = () =>
  Object.assign(new Error("PIN is required to complete sign in."), {
    code: "PIN_REQUIRED",
  });

const getWalletEncryptionSecret = () => {
  const secret =
    getServerEnv("PRIVATE_LEGALCHAIN_WALLET_SECRET") ||
    getServerEnv("LEGALCHAIN_WALLET_SECRET") ||
    (!isProductionEnv() ? "legalchain-dev-wallet-secret-change-me" : "");

  if (!secret) {
    throw new Error("Missing PRIVATE_LEGALCHAIN_WALLET_SECRET for Legalchain wallet encryption.");
  }

  return scryptSync(secret, "legalchain-wallet", 32);
};

const encryptPrivateKey = (privateKey: Hex) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getWalletEncryptionSecret(), iv);
  const encrypted = Buffer.concat([cipher.update(privateKey, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
};

export const decryptLegalchainPrivateKey = (payload: string): Hex => {
  const data = Buffer.from(payload, "base64");
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const encrypted = data.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", getWalletEncryptionSecret(), iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  return decrypted as Hex;
};

const hashSecret = (value: string) => {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(value, salt, 64).toString("hex");
  return { salt, hash };
};

const verifySecret = (value: string, salt: string, hash: string) => {
  const nextHash = scryptSync(value, salt, 64).toString("hex");
  return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(nextHash, "hex"));
};

const parseRowNumber = (value: unknown) => Number(value ?? 0);

const parseJsonObject = (value: unknown, fallback: Record<string, unknown> = {}) => {
  if (typeof value !== "string" || !value.trim()) return fallback;

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const parseLegalchainDate = (value = nowIso()) => {
  const directDate = new Date(value);
  if (!Number.isNaN(directDate.getTime())) {
    return directDate;
  }

  const legacyMatch =
    /^([A-Z][a-z]{2})\s(\d{2}),\s(\d{4})\s-\s(\d{2}):(\d{2})$/.exec(String(value).trim());
  if (!legacyMatch) {
    return null;
  }

  const [, monthLabel, day, year, hour, minute] = legacyMatch;
  const monthIndex = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(
    monthLabel,
  );

  if (monthIndex < 0) {
    return null;
  }

  const legacyDate = new Date(Date.UTC(Number(year), monthIndex, Number(day), Number(hour), Number(minute)));
  return Number.isNaN(legacyDate.getTime()) ? null : legacyDate;
};

const formatLegalchainCreatedAt = (value = nowIso()) => {
  const date = parseLegalchainDate(value);
  if (!date) {
    return String(value ?? "");
  }

  const month = date.toLocaleString("en-US", { month: "short" });
  const day = date.toLocaleString("en-US", { day: "2-digit" });
  const year = date.toLocaleString("en-US", { year: "numeric" });
  const time = date.toLocaleString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return `${month} ${day}, ${year} - ${time}`;
};

const formatLegalchainRelativeTime = (value = nowIso()) => {
  const date = parseLegalchainDate(value);
  if (!date) {
    return String(value ?? "");
  }

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return formatLegalchainCreatedAt(value);
};

const slugifyLegalchainTemplate = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

type LegalchainTemplateOwnership = "all" | "owned" | "owned-or-unassigned";

type LegalchainTemplateFilters = {
  query?: string;
  status?: string;
  category?: string;
  userId?: string;
  ownership?: LegalchainTemplateOwnership;
};

type LegalchainTemplateScope = {
  userId?: string;
  ownership?: LegalchainTemplateOwnership;
};

type LegalchainWorkspaceOptions = {
  templateFilters?: LegalchainTemplateFilters;
};

const appendTemplateOwnershipClause = (
  clauses: string[],
  args: (string | number)[],
  scope?: LegalchainTemplateScope,
  ownerColumnAvailable = true,
) => {
  const userId = sanitizeText(scope?.userId);
  const ownership = scope?.ownership ?? "all";

  if (!ownerColumnAvailable || !userId || ownership === "all") {
    return;
  }

  if (ownership === "owned") {
    clauses.push("user_id = ?");
    args.push(userId);
    return;
  }

  clauses.push("(user_id = ? or user_id is null or user_id = '')");
  args.push(userId);
};

const toTemplateRecord = (row: Record<string, unknown>): LegalchainTemplateRecord => ({
  slug: String(row.slug ?? ""),
  title: String(row.title ?? ""),
  category: String(row.category ?? ""),
  duration: String(row.duration ?? ""),
  status: String(row.status ?? ""),
  version: String(row.version ?? ""),
  uses: String(row.uses_count ?? "0"),
  summary: String(row.summary ?? ""),
  audience: String(row.audience ?? ""),
  scriptBlocks: JSON.parse(String(row.script_blocks_json ?? "[]")),
  checkpoints: JSON.parse(String(row.checkpoints_json ?? "[]")),
});

const toUserRecord = (row: Record<string, unknown>): LegalchainUser => ({
  id: String(row.id ?? ""),
  email: String(row.email ?? ""),
  fullName: String(row.full_name ?? ""),
  phone: String(row.phone ?? ""),
  username: String(row.username ?? ""),
  walletAddress: String(row.wallet_address ?? ""),
  createdAt: String(row.created_at ?? ""),
  updatedAt: String(row.updated_at ?? ""),
  lastLoginAt: String(row.last_login_at ?? ""),
});

const toWalletRecord = (row: Record<string, unknown>): LegalchainWalletRecord => ({
  id: String(row.id ?? ""),
  userId: String(row.user_id ?? ""),
  address: String(row.address ?? ""),
  encryptedPrivateKey: String(row.encrypted_private_key ?? ""),
  chainId: parseRowNumber(row.chain_id),
  createdAt: String(row.created_at ?? ""),
  updatedAt: String(row.updated_at ?? ""),
});

const toCollectionRecord = (row: Record<string, unknown>): LegalchainCollectionRecord => ({
  id: String(row.id ?? ""),
  userId: String(row.user_id ?? ""),
  address: String(row.address ?? ""),
  name: String(row.name ?? ""),
  symbol: String(row.symbol ?? ""),
  deploymentHash: String(row.deployment_hash ?? ""),
  chainId: parseRowNumber(row.chain_id),
  createdAt: String(row.created_at ?? ""),
  updatedAt: String(row.updated_at ?? ""),
});

const toDraftRecord = (row: Record<string, unknown>): LegalchainDraftRecord => ({
  id: String(row.id ?? ""),
  userId: String(row.user_id ?? ""),
  title: String(row.title ?? ""),
  description: String(row.description ?? ""),
  templateSlug: String(row.template_slug ?? ""),
  templateTitle: String(row.template_title ?? ""),
  duration: String(row.duration ?? ""),
  visibility: String(row.visibility ?? ""),
  assetUri: String(row.asset_uri ?? ""),
  assetHttpUrl: String(row.asset_http_url ?? ""),
  assetName: String(row.asset_name ?? ""),
  assetType: String(row.asset_type ?? ""),
  captureStartedAt: String(row.capture_started_at ?? ""),
  captureEndedAt: String(row.capture_ended_at ?? ""),
  createdAt: formatLegalchainCreatedAt(String(row.created_at ?? "")),
  updatedAt: formatLegalchainCreatedAt(String(row.updated_at ?? "")),
});

const toRecordRow = (row: Record<string, unknown>): LegalchainRecordRow => {
  const metadataJson = parseJsonObject(row.metadata_json);
  const createdAtValue = String(row.created_at ?? "");

  return {
    hash: String(row.hash ?? ""),
    userId: String(row.user_id ?? ""),
    title: String(row.title ?? ""),
    templateSlug: String(row.template_slug ?? ""),
    templateTitle: String(row.template_title ?? ""),
    status: String(row.status ?? ""),
    updated: String(row.updated ?? ""),
    duration: String(row.duration ?? ""),
    visibility: String(row.visibility ?? ""),
    owner: String(row.owner ?? ""),
    tokenId: String(row.token_id ?? ""),
    contract: String(row.contract_address ?? ""),
    collectionName: String(row.collection_name ?? ""),
    ipfs: String(row.ipfs_uri ?? ""),
    mediaUrl: String(row.media_url ?? metadataJson.image ?? ""),
    metadataJson,
    network: String(row.network ?? ""),
    createdAt: formatLegalchainCreatedAt(createdAtValue),
    txHash: String(row.hash ?? ""),
    startDateRecord: String(metadataJson.startDateRecord ?? ""),
    endDateRecord: String(metadataJson.endDateRecord ?? ""),
  };
};

const ensureTableColumns = async (
  tableName: string,
  columns: { name: string; definition: string }[],
) => {
  const client = getTursoClient();
  const result = await client.execute(`pragma table_info(${tableName})`);
  const existing = new Set(
    result.rows.map((row: unknown) => String((row as Record<string, unknown>).name ?? "")),
  );

  for (const column of columns) {
    if (!existing.has(column.name)) {
      await client.execute(`alter table ${tableName} add column ${column.definition}`);
    }
  }
};

const hasTableColumn = async (tableName: string, columnName: string) => {
  const result = await getTursoClient().execute(`pragma table_info(${tableName})`);
  return result.rows.some((row: unknown) => String((row as Record<string, unknown>).name ?? "") === columnName);
};

const hasLegalchainTemplateOwnerColumn = async () => hasTableColumn("legalchain_templates", "user_id");

const cleanupLegacySeededTemplates = async () => {
  const client = getTursoClient();

  for (const template of templateLibrary) {
    await client.execute({
      sql: `delete from legalchain_templates
        where slug = ? and title = ? and category = ? and duration = ? and status = ? and version = ?
          and uses_count = ? and summary = ? and audience = ? and script_blocks_json = ? and checkpoints_json = ?`,
      args: [
        template.slug,
        template.title,
        template.category,
        template.duration,
        template.status,
        template.version,
        Number.parseInt(template.uses.replace(/[^\d]/g, ""), 10) || 0,
        template.summary,
        template.audience,
        JSON.stringify(template.scriptBlocks),
        JSON.stringify(template.checkpoints),
      ],
    });
  }
};

const cleanupLegacySeededWorkspace = async () => {
  const client = getTursoClient();

  await client.execute(
    "delete from legalchain_records where instr(hash, '-lc_user_') > 0",
  );
  await client.execute(
    "delete from legalchain_payments where instr(reference, '-lc_user_') > 0",
  );
};

const normalizeLegacyRecordTimestamps = async () => {
  const client = getTursoClient();
  const result = await client.execute("select hash, created_at from legalchain_records");

  for (const row of result.rows) {
    const record = row as Record<string, unknown>;
    const hash = String(record.hash ?? "");
    const createdAt = String(record.created_at ?? "");

    if (!hash || !createdAt || /^\d{4}-\d{2}-\d{2}T/.test(createdAt)) {
      continue;
    }

    const parsed = parseLegalchainDate(createdAt);
    if (!parsed) {
      continue;
    }

    await client.execute({
      sql: "update legalchain_records set created_at = ? where hash = ?",
      args: [parsed.toISOString(), hash],
    });
  }
};

export const ensureLegalchainSchema = async () => {
  if (isSchemaEnsured(LEGALCHAIN_SCHEMA_KEY)) return;

  const client = getTursoClient();
  const statements = [
    `create table if not exists legalchain_users (
      id text primary key,
      email text not null unique,
      full_name text not null,
      phone text not null default '',
      username text unique,
      wallet_address text not null unique,
      pin_hash text,
      pin_salt text,
      created_at text not null,
      updated_at text not null,
      last_login_at text not null
    );`,
    `create table if not exists legalchain_auth (
      user_id text primary key,
      password_hash text not null,
      password_salt text not null,
      created_at text not null,
      updated_at text not null
    );`,
    `create table if not exists legalchain_sessions (
      id text primary key,
      user_id text not null,
      token text not null unique,
      expires_at text not null,
      created_at text not null,
      last_seen text not null
    );`,
    `create table if not exists legalchain_wallets (
      id text primary key,
      user_id text not null unique,
      address text not null unique,
      encrypted_private_key text not null,
      chain_id integer not null,
      created_at text not null,
      updated_at text not null
    );`,
    `create table if not exists legalchain_drafts (
      id text primary key,
      user_id text not null unique,
      title text not null,
      description text not null,
      template_slug text not null,
      template_title text not null,
      duration text not null,
      visibility text not null,
      asset_uri text not null,
      asset_http_url text not null,
      asset_name text not null,
      asset_type text not null,
      capture_started_at text,
      capture_ended_at text,
      created_at text not null,
      updated_at text not null
    );`,
    `create table if not exists legalchain_collections (
      id text primary key,
      user_id text not null unique,
      address text not null unique,
      name text not null,
      symbol text not null,
      deployment_hash text,
      chain_id integer not null,
      created_at text not null,
      updated_at text not null
    );`,
    `create table if not exists legalchain_templates (
      slug text primary key,
      user_id text,
      title text not null,
      category text not null,
      duration text not null,
      status text not null,
      version text not null,
      uses_count integer not null default 0,
      summary text not null,
      audience text not null,
      script_blocks_json text not null,
      checkpoints_json text not null,
      created_at text not null,
      updated_at text not null
    );`,
    `create table if not exists legalchain_records (
      hash text primary key,
      user_id text not null,
      title text not null,
      template_slug text not null,
      template_title text not null,
      status text not null,
      updated text not null,
      duration text not null,
      visibility text not null,
      owner text not null,
      token_id text not null,
      contract_address text not null,
      collection_name text not null default '',
      ipfs_uri text not null,
      media_url text,
      metadata_json text not null default '{}',
      network text not null,
      created_at text not null
    );`,
    `create table if not exists legalchain_payments (
      reference text primary key,
      user_id text not null,
      flow text not null,
      status text not null,
      amount text not null,
      method text not null,
      requested_at text not null,
      provider_reference text,
      details_json text not null default '{}'
    );`,
    `create table if not exists legalchain_transactions (
      id text primary key,
      user_id text not null,
      wallet_id text not null,
      kind text not null,
      chain_id integer not null,
      to_address text,
      contract_address text,
      tx_hash text,
      status text not null,
      payload_json text not null,
      created_at text not null,
      updated_at text not null
    );`,
  ];

  for (const sql of statements) {
    await client.execute(sql);
  }

  await ensureTableColumns("legalchain_records", [
    { name: "collection_name", definition: "collection_name text not null default ''" },
    { name: "media_url", definition: "media_url text" },
    { name: "metadata_json", definition: "metadata_json text not null default '{}'" },
  ]);
  await ensureTableColumns("legalchain_drafts", [
    { name: "capture_started_at", definition: "capture_started_at text" },
    { name: "capture_ended_at", definition: "capture_ended_at text" },
  ]);
  await ensureTableColumns("legalchain_templates", [
    { name: "user_id", definition: "user_id text" },
  ]);
  await ensureTableColumns("legalchain_payments", [
    { name: "provider_reference", definition: "provider_reference text" },
    { name: "details_json", definition: "details_json text not null default '{}'" },
  ]);

  await cleanupLegacySeededWorkspace();
  await cleanupLegacySeededTemplates();
  await normalizeLegacyRecordTimestamps();
  markSchemaAsEnsured(LEGALCHAIN_SCHEMA_KEY);
};

export const createLegalchainSession = async (userId: string, event: RequestEventBase) => {
  await ensureLegalchainSchema();
  const client = getTursoClient();
  const existingToken = event.cookie.get(LEGALCHAIN_SESSION_COOKIE)?.value;
  if (existingToken) {
    await client.execute({
      sql: "delete from legalchain_sessions where token = ?",
      args: [existingToken],
    });
  }

  const token = `lc_sess_${randomUUID()}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  await client.execute({
    sql: `insert into legalchain_sessions(id, user_id, token, expires_at, created_at, last_seen)
      values (?, ?, ?, ?, ?, ?)`,
    args: [randomUUID(), userId, token, expiresAt.toISOString(), now.toISOString(), now.toISOString()],
  });

  event.cookie.set(LEGALCHAIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: event.url.protocol === "https:",
    maxAge: 7 * 24 * 60 * 60,
  });

  return { userId, token } as LegalchainSession;
};

export const clearLegalchainSession = async (event: RequestEventBase) => {
  const token = event.cookie.get(LEGALCHAIN_SESSION_COOKIE)?.value;
  if (token) {
    await getTursoClient().execute({
      sql: "delete from legalchain_sessions where token = ?",
      args: [token],
    });
  }

  event.cookie.delete(LEGALCHAIN_SESSION_COOKIE, { path: "/" });
};

export const getLegalchainSessionFromEvent = async (event: RequestEventBase) => {
  const cached = event.sharedMap.get(LEGALCHAIN_SHARED_SESSION_KEY);
  if (cached !== undefined) {
    return (await Promise.resolve(cached)) as LegalchainSession | null;
  }

  const lookupPromise = (async () => {
    await ensureLegalchainSchema();
    const token = event.cookie.get(LEGALCHAIN_SESSION_COOKIE)?.value;
    if (!token) return null;

    const client = getTursoClient();
    const result = await client.execute({
      sql: "select user_id, expires_at, last_seen from legalchain_sessions where token = ? limit 1",
      args: [token],
    });
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) return null;

    const expiresAt = new Date(String(row.expires_at ?? ""));
    if (expiresAt <= new Date()) {
      await client.execute({
        sql: "delete from legalchain_sessions where token = ?",
        args: [token],
      });
      event.cookie.delete(LEGALCHAIN_SESSION_COOKIE, { path: "/" });
      return null;
    }

    const lastSeenValue = String(row.last_seen ?? "");
    const lastSeen = lastSeenValue ? new Date(lastSeenValue) : null;
    const shouldRefreshLastSeen =
      !lastSeen ||
      Number.isNaN(lastSeen.getTime()) ||
      Date.now() - lastSeen.getTime() >= 5 * 60 * 1000;

    if (shouldRefreshLastSeen) {
      await client.execute({
        sql: "update legalchain_sessions set last_seen = ? where token = ?",
        args: [nowIso(), token],
      });
    }

    return { userId: String(row.user_id ?? ""), token } as LegalchainSession;
  })();

  event.sharedMap.set(LEGALCHAIN_SHARED_SESSION_KEY, lookupPromise);
  const session = await lookupPromise;
  event.sharedMap.set(LEGALCHAIN_SHARED_SESSION_KEY, session);
  return session;
};

export const getLegalchainUserById = async (userId: string) => {
  await ensureLegalchainSchema();
  const result = await getTursoClient().execute({
    sql: `select id, email, full_name, phone, username, wallet_address, created_at, updated_at, last_login_at
      from legalchain_users where id = ? limit 1`,
    args: [userId],
  });
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? toUserRecord(row) : null;
};

export const getLegalchainUserByEmail = async (email: string) => {
  await ensureLegalchainSchema();
  const result = await getTursoClient().execute({
    sql: `select id, email, full_name, phone, username, wallet_address, created_at, updated_at, last_login_at
      from legalchain_users where email = ? limit 1`,
    args: [normalizeEmail(email)],
  });
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? toUserRecord(row) : null;
};

export const getLegalchainWalletByUserId = async (userId: string) => {
  await ensureLegalchainSchema();
  const result = await getTursoClient().execute({
    sql: `select id, user_id, address, encrypted_private_key, chain_id, created_at, updated_at
      from legalchain_wallets where user_id = ? limit 1`,
    args: [userId],
  });
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? toWalletRecord(row) : null;
};

export const getLegalchainDraftByUserId = async (userId: string) => {
  await ensureLegalchainSchema();
  const result = await getTursoClient().execute({
    sql: `select id, user_id, title, description, template_slug, template_title, duration, visibility,
      asset_uri, asset_http_url, asset_name, asset_type, capture_started_at, capture_ended_at, created_at, updated_at
      from legalchain_drafts where user_id = ? limit 1`,
    args: [userId],
  });
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? toDraftRecord(row) : null;
};

export const getLegalchainCollectionByUserId = async (userId: string) => {
  await ensureLegalchainSchema();
  const result = await getTursoClient().execute({
    sql: `select id, user_id, address, name, symbol, deployment_hash, chain_id, created_at, updated_at
      from legalchain_collections where user_id = ? limit 1`,
    args: [userId],
  });
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? toCollectionRecord(row) : null;
};

export const upsertLegalchainCollection = async (input: {
  userId: string;
  address: string;
  name: string;
  symbol?: string;
  deploymentHash?: string;
  chainId?: number;
}) => {
  await ensureLegalchainSchema();
  const existing = await getLegalchainCollectionByUserId(input.userId);
  const timestamp = nowIso();
  const chainId = input.chainId ?? resolveLegalchainChainId();
  const symbol = sanitizeText(input.symbol) || "LG";

  if (existing) {
    await getTursoClient().execute({
      sql: `update legalchain_collections
        set address = ?, name = ?, symbol = ?, deployment_hash = ?, chain_id = ?, updated_at = ?
        where user_id = ?`,
      args: [
        input.address,
        input.name,
        symbol,
        input.deploymentHash ?? existing.deploymentHash,
        chainId,
        timestamp,
        input.userId,
      ],
    });
  } else {
    await getTursoClient().execute({
      sql: `insert into legalchain_collections(
        id, user_id, address, name, symbol, deployment_hash, chain_id, created_at, updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        `lc_collection_${randomUUID()}`,
        input.userId,
        input.address,
        input.name,
        symbol,
        input.deploymentHash ?? null,
        chainId,
        timestamp,
        timestamp,
      ],
    });
  }

  return await getLegalchainCollectionByUserId(input.userId);
};

export const upsertLegalchainDraft = async (input: {
  userId: string;
  title: string;
  description?: string;
  templateSlug: string;
  templateTitle: string;
  duration?: string;
  visibility?: string;
  assetUri: string;
  assetHttpUrl: string;
  assetName?: string;
  assetType?: string;
  captureStartedAt?: string;
  captureEndedAt?: string;
}) => {
  await ensureLegalchainSchema();
  const existing = await getLegalchainDraftByUserId(input.userId);
  const timestamp = nowIso();
  const captureStartedAt = sanitizeText(input.captureStartedAt) || existing?.captureStartedAt || timestamp;
  const captureEndedAt = sanitizeText(input.captureEndedAt) || existing?.captureEndedAt || captureStartedAt;

  if (existing) {
    await getTursoClient().execute({
      sql: `update legalchain_drafts
        set title = ?, description = ?, template_slug = ?, template_title = ?, duration = ?, visibility = ?,
        asset_uri = ?, asset_http_url = ?, asset_name = ?, asset_type = ?, capture_started_at = ?, capture_ended_at = ?, updated_at = ?
        where user_id = ?`,
      args: [
        input.title,
        input.description ?? "",
        input.templateSlug,
        input.templateTitle,
        input.duration ?? "00:00",
        input.visibility ?? "Private",
        input.assetUri,
        input.assetHttpUrl,
        input.assetName ?? "",
        input.assetType ?? "application/octet-stream",
        captureStartedAt,
        captureEndedAt,
        timestamp,
        input.userId,
      ],
    });
  } else {
    await getTursoClient().execute({
      sql: `insert into legalchain_drafts(
        id, user_id, title, description, template_slug, template_title, duration, visibility,
        asset_uri, asset_http_url, asset_name, asset_type, capture_started_at, capture_ended_at, created_at, updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        `lc_draft_${randomUUID()}`,
        input.userId,
        input.title,
        input.description ?? "",
        input.templateSlug,
        input.templateTitle,
        input.duration ?? "00:00",
        input.visibility ?? "Private",
        input.assetUri,
        input.assetHttpUrl,
        input.assetName ?? "",
        input.assetType ?? "application/octet-stream",
        captureStartedAt,
        captureEndedAt,
        timestamp,
        timestamp,
      ],
    });
  }

  return await getLegalchainDraftByUserId(input.userId);
};

export const clearLegalchainDraft = async (userId: string) => {
  await ensureLegalchainSchema();
  await getTursoClient().execute({
    sql: "delete from legalchain_drafts where user_id = ?",
    args: [userId],
  });
};

const resolveLegalchainChainId = () => {
  const value = getPublicEnv("PUBLIC_LEGALCHAIN_CHAIN_ID") || getServerEnv("PRIVATE_LEGALCHAIN_CHAIN_ID") || "8453";
  const chainId = Number.parseInt(value, 10);
  return Number.isFinite(chainId) ? chainId : 8453;
};

export const registerLegalchainUser = async (input: RegisterLegalchainInput, event: RequestEventBase) => {
  await ensureLegalchainSchema();

  const email = normalizeEmail(input.email);
  const fullName = sanitizeText(input.fullName);
  const username = sanitizeText(input.username);
  const phone = sanitizeText(input.phone);
  const password = input.password ?? "";
  const pin = sanitizeText(input.pin);

  if (!fullName || !email || !password) {
    throw new Error("Full name, email and password are required.");
  }

  const client = getTursoClient();
  const existingByEmail = await getLegalchainUserByEmail(email);
  if (existingByEmail) {
    throw new Error("A Legalchain user with that email already exists.");
  }

  if (username) {
    const existingByUsername = await client.execute({
      sql: "select id from legalchain_users where username = ? limit 1",
      args: [username],
    });
    if (existingByUsername.rows[0]) {
      throw new Error("That username is already in use.");
    }
  }

  const userId = `lc_user_${randomUUID()}`;
  const { hash: passwordHash, salt: passwordSalt } = hashSecret(password);
  const pinSecrets = pin ? hashSecret(pin) : null;
  const createdAt = nowIso();
  const chainId = resolveLegalchainChainId();
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  await client.execute({
    sql: `insert into legalchain_users(
      id, email, full_name, phone, username, wallet_address, pin_hash, pin_salt, created_at, updated_at, last_login_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      userId,
      email,
      fullName,
      phone,
      username || null,
      account.address,
      pinSecrets?.hash ?? null,
      pinSecrets?.salt ?? null,
      createdAt,
      createdAt,
      createdAt,
    ],
  });

  await client.execute({
    sql: `insert into legalchain_auth(user_id, password_hash, password_salt, created_at, updated_at)
      values (?, ?, ?, ?, ?)`,
    args: [userId, passwordHash, passwordSalt, createdAt, createdAt],
  });

  await client.execute({
    sql: `insert into legalchain_wallets(id, user_id, address, encrypted_private_key, chain_id, created_at, updated_at)
      values (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      `lc_wallet_${randomUUID()}`,
      userId,
      account.address,
      encryptPrivateKey(privateKey),
      chainId,
      createdAt,
      createdAt,
    ],
  });

  const user = await getLegalchainUserById(userId);
  if (!user) {
    throw new Error("Legalchain user could not be loaded after registration.");
  }

  await createLegalchainSession(user.id, event);
  return user;
};

export const loginLegalchainUser = async (input: LoginLegalchainInput, event: RequestEventBase) => {
  await ensureLegalchainSchema();

  const email = normalizeEmail(input.email);
  const password = input.password ?? "";
  const pin = sanitizeText(input.pin);
  if (!email || !password) {
    throw new Error("Email and password are required.");
  }

  const client = getTursoClient();
  const authResult = await client.execute({
    sql: `select u.id, u.email, u.full_name, u.phone, u.username, u.wallet_address, u.created_at, u.updated_at, u.last_login_at,
      u.pin_hash, u.pin_salt, a.password_hash, a.password_salt
      from legalchain_users u
      join legalchain_auth a on a.user_id = u.id
      where u.email = ? limit 1`,
    args: [email],
  });
  const row = authResult.rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    throw new Error("Invalid credentials.");
  }

  const valid = verifySecret(
    password,
    String(row.password_salt ?? ""),
    String(row.password_hash ?? ""),
  );

  if (!valid) {
    throw new Error("Invalid credentials.");
  }

  const pinHash = String(row.pin_hash ?? "");
  const pinSalt = String(row.pin_salt ?? "");

  if (pinHash && pinSalt) {
    if (!pin) {
      throw createLegalchainPinRequiredError();
    }

    if (!verifySecret(pin, pinSalt, pinHash)) {
      throw new Error("Invalid PIN.");
    }
  }

  const loginAt = nowIso();
  await client.execute({
    sql: "update legalchain_users set last_login_at = ?, updated_at = ? where id = ?",
    args: [loginAt, loginAt, String(row.id ?? "")],
  });

  await createLegalchainSession(String(row.id ?? ""), event);
  return await getLegalchainUserById(String(row.id ?? ""));
};

export const getCurrentLegalchainUser = async (event: RequestEventBase) => {
  const cached = event.sharedMap.get(LEGALCHAIN_SHARED_USER_KEY);
  if (cached !== undefined) {
    return (await Promise.resolve(cached)) as LegalchainUser | null;
  }

  const lookupPromise = (async () => {
    const session = await getLegalchainSessionFromEvent(event);
    if (!session) return null;
    return await getLegalchainUserById(session.userId);
  })();

  event.sharedMap.set(LEGALCHAIN_SHARED_USER_KEY, lookupPromise);
  const user = await lookupPromise;
  event.sharedMap.set(LEGALCHAIN_SHARED_USER_KEY, user);
  return user;
};

export const verifyLegalchainPinForUser = async (userId: string, pin?: string | null) => {
  await ensureLegalchainSchema();
  const result = await getTursoClient().execute({
    sql: "select pin_hash, pin_salt from legalchain_users where id = ? limit 1",
    args: [userId],
  });
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    throw new Error("Legalchain user not found.");
  }

  const pinHash = String(row.pin_hash ?? "");
  const pinSalt = String(row.pin_salt ?? "");
  if (!pinHash || !pinSalt) {
    return true;
  }

  const normalizedPin = sanitizeText(pin);
  if (!normalizedPin) {
    throw new Error("PIN is required for this operation.");
  }

  if (!verifySecret(normalizedPin, pinSalt, pinHash)) {
    throw new Error("Invalid PIN.");
  }

  return true;
};

export const listLegalchainTemplates = async (filters?: LegalchainTemplateFilters) => {
  await ensureLegalchainSchema();
  await cleanupLegacySeededTemplates();
  const ownerColumnAvailable = await hasLegalchainTemplateOwnerColumn();
  const query = sanitizeText(filters?.query).toLowerCase();
  const status = sanitizeText(filters?.status);
  const category = sanitizeText(filters?.category).toLowerCase();
  const clauses = ["1 = 1"];
  const args: (string | number)[] = [];

  if (query) {
    clauses.push(`(
      lower(title) like ? or
      lower(category) like ? or
      lower(audience) like ? or
      lower(summary) like ?
    )`);
    const term = `%${query}%`;
    args.push(term, term, term, term);
  }

  if (status) {
    clauses.push("status = ?");
    args.push(status);
  }

  if (category) {
    clauses.push("lower(category) like ?");
    args.push(`%${category}%`);
  }

  appendTemplateOwnershipClause(clauses, args, filters, ownerColumnAvailable);

  const result = await getTursoClient().execute({
    sql: `select slug, ${ownerColumnAvailable ? "user_id, " : ""}title, category, duration, status, version, uses_count, summary, audience, script_blocks_json, checkpoints_json
      from legalchain_templates
      where ${clauses.join(" and ")}
      order by title asc`,
    args,
  });

  return result.rows.map((row: unknown) => toTemplateRecord(row as Record<string, unknown>));
};

export const listLegalchainTemplateCategories = async (scope?: LegalchainTemplateScope) => {
  await ensureLegalchainSchema();
  await cleanupLegacySeededTemplates();
  const ownerColumnAvailable = await hasLegalchainTemplateOwnerColumn();
  const clauses = ["trim(category) <> ''"];
  const args: (string | number)[] = [];

  appendTemplateOwnershipClause(clauses, args, scope, ownerColumnAvailable);

  const result = await getTursoClient().execute({
    sql: `select distinct category
      from legalchain_templates
      where ${clauses.join(" and ")}
      order by category asc`,
    args,
  });

  return result.rows
    .map((row: unknown) => String((row as Record<string, unknown>).category ?? "").trim())
    .filter(Boolean);
};

export const getLegalchainTemplateBySlug = async (slug: string, scope?: LegalchainTemplateScope) => {
  await ensureLegalchainSchema();
  await cleanupLegacySeededTemplates();
  const ownerColumnAvailable = await hasLegalchainTemplateOwnerColumn();
  const normalizedSlug = sanitizeText(slug);
  if (!normalizedSlug) return null;

  const clauses = ["slug = ?"];
  const args: (string | number)[] = [normalizedSlug];
  appendTemplateOwnershipClause(clauses, args, scope, ownerColumnAvailable);
  const result = await getTursoClient().execute({
    sql: `select slug, ${ownerColumnAvailable ? "user_id, " : ""}title, category, duration, status, version, uses_count, summary, audience, script_blocks_json, checkpoints_json
      from legalchain_templates where ${clauses.join(" and ")} limit 1`,
    args,
  });
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? toTemplateRecord(row) : null;
};

export const createLegalchainTemplate = async (input: {
  userId?: string;
  slug?: string;
  title: string;
  category: string;
  duration?: string;
  status?: string;
  version?: string;
  summary?: string;
  audience?: string;
  scriptBlocks?: { title: string; copy: string }[];
  checkpoints?: string[];
}) => {
  await ensureLegalchainSchema();
  const ownerColumnAvailable = await hasLegalchainTemplateOwnerColumn();

  const title = sanitizeText(input.title);
  const category = sanitizeText(input.category);
  if (!title || !category) {
    throw new Error("Template title and category are required.");
  }

  const slug = slugifyLegalchainTemplate(input.slug || title);
  if (!slug) {
    throw new Error("Template slug could not be generated.");
  }

  const existing = await getLegalchainTemplateBySlug(slug);
  if (existing) {
    throw new Error("A template with that slug already exists.");
  }

  const timestamp = nowIso();
  const userId = sanitizeText(input.userId);
  await getTursoClient().execute(
    ownerColumnAvailable
      ? {
          sql: `insert into legalchain_templates(
            slug, user_id, title, category, duration, status, version, uses_count, summary, audience, script_blocks_json, checkpoints_json, created_at, updated_at
          ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            slug,
            userId || null,
            title,
            category,
            sanitizeText(input.duration) || "45-60 sec",
            sanitizeText(input.status) || "Draft",
            sanitizeText(input.version) || "v1.0",
            0,
            sanitizeText(input.summary),
            sanitizeText(input.audience),
            JSON.stringify(input.scriptBlocks ?? []),
            JSON.stringify(input.checkpoints ?? []),
            timestamp,
            timestamp,
          ],
        }
      : {
          sql: `insert into legalchain_templates(
            slug, title, category, duration, status, version, uses_count, summary, audience, script_blocks_json, checkpoints_json, created_at, updated_at
          ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            slug,
            title,
            category,
            sanitizeText(input.duration) || "45-60 sec",
            sanitizeText(input.status) || "Draft",
            sanitizeText(input.version) || "v1.0",
            0,
            sanitizeText(input.summary),
            sanitizeText(input.audience),
            JSON.stringify(input.scriptBlocks ?? []),
            JSON.stringify(input.checkpoints ?? []),
            timestamp,
            timestamp,
          ],
        },
  );

  return await getLegalchainTemplateBySlug(slug);
};

export const updateLegalchainTemplate = async (slug: string, input: {
  title?: string;
  category?: string;
  duration?: string;
  status?: string;
  version?: string;
  summary?: string;
  audience?: string;
  scriptBlocks?: { title: string; copy: string }[];
  checkpoints?: string[];
}, scope?: LegalchainTemplateScope) => {
  await ensureLegalchainSchema();
  const ownerColumnAvailable = await hasLegalchainTemplateOwnerColumn();
  const normalizedSlug = sanitizeText(slug);
  if (!normalizedSlug) {
    throw new Error("Template slug is required.");
  }

  const existing = await getLegalchainTemplateBySlug(normalizedSlug, scope);
  if (!existing) {
    throw new Error("Template not found.");
  }

  const ownerId = sanitizeText(scope?.userId);
  await getTursoClient().execute(
    ownerColumnAvailable
      ? {
          sql: `update legalchain_templates
            set user_id = case when coalesce(user_id, '') = '' and ? <> '' then ? else user_id end,
            title = ?, category = ?, duration = ?, status = ?, version = ?, summary = ?, audience = ?,
            script_blocks_json = ?, checkpoints_json = ?, updated_at = ?
            where slug = ?`,
          args: [
            ownerId,
            ownerId,
            sanitizeText(input.title) || existing.title,
            sanitizeText(input.category) || existing.category,
            sanitizeText(input.duration) || existing.duration,
            sanitizeText(input.status) || existing.status,
            sanitizeText(input.version) || existing.version,
            sanitizeText(input.summary) || existing.summary,
            sanitizeText(input.audience) || existing.audience,
            JSON.stringify(input.scriptBlocks ?? existing.scriptBlocks),
            JSON.stringify(input.checkpoints ?? existing.checkpoints),
            nowIso(),
            normalizedSlug,
          ],
        }
      : {
          sql: `update legalchain_templates
            set title = ?, category = ?, duration = ?, status = ?, version = ?, summary = ?, audience = ?,
            script_blocks_json = ?, checkpoints_json = ?, updated_at = ?
            where slug = ?`,
          args: [
            sanitizeText(input.title) || existing.title,
            sanitizeText(input.category) || existing.category,
            sanitizeText(input.duration) || existing.duration,
            sanitizeText(input.status) || existing.status,
            sanitizeText(input.version) || existing.version,
            sanitizeText(input.summary) || existing.summary,
            sanitizeText(input.audience) || existing.audience,
            JSON.stringify(input.scriptBlocks ?? existing.scriptBlocks),
            JSON.stringify(input.checkpoints ?? existing.checkpoints),
            nowIso(),
            normalizedSlug,
          ],
        },
  );

  return await getLegalchainTemplateBySlug(normalizedSlug, scope);
};

export const deleteLegalchainTemplate = async (slug: string, scope?: LegalchainTemplateScope) => {
  await ensureLegalchainSchema();
  const normalizedSlug = sanitizeText(slug);
  if (!normalizedSlug) {
    throw new Error("Template slug is required.");
  }

  const existing = await getLegalchainTemplateBySlug(normalizedSlug, scope);
  if (!existing) {
    throw new Error("Template not found.");
  }

  await getTursoClient().execute({
    sql: "delete from legalchain_templates where slug = ?",
    args: [normalizedSlug],
  });

  return true;
};

export const listLegalchainRecords = async (userId: string) => {
  await ensureLegalchainSchema();
  const result = await getTursoClient().execute({
    sql: `select hash, user_id, title, template_slug, template_title, status, updated, duration, visibility, owner,
      token_id, contract_address, collection_name, ipfs_uri, media_url, metadata_json, network, created_at
      from legalchain_records where user_id = ?
      order by created_at desc`,
    args: [userId],
  });

  return result.rows.map((row: unknown) => toRecordRow(row as Record<string, unknown>));
};

export const getLegalchainRecordByHash = async (hash: string, userId?: string | null) => {
  await ensureLegalchainSchema();
  const normalizedHash = sanitizeText(hash);
  if (!normalizedHash) return null;

  const scopedByUser = sanitizeText(userId ?? "");
  const result = await getTursoClient().execute({
    sql: `select hash, user_id, title, template_slug, template_title, status, updated, duration, visibility, owner,
      token_id, contract_address, collection_name, ipfs_uri, media_url, metadata_json, network, created_at
      from legalchain_records
      where hash = ? and (? = '' or user_id = ?)
      limit 1`,
    args: [normalizedHash, scopedByUser, scopedByUser],
  });

  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? toRecordRow(row) : null;
};

export const getLatestLegalchainRecordByUserId = async (userId: string) => {
  await ensureLegalchainSchema();
  const result = await getTursoClient().execute({
    sql: `select hash, user_id, title, template_slug, template_title, status, updated, duration, visibility, owner,
      token_id, contract_address, collection_name, ipfs_uri, media_url, metadata_json, network, created_at
      from legalchain_records
      where user_id = ?
      order by created_at desc
      limit 1`,
    args: [userId],
  });

  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? toRecordRow(row) : null;
};

export const createLegalchainRecord = async (input: {
  userId: string;
  hash: string;
  title: string;
  templateSlug: string;
  templateTitle: string;
  tokenId: string;
  contractAddress: string;
  collectionName?: string;
  tokenUri: string;
  mediaUrl?: string;
  metadataJson?: Record<string, unknown>;
  visibility?: string;
  duration?: string;
  status?: string;
  network?: string;
}) => {
  await ensureLegalchainSchema();
  const user = await getLegalchainUserById(input.userId);
  if (!user) {
    throw new Error("Legalchain user not found.");
  }

  const timestamp = nowIso();
  const metadataJson = input.metadataJson ?? {};
  await getTursoClient().execute({
    sql: `insert or replace into legalchain_records(
      hash,
      user_id,
      title,
      template_slug,
      template_title,
      status,
      updated,
      duration,
      visibility,
      owner,
      token_id,
      contract_address,
      collection_name,
      ipfs_uri,
      media_url,
      metadata_json,
      network,
      created_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      input.hash,
      input.userId,
      input.title,
      input.templateSlug,
      input.templateTitle,
      input.status ?? "Published",
      formatLegalchainRelativeTime(timestamp),
      input.duration ?? "00:00",
      input.visibility ?? "Private",
      user.fullName,
      input.tokenId,
      input.contractAddress,
      input.collectionName ?? "",
      input.tokenUri,
      input.mediaUrl ?? "",
      JSON.stringify(metadataJson),
      input.network ?? "Base",
      timestamp,
    ],
  });

  return await getLegalchainRecordByHash(input.hash, input.userId);
};

export const listLegalchainPayments = async (userId: string) => {
  await ensureLegalchainSchema();
  const result = await getTursoClient().execute({
    sql: `select reference, user_id, flow, status, amount, method, requested_at, provider_reference, details_json
      from legalchain_payments where user_id = ?
      order by requested_at desc`,
    args: [userId],
  });

  return result.rows.map((row: unknown) => {
    const payment = row as Record<string, unknown>;
    return {
      reference: String(payment.reference ?? ""),
      userId: String(payment.user_id ?? ""),
      flow: String(payment.flow ?? ""),
      status: String(payment.status ?? ""),
      amount: String(payment.amount ?? ""),
      method: String(payment.method ?? ""),
      requestedAt: String(payment.requested_at ?? ""),
      providerReference: String(payment.provider_reference ?? ""),
      detailsJson: parseJsonObject(payment.details_json),
    } as LegalchainPaymentRow;
  });
};

export const getLegalchainPaymentByReference = async (reference: string, userId?: string | null) => {
  await ensureLegalchainSchema();
  const normalizedReference = sanitizeText(reference);
  if (!normalizedReference) return null;

  const scopedByUser = sanitizeText(userId ?? "");
  const result = await getTursoClient().execute({
    sql: `select reference, user_id, flow, status, amount, method, requested_at, provider_reference, details_json
      from legalchain_payments
      where reference = ? and (? = '' or user_id = ?)
      limit 1`,
    args: [normalizedReference, scopedByUser, scopedByUser],
  });

  const payment = result.rows[0] as Record<string, unknown> | undefined;
  if (!payment) return null;

  return {
    reference: String(payment.reference ?? ""),
    userId: String(payment.user_id ?? ""),
    flow: String(payment.flow ?? ""),
    status: String(payment.status ?? ""),
    amount: String(payment.amount ?? ""),
    method: String(payment.method ?? ""),
    requestedAt: String(payment.requested_at ?? ""),
    providerReference: String(payment.provider_reference ?? ""),
    detailsJson: parseJsonObject(payment.details_json),
  } as LegalchainPaymentRow;
};

export const getLatestLegalchainPaymentByUserId = async (userId: string) => {
  await ensureLegalchainSchema();
  const result = await getTursoClient().execute({
    sql: `select reference, user_id, flow, status, amount, method, requested_at, provider_reference, details_json
      from legalchain_payments
      where user_id = ?
      order by requested_at desc
      limit 1`,
    args: [userId],
  });

  const payment = result.rows[0] as Record<string, unknown> | undefined;
  if (!payment) return null;

  return {
    reference: String(payment.reference ?? ""),
    userId: String(payment.user_id ?? ""),
    flow: String(payment.flow ?? ""),
    status: String(payment.status ?? ""),
    amount: String(payment.amount ?? ""),
    method: String(payment.method ?? ""),
    requestedAt: String(payment.requested_at ?? ""),
    providerReference: String(payment.provider_reference ?? ""),
    detailsJson: parseJsonObject(payment.details_json),
  } as LegalchainPaymentRow;
};

export const upsertLegalchainPayment = async (input: {
  reference: string;
  userId: string;
  flow: string;
  status: string;
  amount: string;
  method: string;
  requestedAt?: string;
  providerReference?: string | null;
  detailsJson?: Record<string, unknown>;
}) => {
  await ensureLegalchainSchema();
  const existing = await getLegalchainPaymentByReference(input.reference, input.userId);
  const requestedAt = input.requestedAt ?? nowIso();

  if (existing) {
    await getTursoClient().execute({
      sql: `update legalchain_payments
        set flow = ?, status = ?, amount = ?, method = ?, requested_at = ?, provider_reference = ?, details_json = ?
        where reference = ? and user_id = ?`,
      args: [
        input.flow,
        input.status,
        input.amount,
        input.method,
        requestedAt,
        input.providerReference ?? existing.providerReference ?? null,
        JSON.stringify(input.detailsJson ?? existing.detailsJson ?? {}),
        input.reference,
        input.userId,
      ],
    });
  } else {
    await getTursoClient().execute({
      sql: `insert into legalchain_payments(
        reference, user_id, flow, status, amount, method, requested_at, provider_reference, details_json
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        input.reference,
        input.userId,
        input.flow,
        input.status,
        input.amount,
        input.method,
        requestedAt,
        input.providerReference ?? null,
        JSON.stringify(input.detailsJson ?? {}),
      ],
    });
  }

  return await getLegalchainPaymentByReference(input.reference, input.userId);
};

export const getLegalchainWorkspace = async (userId: string, options?: LegalchainWorkspaceOptions) => {
  const [user, wallet, draft, collection, templates, records, payments] = await Promise.all([
    getLegalchainUserById(userId),
    getLegalchainWalletByUserId(userId),
    getLegalchainDraftByUserId(userId),
    getLegalchainCollectionByUserId(userId),
    listLegalchainTemplates(options?.templateFilters),
    listLegalchainRecords(userId),
    listLegalchainPayments(userId),
  ]);

  return {
    user,
    wallet: wallet
      ? {
          address: wallet.address,
          chainId: wallet.chainId,
          createdAt: wallet.createdAt,
        }
      : null,
    draft: draft
      ? {
          title: draft.title,
          templateSlug: draft.templateSlug,
          templateTitle: draft.templateTitle,
          assetHttpUrl: draft.assetHttpUrl,
          assetType: draft.assetType,
          captureStartedAt: draft.captureStartedAt,
          captureEndedAt: draft.captureEndedAt,
          updatedAt: draft.updatedAt,
        }
      : null,
    collection: collection
      ? {
          address: collection.address,
          name: collection.name,
          symbol: collection.symbol,
          chainId: collection.chainId,
          deploymentHash: collection.deploymentHash,
        }
      : null,
    templates,
    records,
    payments,
  };
};

const getLegalchainTemplateStats = async (scope?: LegalchainTemplateScope) => {
  await ensureLegalchainSchema();
  await cleanupLegacySeededTemplates();
  const ownerColumnAvailable = await hasLegalchainTemplateOwnerColumn();
  const clauses = ["1 = 1"];
  const args: (string | number)[] = [];

  appendTemplateOwnershipClause(clauses, args, scope, ownerColumnAvailable);

  const result = await getTursoClient().execute({
    sql: `select
        count(*) as total_count,
        sum(case when status = 'Review' then 1 else 0 end) as review_count
      from legalchain_templates
      where ${clauses.join(" and ")}`,
    args,
  });

  const row = result.rows[0] as Record<string, unknown> | undefined;
  return {
    total: parseRowNumber(row?.total_count),
    review: parseRowNumber(row?.review_count),
  };
};

const getLegalchainRecordStats = async (userId: string) => {
  await ensureLegalchainSchema();
  const result = await getTursoClient().execute({
    sql: `select
        count(*) as total_count,
        sum(case when status = 'Review' then 1 else 0 end) as review_count
      from legalchain_records
      where user_id = ?`,
    args: [userId],
  });

  const row = result.rows[0] as Record<string, unknown> | undefined;
  return {
    total: parseRowNumber(row?.total_count),
    review: parseRowNumber(row?.review_count),
  };
};

const getLegalchainPaymentStats = async (userId: string) => {
  await ensureLegalchainSchema();
  const result = await getTursoClient().execute({
    sql: `select
        count(*) as total_count,
        sum(case when status <> 'Approved' then 1 else 0 end) as pending_count
      from legalchain_payments
      where user_id = ?`,
    args: [userId],
  });

  const row = result.rows[0] as Record<string, unknown> | undefined;
  return {
    total: parseRowNumber(row?.total_count),
    pending: parseRowNumber(row?.pending_count),
  };
};

export const getLegalchainWorkspaceSummary = async (userId: string) => {
  const [wallet, draft, collection, templateStats, recordStats, paymentStats] = await Promise.all([
    getLegalchainWalletByUserId(userId),
    getLegalchainDraftByUserId(userId),
    getLegalchainCollectionByUserId(userId),
    getLegalchainTemplateStats({
      userId,
      ownership: "owned-or-unassigned",
    }),
    getLegalchainRecordStats(userId),
    getLegalchainPaymentStats(userId),
  ]);

  return {
    walletAddress: wallet?.address ?? "",
    hasCollection: Boolean(collection),
    collectionName: collection?.name ?? "",
    recordsCount: recordStats.total,
    templatesCount: templateStats.total,
    pendingPayments: paymentStats.pending,
    reviewItems: templateStats.review + recordStats.review + paymentStats.pending,
    draftTitle: draft?.title ?? "",
  };
};

export const createLegalchainTransactionLog = async (input: {
  userId: string;
  walletId: string;
  kind: string;
  chainId: number;
  toAddress?: string | null;
  contractAddress?: string | null;
  payloadJson: string;
}) => {
  await ensureLegalchainSchema();
  const id = `lc_tx_${randomUUID()}`;
  const timestamp = nowIso();
  await getTursoClient().execute({
    sql: `insert into legalchain_transactions(
      id, user_id, wallet_id, kind, chain_id, to_address, contract_address, tx_hash, status, payload_json, created_at, updated_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      input.userId,
      input.walletId,
      input.kind,
      input.chainId,
      input.toAddress ?? null,
      input.contractAddress ?? null,
      null,
      "pending",
      input.payloadJson,
      timestamp,
      timestamp,
    ],
  });
  return id;
};

export const completeLegalchainTransactionLog = async (transactionId: string, txHash: string) => {
  await ensureLegalchainSchema();
  await getTursoClient().execute({
    sql: `update legalchain_transactions set tx_hash = ?, status = ?, updated_at = ? where id = ?`,
    args: [txHash, "submitted", nowIso(), transactionId],
  });
};

export const failLegalchainTransactionLog = async (transactionId: string) => {
  await ensureLegalchainSchema();
  await getTursoClient().execute({
    sql: `update legalchain_transactions set status = ?, updated_at = ? where id = ?`,
    args: ["failed", nowIso(), transactionId],
  });
};

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { loadDotEnv } from "./coinbase-ws-auth.mjs";

export const EVENT_KINDS = [
  "auth_login",
  "auth_verify",
  "auth_logout",
  "status",
  "balance",
  "address",
  "show",
  "trade",
  "send",
  "fund",
  "x402_search",
  "x402_pay",
  "x402_details",
  "note",
  "other",
];

export const DEFAULT_WALLET = {
  email: "kraftcoding@gmail.com",
  evmAddress: "0xD10d7eA8B847110f3bbf71781ABefbac01517b82",
  solanaAddress: "HCCQTfNtw7dUCB84VCtpEbkAuztLH3B1eUC5Kd9v3Raf",
};

const MIGRATION = join(dirname(fileURLToPath(import.meta.url)), "../../sql/wallet-events.sql");

export function databaseUrl() {
  loadDotEnv();
  const raw = (process.env.DATABASE_URL || "").trim();
  if (!raw) {
    throw new Error("Set DATABASE_URL in .env (see .env.example). Do not commit the real URL.");
  }
  return raw
    .replace(/&channel_binding=require/g, "")
    .replace(/\?channel_binding=require&/, "?")
    .replace(/sslmode=require\b/, "sslmode=verify-full");
}

export function createPool() {
  return new pg.Pool({
    connectionString: databaseUrl(),
    ssl: { rejectUnauthorized: true },
    max: 2,
  });
}

export function redactArgs(args) {
  const out = [...args];
  const verify = out.findIndex((item, i) => item === "verify" && out[i - 1] === "auth");
  if (verify >= 0 && out[verify + 1]) out[verify + 1] = "[redacted]";
  return out;
}

export function classifyAwalArgs(args) {
  const [cmd, sub, third] = args;
  const event = {
    kind: "other",
    email: DEFAULT_WALLET.email,
    evmAddress: DEFAULT_WALLET.evmAddress,
    solanaAddress: DEFAULT_WALLET.solanaAddress,
    chain: flag(args, "--chain", "-c") || (cmd === "trade" || cmd === "swap" || cmd === "send" ? "base" : null),
    fromAsset: null,
    toAsset: null,
    amount: null,
    recipient: null,
    command: ["awal", ...redactArgs(args)].join(" "),
    payload: {},
  };

  if (cmd === "auth" && sub === "login") {
    event.kind = "auth_login";
    if (third && third.includes("@")) event.email = third;
  } else if (cmd === "auth" && sub === "verify") {
    event.kind = "auth_verify";
  } else if (cmd === "auth" && sub === "logout") {
    event.kind = "auth_logout";
  } else if (cmd === "status") event.kind = "status";
  else if (cmd === "balance") event.kind = "balance";
  else if (cmd === "address") event.kind = "address";
  else if (cmd === "show") event.kind = "show";
  else if (cmd === "trade" || cmd === "swap") {
    event.kind = "trade";
    event.amount = parseAmount(sub);
    event.fromAsset = third || null;
    event.toAsset = args[3] && !args[3].startsWith("-") ? args[3] : null;
  } else if (cmd === "send") {
    event.kind = "send";
    event.amount = parseAmount(sub);
    event.recipient = third || null;
    event.fromAsset = flag(args, "--asset") || "usdc";
  } else if (cmd === "x402" && sub === "pay") {
    event.kind = "x402_pay";
    event.payload = { url: third || null };
  } else if (cmd === "x402" && sub === "details") {
    event.kind = "x402_details";
    event.payload = { url: third || null };
  } else if (cmd === "x402" && (sub === "bazaar" || third === "search" || sub === "search")) {
    event.kind = "x402_search";
  }

  return event;
}

function flag(args, ...names) {
  for (const name of names) {
    const index = args.indexOf(name);
    if (index >= 0 && args[index + 1]) return args[index + 1];
  }
  return null;
}

function parseAmount(value) {
  if (value == null) return null;
  const n = Number(String(value).replace(/^\$/, ""));
  return Number.isFinite(n) ? n : null;
}

export async function migrate(pool = createPool()) {
  const sql = readFileSync(MIGRATION, "utf8");
  await pool.query(sql);
}

export async function recordEvent(event, pool = createPool()) {
  const row = {
    kind: event.kind,
    status: event.status || "succeeded",
    email: event.email ?? DEFAULT_WALLET.email,
    evm_address: event.evmAddress ?? event.evm_address ?? DEFAULT_WALLET.evmAddress,
    solana_address: event.solanaAddress ?? event.solana_address ?? DEFAULT_WALLET.solanaAddress,
    chain: event.chain ?? null,
    from_asset: event.fromAsset ?? event.from_asset ?? null,
    to_asset: event.toAsset ?? event.to_asset ?? null,
    amount: event.amount ?? null,
    recipient: event.recipient ?? null,
    tx_hash: event.txHash ?? event.tx_hash ?? null,
    command: event.command ?? null,
    error: event.error ?? null,
    payload: event.payload ?? {},
  };

  const result = await pool.query(
    `insert into wallet.events (
       kind, status, email, evm_address, solana_address, chain,
       from_asset, to_asset, amount, recipient, tx_hash, command, error, payload
     ) values (
       $1, $2, $3, $4, $5, $6,
       $7, $8, $9, $10, $11, $12, $13, $14::jsonb
     ) returning id, occurred_at`,
    [
      row.kind,
      row.status,
      row.email,
      row.evm_address,
      row.solana_address,
      row.chain,
      row.from_asset,
      row.to_asset,
      row.amount,
      row.recipient,
      row.tx_hash,
      row.command,
      row.error,
      JSON.stringify(row.payload),
    ],
  );
  return result.rows[0];
}

export async function recordAwalCommand(args, { status, error } = {}) {
  const event = classifyAwalArgs(args);
  event.status = status || "succeeded";
  event.error = error || null;
  return recordEvent(event);
}

export async function listEvents({ kind, limit = 20 } = {}, pool = createPool()) {
  const params = [];
  let where = "";
  if (kind) {
    params.push(kind);
    where = `where kind = $${params.length}`;
  }
  params.push(Math.min(Number(limit) || 20, 200));
  const result = await pool.query(
    `select id, occurred_at, kind, status, email, chain, from_asset, to_asset,
            amount, recipient, tx_hash, command, error
       from wallet.events
       ${where}
      order by occurred_at desc
      limit $${params.length}`,
    params,
  );
  return result.rows;
}

export function formatEvent(row) {
  const when = new Date(row.occurred_at).toISOString().replace("T", " ").replace(/\.\d+Z$/, "Z");
  const move =
    row.kind === "trade" && row.from_asset
      ? `${row.amount ?? ""} ${row.from_asset} -> ${row.to_asset ?? ""}`.trim()
      : row.kind === "send"
        ? `${row.amount ?? ""} ${row.from_asset ?? ""} -> ${row.recipient ?? ""}`.trim()
        : "";
  const extra = [row.chain, move, row.tx_hash, row.error].filter(Boolean).join("  ");
  return `${when}  ${row.kind.padEnd(12)} ${row.status.padEnd(9)} ${extra}`.trimEnd();
}

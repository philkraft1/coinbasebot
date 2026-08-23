#!/usr/bin/env node
/**
 * Agentic Wallet event log on Neon.
 *
 *   node scripts/wallet-events.mjs migrate
 *   node scripts/wallet-events.mjs list
 *   node scripts/wallet-events.mjs list --kind trade --limit 10
 *   node scripts/wallet-events.mjs record --kind note --status succeeded --payload '{"text":"hello"}'
 */
import {
  DEFAULT_WALLET,
  createPool,
  formatEvent,
  listEvents,
  migrate,
  recordEvent,
} from "./lib/wallet-events.mjs";

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1 || !process.argv[index + 1]) return fallback;
  return process.argv[index + 1];
}

const command = process.argv[2] || "list";
const pool = createPool({ unpooled: command === "migrate" });

try {
  if (command === "migrate") {
    const result = await migrate(pool);
    await recordEvent(
      {
        kind: "note",
        status: "succeeded",
        command: "wallet-events migrate",
        payload: {
          source: "migrate",
          wallet: DEFAULT_WALLET,
          text: "wallet.events is ready. awal commands via scripts/run-awal.mjs are recorded here.",
        },
      },
      pool,
    );
    const existing = await pool.query(
      `select 1 from wallet.events where tx_hash = $1 limit 1`,
      ["0xb9466e15f6a0e7a3d5788cc7e03db8a25aa895a5a5d4d1a19f2ed304cbcb3c04"],
    );
    if (existing.rowCount === 0) {
      await recordEvent(
        {
          kind: "trade",
          status: "succeeded",
          chain: "base",
          fromAsset: "usdc",
          toAsset: "eth",
          amount: 1,
          txHash: "0xb9466e15f6a0e7a3d5788cc7e03db8a25aa895a5a5d4d1a19f2ed304cbcb3c04",
          command: "awal trade 1 usdc eth",
          payload: {
            source: "bootstrap",
            note: "Known $1 USDC -> ETH smoke swap on the funded kraftcoding wallet.",
            explorer: "https://basescan.org/tx/0xb9466e15f6a0e7a3d5788cc7e03db8a25aa895a5a5d4d1a19f2ed304cbcb3c04",
          },
        },
        pool,
      );
    }
    console.log("wallet.events is ready on Neon (RLS + wallet_app).");
    if (result.appUrl) {
      console.log("Set DATABASE_URL in .env to this pooled wallet_app URL. Do not commit it.");
      console.log("Keep DATABASE_URL_UNPOOLED as the neondb_owner direct URL for npm run db:migrate.");
      console.log(result.appUrl);
    }
  } else if (command === "list") {
    const rows = await listEvents({ kind: arg("--kind", ""), limit: arg("--limit", "20") }, pool);
    if (!rows.length) {
      console.log("No wallet events yet. Run a command with node scripts/run-awal.mjs …");
    } else {
      for (const row of rows) console.log(formatEvent(row));
    }
  } else if (command === "record") {
    const payloadRaw = arg("--payload", "{}");
    let payload = {};
    try {
      payload = JSON.parse(payloadRaw);
    } catch {
      throw new Error("--payload must be JSON");
    }
    const row = await recordEvent(
      {
        kind: arg("--kind", "note"),
        status: arg("--status", "succeeded"),
        chain: arg("--chain", null),
        fromAsset: arg("--from", null),
        toAsset: arg("--to", null),
        amount: arg("--amount", null),
        recipient: arg("--recipient", null),
        txHash: arg("--tx", null),
        command: arg("--command", "wallet-events record"),
        error: arg("--error", null),
        payload,
      },
      pool,
    );
    console.log("recorded", row.id);
  } else {
    console.error("Usage: node scripts/wallet-events.mjs migrate|list|record");
    process.exit(1);
  }
} finally {
  await pool.end();
}

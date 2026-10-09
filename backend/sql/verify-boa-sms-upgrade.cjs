// Run with: node backend/sql/verify-boa-sms-upgrade.cjs <path-to-pglite-package>
// Uses an isolated in-memory PostgreSQL instance; never touches the live ledger.
const { PGlite } = require(process.argv[2] || "@electric-sql/pglite");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
(async () => {
  const db = new PGlite();
  try {
    await db.exec("create role service_role; create table public.transactions (id bigserial primary key, amount text); create table public.boa_sms_events (id bigserial primary key);");
    await db.exec(fs.readFileSync(path.join(__dirname, "boa_sms_account_state.sql"), "utf8"));
    const upgrade = fs.readFileSync(path.join(__dirname, "boa_sms_transaction_import.sql"), "utf8");
    await db.exec(upgrade);
    await db.exec(upgrade); // Additive upgrade is safe to rerun.
    const write = async incoming => db.query("select * from public.merge_boa_sms_state($1::jsonb)", [JSON.stringify({ id: 1, updated_at: new Date().toISOString(), ...incoming })]);
    await write({ current_balance: "900", balance_updated_at: "2026-10-09T08:30:00Z", latest_withdrawal_amount: "100", withdrawal_updated_at: "2026-10-09T08:30:00Z", last_sms_at: "2026-10-09T08:30:00Z", last_sender: "BOA", last_message_hash: "new" });
    await write({ current_balance: "800", balance_updated_at: "2026-10-08T08:30:00Z", latest_deposit_amount: "50", deposit_updated_at: "2026-10-08T08:30:00Z", last_sms_at: "2026-10-08T08:30:00Z", last_message_hash: "old" });
    let row = (await db.query("select * from public.boa_sms_account_state")).rows[0];
    assert.equal(Number(row.current_balance), 900);
    assert.equal(Number(row.latest_withdrawal_amount), 100);
    assert.equal(Number(row.latest_deposit_amount), 50);
    assert.equal(row.last_message_hash, "new");
    await write({ latest_deposit_amount: "200", deposit_updated_at: "2026-10-10T08:30:00Z", last_sms_at: "2026-10-10T08:30:00Z", last_message_hash: "newer" });
    row = (await db.query("select * from public.boa_sms_account_state")).rows[0];
    assert.equal(Number(row.current_balance), 900);
    assert.equal(Number(row.latest_deposit_amount), 200);
    await db.exec("insert into public.transactions (amount,source_sms_hash) values ('100','same-sms')");
    await assert.rejects(() => db.exec("insert into public.transactions (amount,source_sms_hash) values ('100','same-sms')"), error => error.code === "23505");
    await db.exec("insert into public.transactions (amount) values ('100'),('100')");
    console.log("PostgreSQL verification passed: repeatable upgrade, timestamp-aware state merge, duplicate SMS constraint, ordinary inserts preserved.");
  } finally { await db.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

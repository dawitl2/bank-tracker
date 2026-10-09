const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { registerBoaSmsImportRoutes } = require("./boaSmsImportRoutes");
const { mergeFields } = require("./boaSmsState");
const fs = require("node:fs");
const path = require("node:path");

test("backend deployment has a self-contained copy of the frontend SMS matching rules", () => {
  const read = file => fs.readFileSync(path.join(__dirname, file), "utf8").replace(/\r\n/g, "\n");
  assert.equal(read("boaSmsImport.js"), read("../src/boaSmsImport.js"));
});

const latest = { id: 2, message_hash: "newest", sms_received_at: "2026-10-09T08:30:00Z", transaction_type: "withdrawal", amount: "1200.50", raw_reference: "FT26282TEST", narrative: "Materials", receipt_url: "https://cs.bankofabyssinia.com/slip/?trx=FT26282TEST41349" };
function database(events = [latest], rows = []) {
  return { events, rows, inserts: 0, from(table) {
    const db = this;
    let insert, filter;
    const query = {
      select() { return query; }, order() { return query; }, limit() { return query; },
      eq(key, value) { filter = row => row[key] === value; return query; },
      insert(values) { insert = values[0]; return query; },
      then(resolve) { return Promise.resolve({ data: table === "transactions" ? db.rows : db.events }).then(resolve); },
      async maybeSingle() { return { data: table === "transactions" ? db.rows.find(filter) || null : db.events[0] || null }; },
      async single() {
        if (db.rows.some(row => row.source_sms_hash === insert.source_sms_hash)) return { error: { code: "23505" } };
        const row = { id: ++db.inserts, ...insert }; db.rows.push(row); return { data: row };
      }
    }; return query;
  } };
}
async function server(t, db, bank = async () => ({ status: 502 })) {
  const app = express(); app.use(express.json()); registerBoaSmsImportRoutes(app, db, bank);
  const listener = app.listen(0, "127.0.0.1");
  await new Promise(resolve => listener.once("listening", resolve));
  t.after(() => { listener.closeAllConnections(); listener.close(); });
  const origin = `http://127.0.0.1:${listener.address().port}`;
  return async (path, body) => {
    const response = await fetch(origin + path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
    return { status: response.status, body: await response.json() };
  };
}
test("only the latest event is offered; matching latest suppresses older unmatched SMS", async t => {
  const db = database([latest, { ...latest, id: 1, message_hash: "old" }], [{ id: 7, reference: latest.raw_reference }]);
  const request = await server(t, db);
  assert.equal((await request("/boa-sms/latest-transaction")).body.already_added, true);
  assert.equal((await request("/boa-sms/transactions/latest", { message_hash: "old", person: "mihret" })).status, 409);
  assert.equal(db.inserts, 0);
});
test("one click inserts all SMS fields and repeated/concurrent adds cannot duplicate", async t => {
  const db = database(); const request = await server(t, db);
  const body = { message_hash: latest.message_hash, person: "mihret" };
  const results = await Promise.all([request("/boa-sms/transactions/latest", body), request("/boa-sms/transactions/latest", body)]);
  assert.equal(db.rows.length, 1);
  assert.ok(results.every(result => [200, 201].includes(result.status)));
  assert.deepEqual(db.rows[0], { id: 1, amount: "1200.50", date: "09/10/26 11:30", reference: latest.raw_reference, narrative: "Materials", receipt_url: latest.receipt_url, is_withdraw: true, person: "mihret", source_sms_hash: "newest" });
  assert.equal((await request("/boa-sms/transactions/latest", body)).body.already_added, true);
});
test("receipt metadata fills only missing fields when bank amount and reference agree", async t => {
  const db = database([{ ...latest, narrative: null }]);
  const request = await server(t, db, async () => ({ status: 200, body: { data: { "Transaction Reference": latest.raw_reference, "Transferred Amount": "1200.50", "Transaction Date": "09/10/26 11:29", Narrative: "Bank narrative" } } }));
  await request("/boa-sms/transactions/latest", { message_hash: "newest", person: null });
  assert.equal(db.rows[0].narrative, "Bank narrative");
  assert.equal(db.rows[0].date, "09/10/26 11:29");
});
test("a newer SMS arriving during receipt fetch prevents adding the stale candidate", async t => {
  const db = database();
  const request = await server(t, db, async () => { db.events.unshift({ ...latest, id: 3, message_hash: "even-newer" }); return { status: 502 }; });
  assert.equal((await request("/boa-sms/transactions/latest", { message_hash: "newest" })).status, 409);
  assert.equal(db.inserts, 0);
});
test("receipt enrichment recognizes a manual ledger row even when SMS omitted the reference", async t => {
  const db = database([{ ...latest, raw_reference: null }], [{ id: 5, reference: latest.raw_reference }]);
  const request = await server(t, db, async () => ({ status: 200, body: { data: { "Transaction Reference": latest.raw_reference, "Transferred Amount": "1200.50", "Transaction Date": "09/10/26 11:30" } } }));
  const result = await request("/boa-sms/transactions/latest", { message_hash: "newest", person: "mihret" });
  assert.equal(result.body.already_added, true);
  assert.equal(db.inserts, 0);
});
test("an older queued update preserves newer per-field values but can fill a missing deposit", () => {
  const previous = { current_balance: "200", balance_updated_at: "2026-10-09T08:30:00Z", last_sms_at: "2026-10-09T08:30:00Z" };
  const incoming = { id: 1, current_balance: "100", balance_updated_at: "2026-10-08T08:30:00Z", last_sms_at: "2026-10-08T08:30:00Z", last_sender: "BOA", latest_deposit_amount: "50", deposit_updated_at: "2026-10-08T08:30:00Z" };
  assert.deepEqual(mergeFields(previous, incoming), { id: 1, latest_deposit_amount: "50", deposit_updated_at: "2026-10-08T08:30:00Z" });
});

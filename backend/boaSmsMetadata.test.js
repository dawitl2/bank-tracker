const test = require("node:test");
const assert = require("node:assert/strict");
const { encodeSmsEvent, decodeSmsEvent } = require("./boaSmsMetadata");

test("receipt details round trip in the original SMS table without new columns", () => {
  const event = { sms_received_at: "2026-10-09T08:30:00Z", sender: "BOA", message_hash: "abc",
    transaction_type: "deposit", amount: "123.00", balance_after: "500.00", raw_reference: "FT26282TEST",
    transaction_date: "09/10/26 11:29", narrative: "Payment ሙከራ", receipt_url: "https://cs.bankofabyssinia.com/slip/?trx=FT26282TEST41349" };
  const stored = encodeSmsEvent(event);
  assert.deepEqual(Object.keys(stored).sort(), ["sms_received_at", "sender", "message_hash", "transaction_type", "amount", "balance_after", "raw_reference"].sort());
  assert.deepEqual(decodeSmsEvent(stored), event);
});

test("historical plain references and existing expanded rows stay readable", () => {
  assert.deepEqual(encodeSmsEvent({ raw_reference: "FT123" }), { raw_reference: "FT123" });
  assert.equal(decodeSmsEvent({ raw_reference: "FT123" }).raw_reference, "FT123");
  assert.equal(decodeSmsEvent({ raw_reference: "boa-sms:v1:bad-json" }).raw_reference, "boa-sms:v1:bad-json");
  const row = { raw_reference: "FT123", narrative: "Existing narrative", transaction_date: "09/10/26 11:29", receipt_url: null };
  assert.deepEqual(decodeSmsEvent(row), row);
});

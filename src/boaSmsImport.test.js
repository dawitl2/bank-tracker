const { matchesSmsTransaction, newestSmsEvent, smsTransactionDraft, receiptLink } = require("./boaSmsImport");

const event = { message_hash: "sms-1", sms_received_at: "2026-10-09T08:30:00Z", transaction_type: "withdrawal", amount: "1,200.50", raw_reference: "FT26282TEST", narrative: "Materials", receipt_url: "https://cs.bankofabyssinia.com/slip/?trx=FT26282TEST41349" };

test("imports known SMS details with Addis Ababa date and the real receipt link", () => {
  expect(smsTransactionDraft(event, "mihret")).toEqual({ amount: "1200.50", date: "09/10/26 11:30", reference: "FT26282TEST", narrative: "Materials", receipt_url: event.receipt_url, is_withdraw: true, person: "mihret", source_sms_hash: "sms-1" });
});
test("latest selection does not import older unmatched messages", () => {
  expect(newestSmsEvent([{ ...event, message_hash: "old", sms_received_at: "2026-10-08T08:30:00Z" }, event])).toBe(event);
  expect(matchesSmsTransaction(event, { reference: "ft26282test" })).toBe(true);
});
test("matching distinguishes same amount with different references and dates", () => {
  expect(matchesSmsTransaction(event, { reference: "OTHER", amount: 1200.50, date: "09/10/2026 11:30", is_withdraw: true })).toBe(false);
  const withoutReference = { ...event, raw_reference: null, receipt_url: null };
  expect(matchesSmsTransaction(withoutReference, { amount: 1200.50, date: "09/10/2026 11:30", is_withdraw: true })).toBe(true);
  expect(matchesSmsTransaction(withoutReference, { amount: 1200.50, date: "09/10/2026 11:31", is_withdraw: true })).toBe(false);
  expect(matchesSmsTransaction(withoutReference, { amount: 1200.50, date: "09/10/2026 11:30", is_withdraw: false })).toBe(false);
});
test("never invents missing narrative/reference/link or accepts another host", () => {
  expect(smsTransactionDraft({ ...event, raw_reference: null, narrative: null, receipt_url: null }, "null")).toMatchObject({ reference: null, narrative: null, receipt_url: null, person: null });
  expect(receiptLink("https://evil.example/slip/?trx=FT26282TEST41349")).toBeNull();
});

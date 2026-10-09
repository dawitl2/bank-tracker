import { decodeSmsEvent, matchesSmsTransaction, receiptLink } from "./boaSmsImport";

export const API_URL = process.env.REACT_APP_API_URL || "https://bank-backend-anhp.onrender.com";
const SMS_DATABASE_URL = "https://ywplzexakisliebyjtyf.supabase.co";
// The same publishable read key used by the rest of the app.
const SMS_READ_KEY = "sb_publishable_nmA6IJsDGUVki5i0smS1Tg_MLXy5_wX";

export async function readJsonResponse(response, message) {
  let data;
  try { data = JSON.parse(await response.text()); }
  catch { throw new Error(message); }
  if (!response.ok) throw new Error(message);
  return data;
}

export async function checkLatestSms(signal) {
  // Read the existing SMS table and ledger. This also works with the live
  // backend version that predates /boa-sms/latest-transaction.
  const [events, transactions] = await Promise.all([
    fetch(`${SMS_DATABASE_URL}/rest/v1/boa_sms_events?select=*&transaction_type=in.(deposit,withdrawal)&amount=gt.0&order=sms_received_at.desc,id.desc&limit=1`, {
      headers: { apikey: SMS_READ_KEY, Accept: "application/json" }, cache: "no-store", signal
    }).then(response => readJsonResponse(response, "Could not load the latest BOA SMS. Please try again.")),
    fetch(`${API_URL}/transactions`, { headers: { Accept: "application/json" }, cache: "no-store", signal })
      .then(response => readJsonResponse(response, "Could not load saved transactions. Please try again."))
  ]);
  if (!Array.isArray(events) || !Array.isArray(transactions)) throw new Error("Could not compare transactions. Please try again.");
  const event = decodeSmsEvent(events[0]);
  if (!event) return { event: null, transaction: null, already_added: false };
  const link = receiptLink(event.receipt_url);
  if (link && (!event.raw_reference || !event.transaction_date || !event.narrative)) {
    try {
      const response = await fetch(`/api/boa-receipt?kind=details&trx=${encodeURIComponent(new URL(link).searchParams.get("trx"))}`, { signal });
      const { data } = await readJsonResponse(response, "Bank receipt unavailable");
      if (data && (!event.raw_reference || event.raw_reference === data["Transaction Reference"]) && Number(event.amount) === Number(data["Transferred Amount"])) {
        event.raw_reference = event.raw_reference || data["Transaction Reference"];
        event.transaction_date = event.transaction_date || data["Transaction Date"];
        event.narrative = event.narrative || data.Narrative || data.Description || null;
      }
    } catch { /* Known SMS fields remain usable when the receipt is unavailable. */ }
  }
  const transaction = transactions.find(row => matchesSmsTransaction(event, row)) || null;
  return { event, transaction, already_added: Boolean(transaction) };
}

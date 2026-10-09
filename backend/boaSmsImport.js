// Shared by the Apollo prompt and backend so duplicate checks use the same rules.
const amountValue = value => Number(String(value ?? "").replace(/[^\d.-]/g, ""));

function transactionDate(value) {
  const text = String(value || "").trim();
  const bank = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (bank) {
    const [, day, month, rawYear, hour = "0", minute = "0", second = "0"] = bank;
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    return Date.parse(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:${second.padStart(2, "0")}+03:00`);
  }
  return Date.parse(text);
}

function formatTransactionDate(value) {
  const millis = transactionDate(value);
  if (!Number.isFinite(millis)) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Addis_Ababa", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(new Date(millis));
  const part = type => parts.find(item => item.type === type)?.value;
  // Existing ledger/date analytics use BOA's two-digit year format.
  return `${part("day")}/${part("month")}/${part("year").slice(-2)} ${part("hour")}:${part("minute")}`;
}

function receiptLink(value) {
  try {
    const url = new URL(value);
    const token = url.searchParams.get("trx");
    if (url.origin === "https://cs.bankofabyssinia.com" && /^\/slip\/?$/.test(url.pathname) && /^[a-z0-9]{10,60}$/i.test(token || "")) {
      return `https://cs.bankofabyssinia.com/slip/?trx=${token}`;
    }
  } catch { /* SMS can lack a receipt link. */ }
  return null;
}

function referenceValue(value) {
  return String(value || "").trim().toUpperCase();
}

function matchesSmsTransaction(event, transaction) {
  if (event.message_hash && transaction.source_sms_hash === event.message_hash) return true;
  const reference = referenceValue(event.raw_reference || event.reference);
  const savedReference = referenceValue(transaction.reference);
  if (reference && savedReference && reference === savedReference) return true;
  const eventLink = receiptLink(event.receipt_url);
  if (eventLink && eventLink === receiptLink(transaction.receipt_url)) return true;
  if (eventLink && savedReference === referenceValue(new URL(eventLink).searchParams.get("trx"))) return true;
  if (reference && savedReference) return false;
  // Without a reference, require amount, direction and the same transaction minute.
  const eventDate = transactionDate(event.transaction_date || event.sms_received_at);
  const savedDate = transactionDate(transaction.date);
  return amountValue(event.amount) === amountValue(transaction.amount) &&
    (event.transaction_type === "withdrawal") === (transaction.is_withdraw !== false) &&
    Number.isFinite(eventDate) && Number.isFinite(savedDate) &&
    Math.floor(eventDate / 60000) === Math.floor(savedDate / 60000);
}

function newestSmsEvent(events) {
  return (events || []).filter(event => ["deposit", "withdrawal"].includes(event.transaction_type) && amountValue(event.amount) > 0)
    .reduce((latest, event) => !latest || transactionDate(event.sms_received_at) > transactionDate(latest.sms_received_at) ? event : latest, null);
}

function smsTransactionDraft(event, person = null) {
  return {
    amount: amountValue(event.amount).toFixed(2),
    date: formatTransactionDate(event.transaction_date || event.sms_received_at),
    reference: event.raw_reference || event.reference || null,
    narrative: event.narrative || null,
    receipt_url: receiptLink(event.receipt_url),
    is_withdraw: event.transaction_type === "withdrawal",
    person: person === "null" || !person ? null : person,
    source_sms_hash: event.message_hash
  };
}

module.exports = { transactionDate, formatTransactionDate, receiptLink, matchesSmsTransaction, newestSmsEvent, smsTransactionDraft };

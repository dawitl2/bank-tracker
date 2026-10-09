const { receiptLink } = require("./boaSmsImport");

// Keep the SMS details in the existing text field so older databases need no DDL.
// API callers always receive the plain reference and separate metadata fields.
const PREFIX = "boa-sms:v1:";

function encodeSmsEvent(event) {
  const { transaction_date, narrative, receipt_url, ...stored } = event;
  if (transaction_date || narrative || receiptLink(receipt_url)) {
    stored.raw_reference = PREFIX + JSON.stringify({
      reference: event.raw_reference || null,
      transaction_date: transaction_date || null,
      narrative: narrative || null,
      receipt_url: receiptLink(receipt_url)
    });
  }
  return stored;
}

function decodeSmsEvent(event) {
  if (!event) return null;
  if (typeof event.raw_reference === "string" && event.raw_reference.startsWith(PREFIX)) {
    try {
      const details = JSON.parse(event.raw_reference.slice(PREFIX.length));
      return { ...event, raw_reference: details.reference || null,
        transaction_date: details.transaction_date || null,
        narrative: details.narrative || null, receipt_url: receiptLink(details.receipt_url) };
    } catch { /* A historical plain reference remains readable. */ }
  }
  return { ...event, receipt_url: receiptLink(event.receipt_url) };
}

module.exports = { encodeSmsEvent, decodeSmsEvent };

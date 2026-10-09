const { matchesSmsTransaction, smsTransactionDraft, receiptLink } = require("./boaSmsImport");
const { decodeSmsEvent } = require("./boaSmsMetadata");
const { getBankReceipt } = require("./boaReceipt");

function registerBoaSmsImportRoutes(app, supabase, fetchReceipt = getBankReceipt) {
  async function latestSnapshot(enrich = false) {
    const { data: storedEvent, error } = await supabase.from("boa_sms_events").select("*")
      .in("transaction_type", ["deposit", "withdrawal"]).gt("amount", 0)
      .order("sms_received_at", { ascending: false }).order("id", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    if (!storedEvent) return { event: null, existing: null, transactions: [] };
    const event = decodeSmsEvent(storedEvent);
    const link = receiptLink(event.receipt_url);
    if (enrich && link && (!event.raw_reference || !event.transaction_date || !event.narrative)) {
      // Bank receipt availability must not stop an import of the SMS's known fields.
      const receipt = await fetchReceipt(new URL(link).searchParams.get("trx")).catch(() => ({ status: 502 }));
      if (receipt.status === 200) {
        const data = receipt.body.data;
        if ((!event.raw_reference || event.raw_reference === data["Transaction Reference"]) && Number(event.amount) === Number(data["Transferred Amount"])) {
          event.raw_reference = event.raw_reference || data["Transaction Reference"];
          event.transaction_date = event.transaction_date || data["Transaction Date"];
          event.narrative = event.narrative || data.Narrative || data.Description || null;
        }
      }
    }
    // Select existing columns only; no source_sms_hash column is required.
    const { data: transactions, error: transactionError } = await supabase.from("transactions").select("*");
    if (transactionError) throw transactionError;
    return { event, transactions: transactions || [], existing: (transactions || []).find(tx => matchesSmsTransaction(event, tx)) || null };
  }

  app.get("/boa-sms/latest-transaction", async (req, res) => {
    try {
      const { event, existing } = await latestSnapshot(true);
      res.json({ event, already_added: Boolean(existing) });
    } catch (error) {
      res.status(503).json({ error: "Could not check the latest BOA transaction", details: error.message });
    }
  });

  async function saveLatest(hash, person, narrative) {
    const { event, existing } = await latestSnapshot(true);
    if (!event || hash !== event.message_hash) {
      return { status: 409, body: { error: "A newer BOA SMS is available. Check latest again before adding." } };
    }
    if (existing) return { status: 200, transaction: existing, already_added: true };
    if (person != null && typeof person !== "string") return { status: 400, body: { error: "Choose a valid person" } };
    if (narrative !== undefined && narrative !== null && (typeof narrative !== "string" || narrative.length > 2000)) {
      return { status: 400, body: { error: "Narrative must be text of up to 2,000 characters" } };
    }
    const draft = smsTransactionDraft(event, person);
    draft.narrative = narrative === undefined ? draft.narrative || "Materials" : narrative?.trim() || null;
    if (!draft.date || !Number.isFinite(Number(draft.amount)) || Number(draft.amount) <= 0) {
      return { status: 422, body: { error: "SMS amount or date is missing" } };
    }
    const { event: newest, existing: addedMeanwhile, transactions } = await latestSnapshot();
    if (!newest || newest.message_hash !== event.message_hash) {
      return { status: 409, body: { error: "A newer BOA SMS is available. Check latest again before adding." } };
    }
    const matching = addedMeanwhile || transactions.find(tx => matchesSmsTransaction(event, tx));
    if (matching) return { status: 200, transaction: matching, already_added: true };
    const { data, error } = await supabase.from("transactions").insert([draft]).select().single();
    if (error) throw error;
    return { status: 201, transaction: data, already_added: false };
  }

  // Serialize imports in this backend process so double clicks/retries recheck
  // the saved table before insertion, without changing the existing schema.
  let savingTail = Promise.resolve();
  const importHandler = legacy => async (req, res, next) => {
    const hash = legacy ? req.body?.message_hash : req.body?._boa_sms_message_hash;
    if (!legacy && !Object.prototype.hasOwnProperty.call(req.body || {}, "_boa_sms_message_hash")) return next();
    try {
      const pending = savingTail.then(() => saveLatest(hash, req.body?.person, req.body?.narrative));
      savingTail = pending.catch(() => {});
      const result = await pending;
      res.status(result.status).json(result.body || (legacy
        ? { transaction: result.transaction, already_added: result.already_added }
        : result.transaction));
    } catch (error) {
      res.status(503).json({ error: "Could not add the BOA transaction. Please try again.", details: error.message });
    }
  };
  // Same endpoint and response as the plus button; the marker is never stored.
  app.post("/transactions", importHandler(false));
  // Retain compatibility for clients loaded before the manual-check update.
  app.post("/boa-sms/transactions/latest", importHandler(true));
}

module.exports = { registerBoaSmsImportRoutes };

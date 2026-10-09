const { matchesSmsTransaction, smsTransactionDraft, receiptLink, formatTransactionDate } = require("../src/boaSmsImport");
const { getBankReceipt } = require("./boaReceipt");

function registerBoaSmsImportRoutes(app, supabase, fetchReceipt = getBankReceipt) {
  async function latestSnapshot(enrich = false) {
    const { data: storedEvent, error } = await supabase.from("boa_sms_events").select("*")
      .order("sms_received_at", { ascending: false }).order("id", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    if (!storedEvent) return { event: null, existing: null };
    const event = { ...storedEvent };
    const link = receiptLink(event.receipt_url);
    if (enrich && link && (!event.raw_reference || !event.transaction_date || !event.narrative)) {
      const receipt = await fetchReceipt(new URL(link).searchParams.get("trx"));
      if (receipt.status === 200) {
        const data = receipt.body.data;
        if ((!event.raw_reference || event.raw_reference === data["Transaction Reference"]) && Number(event.amount) === Number(data["Transferred Amount"])) {
          event.raw_reference = event.raw_reference || data["Transaction Reference"];
          event.transaction_date = event.transaction_date || data["Transaction Date"];
          event.narrative = event.narrative || data.Narrative || data.Description || null;
        }
      }
    }
    const { data: transactions, error: transactionError } = await supabase.from("transactions")
      .select("id, amount, date, reference, narrative, receipt_url, is_withdraw, person, source_sms_hash");
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

  app.post("/boa-sms/transactions/latest", async (req, res) => {
    try {
      const { event, existing } = await latestSnapshot();
      if (!event || req.body?.message_hash !== event.message_hash) {
        return res.status(409).json({ error: "A newer BOA SMS is available. Reopen Apollo to check the latest transaction." });
      }
      if (existing) return res.json({ transaction: existing, already_added: true });
      const person = req.body.person;
      if (person != null && typeof person !== "string") return res.status(400).json({ error: "Choose a valid person" });
      const draft = smsTransactionDraft(event, person);
      if (!draft.date || Number(draft.amount) <= 0) return res.status(422).json({ error: "SMS amount or date is missing" });
      const link = receiptLink(event.receipt_url);
      if (link) {
        const token = new URL(link).searchParams.get("trx");
        const receipt = await fetchReceipt(token);
        // Enrich missing fields only after verifying this receipt belongs to the SMS.
        if (receipt.status === 200) {
          const data = receipt.body.data;
          const reference = data["Transaction Reference"];
          if ((!draft.reference || draft.reference === reference) && Number(data["Transferred Amount"]) === Number(draft.amount)) {
            draft.reference = draft.reference || reference;
            draft.narrative = draft.narrative || data.Narrative || data.Description || null;
            draft.date = formatTransactionDate(data["Transaction Date"]) || draft.date;
          }
        }
      }
      const { event: newest, existing: addedMeanwhile, transactions } = await latestSnapshot();
      if (!newest || newest.message_hash !== event.message_hash) {
        return res.status(409).json({ error: "A newer BOA SMS is available. Reopen Apollo to check the latest transaction." });
      }
      if (addedMeanwhile) return res.json({ transaction: addedMeanwhile, already_added: true });
      const matchingReceipt = transactions.find(tx => matchesSmsTransaction({ ...event, raw_reference: draft.reference, transaction_date: draft.date }, tx));
      if (matchingReceipt) return res.json({ transaction: matchingReceipt, already_added: true });
      const { data, error } = await supabase.from("transactions").insert([draft]).select().single();
      if (error?.code === "23505") {
        const { data: saved, error: savedError } = await supabase.from("transactions").select("*")
          .eq("source_sms_hash", event.message_hash).maybeSingle();
        if (!savedError && saved) return res.json({ transaction: saved, already_added: true });
      }
      if (error) throw error;
      res.status(201).json({ transaction: data, already_added: false });
    } catch (error) {
      res.status(503).json({ error: "Could not add the BOA transaction. Please try again.", details: error.message });
    }
  });
}

module.exports = { registerBoaSmsImportRoutes };

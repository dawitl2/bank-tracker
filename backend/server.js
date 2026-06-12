const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");
const supabase = require("./supabaseClient");

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

const PORT = process.env.PORT || 5000;
const BASE_URL = "https://bank-backend-anhp.onrender.com";
const GENERATED_TRANSACTION_FIELDS = ["id", "created_at"];
const BOA_SMS_STATE_ID = 1;
const BOA_SMS_TOKEN = process.env.BOA_SMS_API_TOKEN || "boa123";

const cleanTransactionPayload = (payload) => {
  const transaction = { ...payload };

  GENERATED_TRANSACTION_FIELDS.forEach((field) => {
    delete transaction[field];
  });

  Object.keys(transaction).forEach((key) => {
    if (transaction[key] === "") {
      transaction[key] = null;
    }
  });

  if (transaction.is_withdraw === "true") {
    transaction.is_withdraw = true;
  }

  if (transaction.is_withdraw === "false") {
    transaction.is_withdraw = false;
  }

  if (transaction.person === "") {
    transaction.person = null;
  }

  return transaction;
};

const parseMoneyValue = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeSmsAmount = (value) => {
  const parsed = parseMoneyValue(value);
  return parsed === null ? null : parsed.toFixed(2);
};

const requireBoaSmsToken = (req, res, next) => {
  const authHeader = req.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : req.get("x-boa-sms-token");

  if (token !== BOA_SMS_TOKEN) {
    return res.status(401).json({ error: "Invalid BOA SMS token" });
  }

  next();
};

const formatBoaSmsState = (row) => ({
  current_balance: row?.current_balance ?? null,
  latest_withdrawal_amount: row?.latest_withdrawal_amount ?? null,
  latest_deposit_amount: row?.latest_deposit_amount ?? null,
  balance_updated_at: row?.balance_updated_at ?? null,
  withdrawal_updated_at: row?.withdrawal_updated_at ?? null,
  deposit_updated_at: row?.deposit_updated_at ?? null,
  last_sms_at: row?.last_sms_at ?? null,
  updated_at: row?.updated_at ?? null
});


/*
========================================
KEEP ALIVE SYSTEM (ETHIOPIAN TIME)
========================================
*/

const isActiveTime = () => {
  const now = new Date();

  const ethTime = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Addis_Ababa",
    hour: "numeric",
    hour12: false
  }).format(now);

  const hour = parseInt(ethTime);

  // Active: 6 AM → 11:59 PM
  return hour >= 6 && hour < 24;
};

const pingServer = async () => {
  try {
    await fetch(BASE_URL);
    console.log("🔄 Ping sent to keep server alive");
  } catch (err) {
    console.log("❌ Ping failed:", err.message);
  }
};

// Run every 5 minutes
setInterval(() => {
  if (isActiveTime()) {
    pingServer();
  } else {
    console.log("😴 Sleeping time (no ping)");
  }
}, 5 * 60 * 1000);



/*
========================================
SCRAPE RECEIPT DRAFT
========================================
*/

app.post("/scrape-receipt", async (req, res) => {

  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "No URL provided" });
  }

  let browser;

  try {

    browser = await puppeteer.launch({
      args: [...chromium.args, "--no-sandbox"],
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
    );

    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    await new Promise(r => setTimeout(r, 4000));

    const result = await page.evaluate(() => {

      const findValue = (labels) => {

        const cells = Array.from(document.querySelectorAll("td, th"));

        for (const label of labels) {

          const match = cells.find(el =>
            el.innerText
              .toLowerCase()
              .replace(/\s+/g, " ")
              .includes(label.toLowerCase())
          );

          if (match && match.nextElementSibling) {
            return match.nextElementSibling.innerText.trim();
          }
        }

        return "";
      };

      return {
        amount: findValue([
          "transferred amount",
          "transfer amount",
          "amount transferred",
          "amount"
        ]),
        date: findValue(["transaction date", "date"]),
        reference: findValue([
          "transaction reference",
          "reference",
          "ref"
        ]),
        narrative: findValue([
          "narrative",
          "description",
          "reason",
          "payment reason"
        ])
      };
    });

    if (!result.amount) {
      console.log(await page.content());
      return res.status(500).json({
        error: "Scraping worked but data not found."
      });
    }

    res.json({
      amount: result.amount,
      date: result.date,
      reference: result.reference,
      narrative: result.narrative,
      receipt_url: url,
      is_withdraw: true,
      person: null
    });

  } catch (err) {

    console.error("SCRAPER CRASH:", err);

    res.status(500).json({
      error: "Scraper crashed."
    });

  } finally {

    if (browser) {
      await browser.close();
    }
  }
});



/*
========================================
SAVE APPROVED TRANSACTION
========================================
*/

app.post("/transactions", async (req, res) => {

  const transaction = cleanTransactionPayload(req.body);

  if (!transaction.amount) {
    return res.status(400).json({ error: "Amount is required" });
  }

  const { data, error } = await supabase
    .from("transactions")
    .insert([transaction])
    .select();

  if (error) {
    console.error("SUPABASE ERROR:", error);
    return res.status(500).json({
      error: "Database insert failed",
      details: error.message
    });
  }

  res.status(201).json(data[0]);
});


/*
========================================
UPDATE TRANSACTION
========================================
*/

app.patch("/transactions/:id", async (req, res) => {

  const { id } = req.params;
  const transaction = cleanTransactionPayload(req.body);

  if (!id) {
    return res.status(400).json({ error: "Transaction id is required" });
  }

  const { data, error } = await supabase
    .from("transactions")
    .update(transaction)
    .eq("id", id)
    .select();

  if (error) {
    console.error("SUPABASE UPDATE ERROR:", error);
    return res.status(500).json({
      error: "Database update failed",
      details: error.message
    });
  }

  if (!data.length) {
    return res.status(404).json({
      error: "Transaction not found or update is not allowed"
    });
  }

  res.json(data[0]);
});



/*
========================================
DELETE TRANSACTION
========================================
*/

app.delete("/transactions/:id", async (req, res) => {

  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: "Transaction id is required" });
  }

  const { data, error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    console.error("SUPABASE DELETE ERROR:", error);
    return res.status(500).json({
      error: "Database delete failed",
      details: error.message
    });
  }

  if (!data.length) {
    return res.status(404).json({
      error: "Transaction not found or delete is not allowed"
    });
  }

  res.status(204).send();
});



/*
========================================
GET ALL TRANSACTIONS
========================================
*/

app.get("/transactions", async (req, res) => {

  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .order("id", { ascending: false });

  if (error) {
    console.error(error);
    return res.status(500).json({ error: "Fetch failed" });
  }

  res.json(data);
});



/*
========================================
BOA SMS LATEST ACCOUNT STATE
========================================
*/

app.get("/boa-sms/account-state", async (req, res) => {

  const { data, error } = await supabase
    .from("boa_sms_account_state")
    .select("*")
    .eq("id", BOA_SMS_STATE_ID)
    .maybeSingle();

  if (error) {
    console.error("BOA SMS FETCH ERROR:", error);
    return res.status(500).json({
      error: "BOA SMS state fetch failed",
      details: error.message
    });
  }

  res.json(formatBoaSmsState(data));
});

app.post("/boa-sms/account-state", requireBoaSmsToken, async (req, res) => {

  const payload = req.body || {};
  const now = new Date().toISOString();
  const smsReceivedAt = payload.sms_received_at || now;
  const update = {
    id: BOA_SMS_STATE_ID,
    last_sms_at: smsReceivedAt,
    last_sender: payload.sender || null,
    last_message_hash: payload.message_hash || null,
    updated_at: now
  };

  const currentBalance = normalizeSmsAmount(payload.current_balance);
  const latestWithdrawalAmount = normalizeSmsAmount(payload.latest_withdrawal_amount);
  const latestDepositAmount = normalizeSmsAmount(payload.latest_deposit_amount);

  if (currentBalance !== null) {
    update.current_balance = currentBalance;
    update.balance_updated_at = smsReceivedAt;
  }

  if (latestWithdrawalAmount !== null) {
    update.latest_withdrawal_amount = latestWithdrawalAmount;
    update.withdrawal_updated_at = smsReceivedAt;
  }

  if (latestDepositAmount !== null) {
    update.latest_deposit_amount = latestDepositAmount;
    update.deposit_updated_at = smsReceivedAt;
  }

  if (
    currentBalance === null &&
    latestWithdrawalAmount === null &&
    latestDepositAmount === null
  ) {
    return res.status(400).json({
      error: "No BOA account values were provided"
    });
  }

  const { data, error } = await supabase
    .from("boa_sms_account_state")
    .upsert(update, { onConflict: "id" })
    .select()
    .single();

  if (error) {
    console.error("BOA SMS UPSERT ERROR:", error);
    return res.status(500).json({
      error: "BOA SMS state update failed",
      details: error.message
    });
  }

  res.status(201).json(formatBoaSmsState(data));
});



/*
========================================
HEALTH CHECK
========================================
*/

app.get("/", (req, res) => {
  res.send("Server is running 🚀");
});


app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});

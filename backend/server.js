const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");
const supabase = require("./supabaseClient");
const fetch = require("node-fetch"); // ✅ NEW

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

const PORT = process.env.PORT || 5000;
const BASE_URL = "https://bank-backend-anhp.onrender.com"; // ✅ your backend


/*
========================================
KEEP ALIVE SYSTEM (SMART ETHIOPIAN TIME)
========================================
*/

const isActiveTime = () => {
  const now = new Date();

  // Ethiopia timezone
  const ethTime = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Addis_Ababa",
    hour: "numeric",
    hour12: false
  }).format(now);

  const hour = parseInt(ethTime);

  // Active between 6 AM and 11:59 PM
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

// run every 5 minutes
setInterval(() => {
  if (isActiveTime()) {
    pingServer();
  } else {
    console.log("😴 Sleeping time (no ping)");
  }
}, 5 * 60 * 1000);



/*
========================================
SCRAPE RECEIPT + SAVE TO SUPABASE
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

    const { data, error } = await supabase
      .from("transactions")
      .insert([{
        amount: result.amount,
        date: result.date,
        reference: result.reference,
        narrative: result.narrative,
        receipt_url: url
      }])
      .select();

    if (error) {
      console.error(error);
      return res.status(500).json({ error: "Database insert failed" });
    }

    res.json(data[0]);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "Scraper crashed."
    });

  } finally {
    if (browser) await browser.close();
  }
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
HEALTH CHECK
========================================
*/

app.get("/", (req, res) => {
  res.send("Server is running 🚀");
});


app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
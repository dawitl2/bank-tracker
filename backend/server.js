const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");
const supabase = require("./supabaseClient");

const app = express();

app.use(cors({
  origin: "*"
}));

app.use(express.json());

const PORT = process.env.PORT || 5000;


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
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    const page = await browser.newPage();

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    const result = await page.evaluate(() => {

      const getText = (label) => {
        const el = Array.from(document.querySelectorAll("td, th"))
          .find(e => e.innerText.includes(label));

        return el?.nextElementSibling?.innerText.trim() || "";
      };

      return {
        amount: getText("Transferred amount"),
        date: getText("Transaction Date"),
        reference: getText("Transaction Reference"),
        narrative: getText("Narrative")
      };
    });

    // 🔥 VERY IMPORTANT SAFETY CHECK
    if (!result.amount) {
      return res.status(500).json({
        error: "Scraping worked but data not found. Bank layout may have changed."
      });
    }

    /*
    ========================================
    SAVE TO DATABASE
    ========================================
    */

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
      console.error("SUPABASE ERROR:", error);
      return res.status(500).json({ error: "Database insert failed" });
    }

    res.json(data[0]);

  } catch (err) {

    console.error("SCRAPER CRASH:", err);

    res.status(500).json({
      error: "Scraping failed — server crashed running browser."
    });

  } finally {

    if (browser) {
      await browser.close();
    }
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


app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});

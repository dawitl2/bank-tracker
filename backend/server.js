const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");
const supabase = require("./supabaseClient");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 5000;


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

  try {
    const browser = await puppeteer.launch({
      headless: "new"
    });

    const page = await browser.newPage();

    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 0
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

    await browser.close();


    /*
    ========================================
    SAVE TO DATABASE (NOW WITH URL)
    ========================================
    */

    const { data, error } = await supabase
      .from("transactions")
      .insert([
        {
          amount: result.amount,
          date: result.date,
          reference: result.reference,
          narrative: result.narrative,
          receipt_url: url // ⭐⭐⭐ THIS IS THE FIX
        }
      ])
      .select(); // returns inserted row


    if (error) {
      console.error(error);
      return res.status(500).json({ error: "Database insert failed" });
    }

    // send the CREATED row back
    res.json(data[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Scraping failed" });
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
  console.log(`Backend running on http://localhost:${PORT}`);
});

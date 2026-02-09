const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");
const supabase = require("./supabaseClient");

const app = express();

app.use(cors({ origin: "*" }));
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
      args: [...chromium.args, "--no-sandbox"],
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    // pretend to be a real browser (banks hate bots)
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
    );

    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    // 🔥 banks sometimes render slowly
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

        date: findValue([
          "transaction date",
          "date"
        ]),

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


    /*
    ========================================
    SAFETY CHECK
    ========================================
    */

    if (!result.amount) {

      console.log("PAGE HTML SAMPLE:");
      console.log(await page.content()); // MASSIVE debugging weapon

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
      return res.status(500).json({
        error: "Database insert failed"
      });
    }

    res.json(data[0]);

  } catch (err) {

    console.error("SCRAPER CRASH:", err);

    res.status(500).json({
      error: "Scraper crashed — bank may be blocking bots."
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



/*
========================================
HEALTH CHECK (VERY USEFUL FOR RENDER)
========================================
*/

app.get("/", (req, res) => {
  res.send("Server is running 🚀");
});


app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});

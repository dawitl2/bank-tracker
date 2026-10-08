const { getBankReceipt } = require("./boaReceipt");
const { getReceiptPage, getReceiptAsset } = require("./receiptPage");

function registerReceiptRoutes(app) {
  // Only bank receipt requests are relayed. No database writes.
  app.get("/receipt-page", async (req, res) => {
    const result = await getReceiptPage(req.query.trx);
    res.set("Cache-Control", "no-store");
    res.status(result.status).type("html").send(result.body);
  });

  app.get("/slip/assets/:name", async (req, res) => {
    const result = await getReceiptAsset(req.params.name);
    if (result.status !== 200) return res.sendStatus(result.status);
    res.set("Cache-Control", "public, max-age=31536000, immutable");
    res.set("Content-Type", result.contentType);
    res.send(result.body);
  });

  app.get("/receipt-details", async (req, res) => {
    const result = await getBankReceipt(req.query.trx);
    res.set("Cache-Control", "no-store");
    res.status(result.status).json(result.body);
  });
}

module.exports = { registerReceiptRoutes };

const { getBankReceipt } = require("../backend/boaReceipt");
const { getReceiptPage, getReceiptAsset } = require("../backend/receiptPage");

const ASSET_PREFIX = "/api/boa-receipt/assets/";

// Ships with the frontend. No dependency on the separately hosted backend,
// database credentials, or REACT_APP_API_URL.
module.exports = async function receipt(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }
  const { kind = "page", trx, name } = req.query;
  if (kind === "page") {
    const result = await getReceiptPage(trx, undefined, {
      detailsEndpoint: "/api/boa-receipt?kind=details", assetPrefix: ASSET_PREFIX
    });
    return res.status(result.status).setHeader("Content-Type", "text/html; charset=utf-8").end(result.body);
  }
  if (kind === "details") {
    const result = await getBankReceipt(trx);
    return res.status(result.status).json(result.body);
  }
  if (kind === "asset") {
    const result = await getReceiptAsset(name);
    if (result.status !== 200) return res.status(result.status).end();
    // Only asset addresses change; the bank's rendering and QR code stay intact.
    const body = /\.(js|css)$/.test(name) ? result.body.toString("utf8").replaceAll("/slip/assets/", ASSET_PREFIX) : result.body;
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("Content-Type", result.contentType);
    return res.status(200).end(body);
  }
  return res.status(400).end();
};

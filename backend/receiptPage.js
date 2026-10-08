const BANK_ORIGIN = "https://cs.bankofabyssinia.com";
const TOKEN_PATTERN = /^[a-zA-Z0-9]{10,60}$/;
const ASSET_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*\.(?:js|css|png|jpg|webp|svg|ico|woff2?)$/;

// Runs before the bank's unchanged bundle. The bank blocks embedding and its
// API does not allow app-origin requests, so relay only its receipt API here.
function receiptBridge() {
  const token = new URLSearchParams(window.location.search).get("trx");
  const detailsEndpoint = document.currentScript?.dataset.receiptDetails || "/receipt-details";
  const originalFetch = window.fetch.bind(window);
  let ready = false;
  const notify = (type, retryable = false) => window.parent.postMessage({ type, token, retryable }, "*");
  window.fetch = async (input, options) => {
    const url = new URL(typeof input === "string" ? input : input.url, window.location.href);
    if (url.origin !== "https://cs.bankofabyssinia.com" || url.pathname !== "/api/onlineSlip/getDetails/") return originalFetch(input, options);
    try {
      const separator = detailsEndpoint.includes("?") ? "&" : "?";
      const response = await originalFetch(`${detailsEndpoint}${separator}trx=${encodeURIComponent(token)}`, { cache: "no-store" });
      if (!response.ok) {
        const error = new Error("Receipt unavailable");
        error.retryable = response.status >= 500;
        throw error;
      }
      const payload = await response.json();
      if (payload.token !== token || !payload.data) throw new Error("Receipt mismatch");
      const observer = new MutationObserver(() => {
        const rows = Array.from(document.querySelectorAll("#invoice tr"));
        if (rows.some(row => row.cells[0]?.textContent === "Transaction Reference" && row.cells[1]?.textContent.trim() === payload.data["Transaction Reference"])) {
          ready = true;
          observer.disconnect();
          notify("boa-receipt-ready");
        }
      });
      observer.observe(document.getElementById("root"), { childList: true, subtree: true });
      // Let the original bank code construct its own receipt and verification QR.
      return new Response(JSON.stringify({ body: [payload.data] }), { status: 200, headers: { "Content-Type": "application/json" } });
    } catch (error) {
      notify("boa-receipt-failed", error.retryable !== false);
      throw error;
    }
  };
  window.addEventListener("error", event => {
    // A missing stamp, logo, or footer image must not discard real bank data.
    const resource = event.target?.tagName;
    if (!ready && (!resource || resource === "SCRIPT" || resource === "LINK")) notify("boa-receipt-failed", true);
  }, true);
  window.addEventListener("unhandledrejection", () => { if (!ready) notify("boa-receipt-failed", true); });
}

let cachedShell;
let shellPending;
async function getReceiptPage(token, fetchPage = fetch, { detailsEndpoint = "/receipt-details", assetPrefix = "/slip/assets/" } = {}) {
  if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) return { status: 400, body: "Invalid receipt token" };
  try {
    // Cache only the public shell, never receipt data or rendered receipts.
    const readShell = async () => {
      const response = await fetchPage(`${BANK_ORIGIN}/slip/`, { signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error("Bank page unavailable");
      const html = await response.text();
      if (!html.includes('id="root"') || !/<script\b[^>]*src="\/slip\/assets\/[^"<>]+\.js"/.test(html)) throw new Error("Unexpected bank page");
      return html;
    };
    let html;
    if (fetchPage !== fetch) html = await readShell(); // Isolated test fetches.
    else {
      if (!cachedShell || cachedShell.expires <= Date.now()) {
        if (!shellPending) shellPending = readShell().then(body => { cachedShell = { body, expires: Date.now() + 300000 }; }).finally(() => { shellPending = null; });
        await shellPending;
      }
      html = cachedShell.body;
    }
    const bridge = `<script data-receipt-details="${detailsEndpoint}">(${receiptBridge.toString()})()</script>`;
    return { status: 200, body: html.replaceAll("/slip/assets/", assetPrefix).replace(/<head>/i, `<head>${bridge}`) };
  } catch {
    // The parent switches to its saved receipt without showing an error page.
    return { status: 502, body: '<!doctype html><script>parent.postMessage({type:"boa-receipt-failed",retryable:true,token:new URLSearchParams(location.search).get("trx")},"*")</script>' };
  }
}

async function getReceiptAsset(name, fetchAsset = fetch) {
  if (typeof name !== "string" || !ASSET_PATTERN.test(name)) return { status: 400 };
  try {
    const response = await fetchAsset(`${BANK_ORIGIN}/slip/assets/${name}`, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) return { status: 502 };
    const body = Buffer.from(await response.arrayBuffer());
    if (body.length > 8 * 1024 * 1024) return { status: 502 };
    return { status: 200, body, contentType: response.headers.get("content-type") || "application/octet-stream" };
  } catch { return { status: 502 }; }
}

module.exports = { getReceiptPage, getReceiptAsset };

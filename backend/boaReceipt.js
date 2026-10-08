const INVALID_RECEIPT = /invalid reference|incorrect parameter|invalid account/i;

function isBankReceipt(data) {
  return data && typeof data === "object" && !Object.values(data).some(value => typeof value === "string" && INVALID_RECEIPT.test(value)) &&
    typeof data["Transaction Reference"] === "string" && data["Transferred Amount"] !== undefined && data["Transferred Amount"] !== null && data["Transferred Amount"] !== "" &&
    Number.isFinite(Number(data["Transferred Amount"])) && typeof data["Transaction Date"] === "string" && data["Transaction Date"];
}

async function getBankReceipt(token, fetchReceipt = fetch) {
  if (typeof token !== "string" || !/^[a-zA-Z0-9]{10,60}$/.test(token)) {
    return { status: 400, body: { error: "Invalid receipt token" } };
  }
  try {
    // Only this bank endpoint is allowed. User input cannot change the host.
    const response = await fetchReceipt(`https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id=${encodeURIComponent(token)}`, {
      signal: AbortSignal.timeout(4000), headers: { Accept: "application/json" }
    });
    if (!response.ok) return { status: 502, body: { error: "Bank receipt service unavailable" } };
    const payload = await response.json();
    const data = payload?.body?.[0];
    if (!isBankReceipt(data)) return { status: 404, body: { error: "Bank receipt unavailable" } };
    if (!token.startsWith(data["Transaction Reference"])) return { status: 502, body: { error: "Bank receipt reference mismatch" } };
    return { status: 200, body: { token, data } };
  } catch {
    return { status: 502, body: { error: "Bank receipt service unavailable" } };
  }
}

module.exports = { getBankReceipt };

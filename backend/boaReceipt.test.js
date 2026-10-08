const { test } = require("node:test");
const assert = require("node:assert/strict");
const { getBankReceipt } = require("./boaReceipt");

const data = { "Transaction Reference": "FT262485K1B8", "Transferred Amount": "25000.00", "Transaction Date": "05/09/26 15:52" };

test("fetches only the requested receipt from the fixed bank endpoint", async () => {
  const result = await getBankReceipt("FT262485K1B810104", async (url, options) => {
    assert.equal(url, "https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id=FT262485K1B810104");
    assert.ok(options.signal);
    return { ok: true, json: async () => ({ body: [data] }) };
  });
  assert.deepEqual(result, { status: 200, body: { token: "FT262485K1B810104", data } });
});

test("rejects invalid token input without fetching", async () => {
  for (const token of [undefined, "../secret", "https://example.com", ["FT262485K1B810104"]]) {
    const result = await getBankReceipt(token, () => assert.fail("must not fetch"));
    assert.equal(result.status, 400);
  }
});

test("the bank's HTTP 200 invalid-reference response is an unavailable receipt", async () => {
  const result = await getBankReceipt("FT26082QM3HF413499", async () => ({ ok: true, json: async () => ({ body: [{ "Payer's Name": "Invalid reference number" }] }) }));
  assert.equal(result.status, 404);
});

test("does not return a different transaction", async () => {
  const result = await getBankReceipt("FT26082QM3HF41349", async () => ({ ok: true, json: async () => ({ body: [data] }) }));
  assert.equal(result.status, 502);
});

test("incomplete bank data does not count as a usable actual receipt", async () => {
  for (const missing of ["Transaction Reference", "Transferred Amount", "Transaction Date"]) {
    const incomplete = { ...data, [missing]: "" };
    const result = await getBankReceipt("FT262485K1B810104", async () => ({ ok: true, json: async () => ({ body: [incomplete] }) }));
    assert.equal(result.status, 404);
  }
});

test("timeouts, invalid JSON, and HTTP errors leave the viewer on its saved copy", async () => {
  const failingFetches = [
    async () => { throw new Error("timeout"); },
    async () => ({ ok: true, json: async () => { throw new Error("bad JSON"); } }),
    async () => ({ ok: false })
  ];
  for (const fetchReceipt of failingFetches) assert.equal((await getBankReceipt("FT262485K1B810104", fetchReceipt)).status, 502);
});

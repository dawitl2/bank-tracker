const { test, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const receipt = require("../api/boa-receipt");
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });
const token = "FT262485K1B810104";
const shell = '<html><head><script type="module" src="/slip/assets/index-original.js"></script><link rel="stylesheet" href="/slip/assets/index-original.css"></head><body><div id="root"></div></body></html>';
function response() {
  return {
    statusCode: 200, headers: {},
    setHeader(key, value) { this.headers[key.toLowerCase()] = value; return this; },
    status(value) { this.statusCode = value; return this; },
    end(body) { this.body = body; return this; },
    json(body) { this.body = body; return this; }
  };
}

test("frontend API serves the actual shell with same-origin assets and receipt data", async () => {
  global.fetch = async url => {
    assert.equal(url, "https://cs.bankofabyssinia.com/slip/");
    return { ok: true, text: async () => shell };
  };
  const res = response();
  await receipt({ method: "GET", query: { kind: "page", trx: token } }, res);
  assert.equal(res.statusCode, 200);
  assert.match(res.body, /src="\/api\/boa-receipt\/assets\/index-original.js"/);
  assert.match(res.body, /data-receipt-details="\/api\/boa-receipt\?kind=details"/);
  assert.ok(!res.body.includes("onrender.com"));
  assert.equal(res.headers["cache-control"], "no-store");
});

test("frontend API preserves bank code and relative PDF imports while relaying image addresses", async () => {
  global.fetch = async url => {
    assert.equal(url, "https://cs.bankofabyssinia.com/slip/assets/index-original.js");
    return { ok: true, headers: new Headers({ "content-type": "text/javascript" }),
      arrayBuffer: async () => Buffer.from('const image="/slip/assets/logo.png";import("./purify.es-original.js")') };
  };
  const res = response();
  await receipt({ method: "GET", query: { kind: "asset", name: "index-original.js" } }, res);
  assert.equal(res.body, 'const image="/api/boa-receipt/assets/logo.png";import("./purify.es-original.js")');
  assert.equal(res.headers["content-type"], "text/javascript");
  assert.equal(res.headers["cache-control"], "public, max-age=31536000, immutable");
});

test("frontend API retrieves validated bank data directly without the old backend", async () => {
  const data = { "Transaction Reference": "FT262485K1B8", "Transferred Amount": "25000.00", "Transaction Date": "05/09/26 15:52" };
  global.fetch = async url => {
    assert.equal(url, `https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id=${token}`);
    return { ok: true, json: async () => ({ body: [data] }) };
  };
  const res = response();
  await receipt({ method: "GET", query: { kind: "details", trx: token } }, res);
  assert.deepEqual(res.body, { token, data });
  assert.equal(res.headers["cache-control"], "no-store");
});

test("frontend API rejects writes, arbitrary paths, and invalid receipt tokens without upstream requests", async () => {
  global.fetch = () => assert.fail("must not fetch");
  for (const [method, query, expected] of [
    ["POST", {}, 405], ["GET", { kind: "other" }, 400],
    ["GET", { kind: "asset", name: "../server.js" }, 400],
    ["GET", { kind: "page", trx: "../secret" }, 400],
    ["GET", { kind: "details", trx: [token] }, 400]
  ]) {
    const res = response();
    await receipt({ method, query }, res);
    assert.equal(res.statusCode, expected);
  }
});

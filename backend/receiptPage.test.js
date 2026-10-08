const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { getReceiptPage, getReceiptAsset } = require("./receiptPage");
const token = "FT262485K1B810104";
const shell = '<!doctype html><html><head><script type="module" src="/slip/assets/original.js"></script><link rel="stylesheet" href="/slip/assets/original.css"></head><body><div id="root"></div></body></html>';

test("relays the bank's original shell and injects the bridge before its module", async () => {
  const result = await getReceiptPage(token, async url => {
    assert.equal(url, "https://cs.bankofabyssinia.com/slip/");
    return { ok: true, text: async () => shell };
  });
  assert.equal(result.status, 200);
  assert.ok(result.body.includes('src="/slip/assets/original.js"'));
  assert.ok(result.body.indexOf("function receiptBridge") < result.body.indexOf('type="module"'));
  assert.ok(!result.body.includes("Transferred Amount"));
});

test("invalid tokens and asset paths cannot select a different host or file", async () => {
  const neverFetch = () => assert.fail("must not fetch");
  for (const value of [undefined, "../secret", [token]]) assert.equal((await getReceiptPage(value, neverFetch)).status, 400);
  for (const name of ["../server.js", "https://example.com/a.js", "a.js?secret", "a.html", ["a.js"]]) assert.equal((await getReceiptAsset(name, neverFetch)).status, 400);
});

test("unavailable or changed bank pages tell the parent to use its saved receipt", async () => {
  for (const fetchPage of [async () => { throw Error("offline"); }, async () => ({ ok: false }), async () => ({ ok: true, text: async () => "<html>error</html>" })]) {
    const result = await getReceiptPage(token, fetchPage);
    assert.equal(result.status, 502);
    assert.match(result.body, /boa-receipt-failed/);
  }
});

test("relays exact asset bytes, including dotted PDF modules, from only the bank asset directory", async () => {
  const result = await getReceiptAsset("purify.es-a-CayzAK.js", async url => {
    assert.equal(url, "https://cs.bankofabyssinia.com/slip/assets/purify.es-a-CayzAK.js");
    return { ok: true, arrayBuffer: async () => Buffer.from("original module"), headers: new Headers({ "content-type": "text/javascript" }) };
  });
  assert.equal(result.body.toString(), "original module");
  assert.equal(result.contentType, "text/javascript");
});

test("the bridge waits for the original bank to render real rows before declaring success", async () => {
  const { body } = await getReceiptPage(token, async () => ({ ok: true, text: async () => shell }));
  const script = body.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];
  const messages = [];
  const listeners = {};
  let mutation;
  let rows = [];
  const data = { "Transaction Reference": "FT262485K1B8" };
  const window = {
    location: { search: `?trx=${token}`, href: `https://backend.example/receipt-page?trx=${token}` },
    fetch: async (url, options) => {
      assert.equal(url, `/receipt-details?trx=${token}`);
      assert.equal(options.cache, "no-store");
      return { ok: true, json: async () => ({ token, data }) };
    },
    parent: { postMessage: message => messages.push(message) }, addEventListener(type, callback) { listeners[type] = callback; }
  };
  vm.runInNewContext(script, { window, URL, URLSearchParams, Response,
    MutationObserver: class { constructor(callback) { mutation = callback; } observe() {} disconnect() {} },
    document: { getElementById: () => ({}), querySelectorAll: () => rows }
  });
  const response = await window.fetch(`https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id=${token}`);
  assert.deepEqual(await response.json(), { body: [data] });
  listeners.error({ target: { tagName: "IMG" } });
  assert.equal(messages.length, 0, "optional images must not trigger a fallback");
  mutation();
  assert.equal(messages.length, 0);
  rows = [{ cells: [{ textContent: "Transaction Reference" }, { textContent: "FT262485K1B8 " }] }];
  mutation();
  assert.equal(messages[0].type, "boa-receipt-ready");
  assert.equal(messages[0].token, token);
});

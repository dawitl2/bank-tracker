// Run: node backend/sql/verify-profile-devices.cjs <path-to-pglite-package>
// Tested with @electric-sql/pglite 0.5.10. Only an isolated in-memory DB is used.
const path = require("node:path");
const fs = require("node:fs");
const assert = require("node:assert/strict");
const packagePath = process.argv[2] || "@electric-sql/pglite";
const { PGlite } = require(packagePath);
const { pgcrypto } = require(path.join(path.dirname(require.resolve(packagePath)), "contrib/pgcrypto.cjs"));

(async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  const sql = name => fs.readFileSync(path.join(__dirname, name), "utf8");
  const call = async (name, args = []) => (await db.query(
    `select public.${name}(${args.map((_, index) => `$${index + 1}`).join(",")}) as result`, args
  )).rows[0].result;
  const login = () => call("app_profile_sign_in", ["Dawit", "pass"]);
  const restore = token => call("app_profile_session", [token]);
  try {
    await db.exec("create role anon; create role authenticated;");
    await db.exec(sql("app_profiles.sql"));
    const fresh = await login();
    assert.equal(fresh.persistent, true, "Base setup must not issue eight-hour sessions");
    assert.equal((await restore(fresh.token)).persistent, true);
    // Simulate already-issued legacy tokens before upgrading an existing DB.
    const legacy = await login();
    const expired = await login();
    const revoked = await login();
    await call("app_profile_sign_out", [revoked.token]);
    await db.query("update bank_profiles.sessions set expires_at = now() + interval '1 hour' where token_hash = encode(extensions.digest($1,'sha256'),'hex')", [legacy.token]);
    await db.query("update bank_profiles.sessions set expires_at = now() - interval '1 hour' where token_hash = encode(extensions.digest($1,'sha256'),'hex')", [expired.token]);
    await db.exec(sql("profile_devices.sql"));
    await db.exec(sql("profile_devices.sql"));
    assert.equal((await restore(legacy.token)).persistent, true, "Valid legacy devices must become persistent");
    assert.equal(await restore(expired.token), null, "Do not revive expired tokens");
    assert.equal(await restore(revoked.token), null, "Do not revive revoked tokens");
    const device = await login();
    assert.equal(device.persistent, true);
    assert.equal(device.expires_at, null);
    const horizon = await db.query("select bool_and(expires_at > now() + interval '100 years') as persistent from bank_profiles.sessions where expires_at > now()");
    assert.equal(horizon.rows[0].persistent, true, "No session or day limit");
    await call("app_profile_sign_out", [device.token]);
    assert.equal(await restore(device.token), null);
    assert.equal((await restore(legacy.token)).persistent, true, "Logout is per device");
    await db.exec("update bank_profiles.accounts set enabled = false where username = 'dawit'");
    assert.equal(await restore(legacy.token), null, "Disabled accounts cannot restore access");
    await db.exec("update bank_profiles.accounts set enabled = true where username = 'dawit'");
    await db.exec(sql("verify_app_profiles.sql"));
    // Reapplying base setup must not reintroduce a time limit.
    await db.exec(sql("app_profiles.sql"));
    assert.equal((await login()).persistent, true);
    await db.exec(sql("profile_devices.sql"));
    await db.exec(sql("verify_app_profiles.sql"));
    console.log("PASS: persistent base/device sessions, legacy upgrade, expiry rejection, per-device logout, disabled accounts, repeat setup, credentials, lockout and API privacy.");
  } finally { await db.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });

import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { verify } from "../src/verifiers/turnstile.js";

const realFetch = globalThis.fetch;
let calls;

function mockFetch(impl) {
  calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return impl(url, init);
  };
}
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });

const req = (headers = {}) => new Request("https://example.com/api/contact", { method: "POST", headers });
function fd(fields) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

describe("turnstile verify", () => {
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test("500 when the secret is not configured", async () => {
    mockFetch(() => json({ success: true }));
    const r = await verify(fd({ "cf-turnstile-response": "t" }), { request: req(), env: {} });
    assert.equal(r.ok, false);
    assert.equal(r.status, 500);
    assert.equal(calls.length, 0);
  });

  test("400 when the token is missing, without calling Cloudflare", async () => {
    mockFetch(() => json({ success: true }));
    const r = await verify(fd({}), { request: req(), env: { TURNSTILE_SECRET_KEY: "s" } });
    assert.deepEqual([r.ok, r.status], [false, 400]);
    assert.equal(calls.length, 0);
  });

  test("ok when Cloudflare reports success", async () => {
    mockFetch(() => json({ success: true }));
    const r = await verify(fd({ "cf-turnstile-response": "tok" }), { request: req(), env: { TURNSTILE_SECRET_KEY: "s" } });
    assert.deepEqual(r, { ok: true });
  });

  test("400 when Cloudflare reports failure", async () => {
    mockFetch(() => json({ success: false, "error-codes": ["invalid-input-response"] }));
    const r = await verify(fd({ "cf-turnstile-response": "tok" }), { request: req(), env: { TURNSTILE_SECRET_KEY: "s" } });
    assert.deepEqual([r.ok, r.status], [false, 400]);
  });

  test("posts secret, token and client IP to siteverify", async () => {
    mockFetch(() => json({ success: true }));
    await verify(fd({ "cf-turnstile-response": "tok" }), {
      request: req({ "CF-Connecting-IP": "203.0.113.9" }),
      env: { TURNSTILE_SECRET_KEY: "sekret" },
    });
    const { url, init } = calls[0];
    assert.equal(url, "https://challenges.cloudflare.com/turnstile/v0/siteverify");
    assert.equal(init.method, "POST");
    assert.equal(init.body.get("secret"), "sekret");
    assert.equal(init.body.get("response"), "tok");
    assert.equal(init.body.get("remoteip"), "203.0.113.9");
  });

  test("omits remoteip when no client IP header is present", async () => {
    mockFetch(() => json({ success: true }));
    await verify(fd({ "cf-turnstile-response": "tok" }), { request: req(), env: { TURNSTILE_SECRET_KEY: "s" } });
    assert.equal(calls[0].init.body.has("remoteip"), false);
  });

  test("rejects (throws) on network failure; the handler is what catches it", async () => {
    mockFetch(() => {
      throw new TypeError("network down");
    });
    await assert.rejects(
      verify(fd({ "cf-turnstile-response": "tok" }), { request: req(), env: { TURNSTILE_SECRET_KEY: "s" } }),
    );
  });
});

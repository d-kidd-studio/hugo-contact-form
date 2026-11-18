import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createFormHandler } from "../src/handler.js";

const ORIGIN = "https://example.com";
const env = { CONTACT_FROM_EMAIL: "from@example.com", CONTACT_TO_EMAIL: "to@example.com" };

function post(fields = { name: "Ann" }) {
  return new Request(`${ORIGIN}/api/contact`, {
    method: "POST",
    body: new URLSearchParams(fields),
  });
}

const okVerify = async () => ({ ok: true });
const okBuild = async () => ({ subject: "Hi", text: "Body" });
const okSend = async () => ({ ok: true });

function make(overrides = {}) {
  return createFormHandler({
    verify: okVerify,
    buildMessage: okBuild,
    sendMail: okSend,
    successPath: "/thanks",
    errorPath: "/contact?error=1",
    ...overrides,
  });
}

const run = (handler, request = post()) => handler({ request, env });

function assertRedirect(res, path) {
  assert.equal(res.status, 303);
  assert.equal(res.headers.get("location"), `${ORIGIN}${path}`);
}

describe("createFormHandler", () => {
  let realError;
  beforeEach(() => {
    realError = console.error;
    console.error = () => {}; // keep test output quiet
  });
  afterEach(() => {
    console.error = realError;
  });

  describe("configuration", () => {
    for (const missing of ["verify", "buildMessage", "sendMail"]) {
      test(`throws when ${missing} is not a function`, () => {
        const opts = { verify: okVerify, buildMessage: okBuild, sendMail: okSend };
        delete opts[missing];
        assert.throws(() => createFormHandler(opts), new RegExp(`createFormHandler requires a ${missing}`));
      });
    }

    test("throws when called with no options", () => {
      assert.throws(() => createFormHandler());
    });
  });

  describe("success", () => {
    test("redirects 303 to successPath", async () => {
      assertRedirect(await run(make()), "/thanks");
    });

    test("uses default paths when none are given", async () => {
      const h = createFormHandler({ verify: okVerify, buildMessage: okBuild, sendMail: okSend });
      assertRedirect(await run(h), "/thank-you");
    });

    test("passes the normalized message and env to the provider", async () => {
      let seen;
      const h = make({
        buildMessage: async () => ({
          subject: "S",
          text: "T",
          html: "<p>T</p>",
          replyTo: { email: "v@x.com", name: "V" },
          fromName: "Site",
          toName: "Owner",
        }),
        sendMail: async (msg, e) => {
          seen = { msg, e };
          return { ok: true };
        },
      });
      await run(h);
      assert.deepEqual(seen.msg, {
        from: { email: "from@example.com", name: "Site" },
        to: { email: "to@example.com", name: "Owner" },
        subject: "S",
        text: "T",
        html: "<p>T</p>",
        replyTo: { email: "v@x.com", name: "V" },
      });
      assert.equal(seen.e, env);
    });

    test("falls back to default sender/recipient names", async () => {
      let seen;
      const h = make({ sendMail: async (m) => ((seen = m), { ok: true }) });
      await run(h);
      assert.equal(seen.from.name, "Website");
      assert.equal(seen.to.name, "Website Contact");
    });

    test("passes formData and { request, env } to verify and buildMessage", async () => {
      let v, b;
      const h = make({
        verify: async (fd, ctx) => ((v = { fd, ctx }), { ok: true }),
        buildMessage: async (fd, ctx) => ((b = { fd, ctx }), { subject: "s", text: "t" }),
      });
      const request = post({ name: "Ann" });
      await h({ request, env });
      assert.equal(v.fd.get("name"), "Ann");
      assert.equal(v.ctx.request, request);
      assert.equal(v.ctx.env, env);
      assert.equal(b.fd.get("name"), "Ann");
      assert.equal(b.ctx.env, env);
    });

    test("supports a synchronous buildMessage", async () => {
      assertRedirect(await run(make({ buildMessage: () => ({ subject: "s", text: "t" }) })), "/thanks");
    });
  });

  describe("verifier failure", () => {
    test("returns the verifier's status and message, no redirect, no email", async () => {
      let sent = false;
      const h = make({
        verify: async () => ({ ok: false, status: 403, message: "nope" }),
        sendMail: async () => ((sent = true), { ok: true }),
      });
      const res = await run(h);
      assert.equal(res.status, 403);
      assert.equal(await res.text(), "nope");
      assert.equal(sent, false);
    });

    test("defaults to 400 when the verifier gives no status", async () => {
      const res = await run(make({ verify: async () => ({ ok: false, message: "bad" }) }));
      assert.equal(res.status, 400);
    });

    test("does not build or send when verification fails", async () => {
      let built = false;
      const h = make({
        verify: async () => ({ ok: false }),
        buildMessage: async () => ((built = true), { subject: "s", text: "t" }),
      });
      await run(h);
      assert.equal(built, false);
    });

    test("a verifier that throws redirects to errorPath and sends nothing", async () => {
      let sent = false;
      const h = make({
        verify: async () => {
          throw new Error("siteverify unreachable");
        },
        sendMail: async () => ((sent = true), { ok: true }),
      });
      assertRedirect(await run(h), "/contact?error=1");
      assert.equal(sent, false);
    });

    test("a verifier returning nothing is treated as a failure", async () => {
      let sent = false;
      const h = make({
        verify: async () => undefined,
        sendMail: async () => ((sent = true), { ok: true }),
      });
      const res = await run(h);
      assert.equal(res.status, 400);
      assert.equal(sent, false);
    });
  });

  describe("message builder failure", () => {
    test("async throw redirects to errorPath and sends nothing", async () => {
      let sent = false;
      const h = make({
        buildMessage: async () => {
          throw new Error("name required");
        },
        sendMail: async () => ((sent = true), { ok: true }),
      });
      assertRedirect(await run(h), "/contact?error=1");
      assert.equal(sent, false);
    });

    test("sync throw redirects to errorPath", async () => {
      const h = make({
        buildMessage: () => {
          throw new Error("bad");
        },
      });
      assertRedirect(await run(h), "/contact?error=1");
    });

    test("builder returning nothing redirects to errorPath and sends nothing", async () => {
      let sent = false;
      const h = make({
        buildMessage: async () => undefined,
        sendMail: async () => ((sent = true), { ok: true }),
      });
      assertRedirect(await run(h), "/contact?error=1");
      assert.equal(sent, false);
    });
  });

  describe("provider failure", () => {
    test("{ ok: false } redirects to errorPath", async () => {
      const h = make({ sendMail: async () => ({ ok: false, status: 401, error: "bad key" }) });
      assertRedirect(await run(h), "/contact?error=1");
    });

    test("a rejected promise redirects to errorPath", async () => {
      const h = make({
        sendMail: async () => {
          throw new TypeError("fetch failed");
        },
      });
      assertRedirect(await run(h), "/contact?error=1");
    });

    test("a synchronous throw redirects to errorPath", async () => {
      const h = make({
        sendMail: () => {
          throw new Error("boom");
        },
      });
      assertRedirect(await run(h), "/contact?error=1");
    });

    test("a provider returning nothing redirects to errorPath", async () => {
      assertRedirect(await run(make({ sendMail: async () => undefined })), "/contact?error=1");
    });

    test("logs the provider error", async () => {
      const logged = [];
      console.error = (...a) => logged.push(a);
      const h = make({
        sendMail: async () => {
          throw new Error("boom");
        },
      });
      await run(h);
      assert.ok(logged.some((a) => String(a[0]).includes("sendMail threw")));
    });
  });

  describe("request parsing", () => {
    test("a body that is not valid form data redirects to errorPath", async () => {
      const request = new Request(`${ORIGIN}/api/contact`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      let verified = false;
      const h = make({ verify: async () => ((verified = true), { ok: true }) });
      assertRedirect(await run(h, request), "/contact?error=1");
      assert.equal(verified, false);
    });
  });

  describe("redirect target", () => {
    test("is built from the request origin", async () => {
      const request = new Request("https://other.example.org:8788/api/contact", {
        method: "POST",
        body: new URLSearchParams({ a: "1" }),
      });
      const res = await run(make(), request);
      assert.equal(res.headers.get("location"), "https://other.example.org:8788/thanks");
    });
  });
});

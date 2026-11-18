import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { sendMail } from "../src/providers/mailjet.js";

const realFetch = globalThis.fetch;
let call;
function mockFetch(resp) {
  globalThis.fetch = async (url, init) => {
    call = { url, init };
    if (resp instanceof Error) throw resp;
    return resp;
  };
}

const env = { MAILJET_API_KEY: "key", MAILJET_API_SECRET: "secret" };
const base = {
  from: { email: "from@example.com", name: "Site" },
  to: { email: "to@example.com", name: "Owner" },
  subject: "Hello",
  text: "Body",
};

describe("mailjet sendMail", () => {
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test("POSTs to the v3.1 send endpoint with Basic auth", async () => {
    mockFetch(new Response("{}", { status: 200 }));
    await sendMail(base, env);
    assert.equal(call.url, "https://api.mailjet.com/v3.1/send");
    assert.equal(call.init.method, "POST");
    assert.equal(call.init.headers.Authorization, "Basic " + btoa("key:secret"));
    assert.equal(call.init.headers["Content-Type"], "application/json");
  });

  test("maps the normalized message to the Mailjet payload", async () => {
    mockFetch(new Response("{}", { status: 200 }));
    await sendMail(base, env);
    const [m] = JSON.parse(call.init.body).Messages;
    assert.deepEqual(m.From, { Email: "from@example.com", Name: "Site" });
    assert.deepEqual(m.To, [{ Email: "to@example.com", Name: "Owner" }]);
    assert.equal(m.Subject, "Hello");
    assert.equal(m.TextPart, "Body");
    assert.equal("HTMLPart" in m, false);
    assert.equal("ReplyTo" in m, false);
  });

  test("includes HTMLPart and ReplyTo when provided", async () => {
    mockFetch(new Response("{}", { status: 200 }));
    await sendMail({ ...base, html: "<p>Body</p>", replyTo: { email: "v@x.com", name: "V" } }, env);
    const [m] = JSON.parse(call.init.body).Messages;
    assert.equal(m.HTMLPart, "<p>Body</p>");
    assert.deepEqual(m.ReplyTo, { Email: "v@x.com", Name: "V" });
  });

  test("returns { ok: true } on a 2xx response", async () => {
    mockFetch(new Response("{}", { status: 200 }));
    assert.deepEqual(await sendMail(base, env), { ok: true });
  });

  test("returns status and error text on a non-2xx response", async () => {
    mockFetch(new Response("Unauthorized", { status: 401 }));
    assert.deepEqual(await sendMail(base, env), { ok: false, status: 401, error: "Unauthorized" });
  });

  test("rejects (throws) on network failure; the handler is what catches it", async () => {
    mockFetch(new TypeError("fetch failed"));
    await assert.rejects(sendMail(base, env));
  });
});

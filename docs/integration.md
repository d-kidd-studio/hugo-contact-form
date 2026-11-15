# Integration guide

This guide shows how to connect a site's HTML form to the reusable handler in `@d-kidd-studio/verified-form-mailer`.

## 1. Install the package

From the consuming site's repository:

```bash
npm install github:d-kidd-studio/verified-form-mailer
```

Commit the generated package manifest and lockfile changes. For deployments that need reproducible dependency versions, use a release tag or pin the Git dependency to a specific commit once the project establishes a release/versioning policy.

The package is an ES module. Its public imports are:

```js
import { createFormHandler } from "@d-kidd-studio/verified-form-mailer/form";
import { verify } from "@d-kidd-studio/verified-form-mailer/verifiers/turnstile";
import { sendMail } from "@d-kidd-studio/verified-form-mailer/providers/mailjet";
```

## 2. Add the Cloudflare Pages Function entry point

Create this file in the consuming site's repository:

```text
functions/api/contact.js
```

Example:

```js
import { createFormHandler } from "@d-kidd-studio/verified-form-mailer/form";
import { verify } from "@d-kidd-studio/verified-form-mailer/verifiers/turnstile";
import { sendMail } from "@d-kidd-studio/verified-form-mailer/providers/mailjet";
import { buildContactMessage } from "../../src/contact-message.js";

export const onRequestPost = createFormHandler({
  buildMessage: buildContactMessage,
  sendMail,
  verify,
  successPath: "/thank-you",
  errorPath: "/contact?error=1",
});
```

Adjust the message-builder import and redirect paths for your site. This entry point is deliberately small: it wires the site's message builder and chosen adapters into the shared handler.

Cloudflare Pages discovers Functions from the consuming site's root `functions/` directory. The package supplies reusable JavaScript modules; it does not automatically create this route file for the site.

## 3. Implement the site's message builder

The handler calls:

```js
buildMessage(formData, { request, env })
```

The function can be synchronous or asynchronous. It should return the normalized message shape expected by the provider adapter.

Example:

```js
// src/contact-message.js
export function buildContactMessage(formData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!name || !email || !message) {
    throw new Error("Name, email, and message are required");
  }

  return {
    subject: "New website inquiry",
    text: [
      "New message from the website contact form",
      "",
      `Name: ${name}`,
      `Email: ${email}`,
      "",
      message,
    ].join("\n"),
    replyTo: { email, name },
    fromName: "Website",
    toName: "Website Contact",
  };
}
```

A thrown error from `buildMessage` is logged by the handler and results in a redirect to `errorPath`. Do not include secrets or sensitive submitted data in thrown error messages or logs.

### Message fields

| Property | Required | Meaning |
|---|---:|---|
| `subject` | Yes | Email subject |
| `text` | Yes | Plain-text message body |
| `html` | No | Optional HTML message body |
| `replyTo` | No | Optional `{ email, name }` reply-to identity |
| `fromName` | No | Sender display name; defaults to `Website` |
| `toName` | No | Recipient display name; defaults to `Website Contact` |

The handler obtains sender and recipient email addresses from `env.CONTACT_FROM_EMAIL` and `env.CONTACT_TO_EMAIL`. The Mailjet adapter maps this normalized object to Mailjet's v3.1 API payload.

Your message builder is the right place to interpret the site's own field names and create the message content. Validate the submitted values on the server. If you create HTML email content, escape untrusted values before inserting them into HTML.

## 4. Configure Cloudflare environment variables

For the included adapters and handler, set the following variables in Cloudflare Pages:

| Variable | Purpose |
|---|---|
| `TURNSTILE_SECRET_KEY` | Server-side Turnstile secret |
| `MAILJET_API_KEY` | Mailjet API key |
| `MAILJET_API_SECRET` | Mailjet API secret |
| `CONTACT_FROM_EMAIL` | Email sender address |
| `CONTACT_TO_EMAIL` | Email recipient address |

Configure them separately for Preview and Production as needed. Keep secrets in Cloudflare's environment settings, never in committed source or public Hugo configuration.

The Turnstile widget's public site key belongs in the form markup. The secret key belongs only in the server environment.

## 5. Add Turnstile to the form

The submitted form must include the Turnstile response field named `cf-turnstile-response`. Cloudflare's widget generates this field when it is successfully completed.

A typical form includes the Turnstile script and widget markup from Cloudflare's Turnstile documentation. Use the site's public site key in the widget. The package's server-side verifier reads the generated response field and checks it with Cloudflare Siteverify.

## 6. Understand the response behavior

The current handler behaves as follows:

| Stage | Result |
|---|---|
| Turnstile verifier returns `{ ok: true }` | Continue to message creation |
| Verifier returns `{ ok: false, status, message }` | Return that status and message directly |
| Message builder throws | Log the error and redirect to `errorPath` with HTTP 303 |
| Provider returns `{ ok: true }` | Redirect to `successPath` with HTTP 303 |
| Provider returns `{ ok: false, ... }` | Log the provider result and redirect to `errorPath` with HTTP 303 |

Unexpected exceptions thrown by the verifier or provider are not currently caught by the handler. Plan for this limitation when testing and operating the integration.

## 7. Redirect paths

Set both redirect options explicitly in the consuming site's Function:

```js
successPath: "/thank-you",
errorPath: "/contact?error=1",
```

The package currently defaults these values to `/thank-you` and `/contact?error=1`, but the actual pages and query-string handling belong to the consuming site.

Use trusted, same-origin absolute paths beginning with a single slash. Do not pass external URLs or values derived from form input. The current handler concatenates the configured path to the request origin and does not independently validate it.

## 8. Local and Preview testing checklist

- [ ] The Pages Function is present at `functions/api/contact.js`.
- [ ] The package is installed and committed in the site's dependency lockfile.
- [ ] The form submits to `/api/contact` using POST.
- [ ] The form includes a Turnstile widget and submits `cf-turnstile-response`.
- [ ] Preview has the Turnstile secret and Mailjet credentials configured.
- [ ] The message builder validates required fields and creates the expected message.
- [ ] A valid submission delivers an email to the expected recipient.
- [ ] The email subject, body, sender, and Reply-To values are correct.
- [ ] Successful delivery redirects to the configured success page.
- [ ] Invalid or missing Turnstile responses are rejected.
- [ ] A simulated provider rejection redirects to the configured error page.
- [ ] Production environment variables are configured separately before production rollout.

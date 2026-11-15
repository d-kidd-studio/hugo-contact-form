# Verified Form Mailer

A small, provider-pluggable JavaScript toolkit for Cloudflare Pages form endpoints. It coordinates three responsibilities:

1. Verify a submitted form (Cloudflare Turnstile by default).
2. Let the consuming site turn submitted fields into an email message.
3. Deliver that message through a provider adapter (Mailjet included).

The package deliberately does not define your form fields, email copy, page markup, or site-specific redirect destinations. Those belong to the site using it.

> **Current status:** the repository contains the reusable handler, a Turnstile verifier, and a Mailjet provider adapter. Roberts Apartments is the first integration/use case. The package is currently ESM and is not a Hugo theme or a complete contact-form UI.

## Package layout

```text
src/
  handler.js                 # createFormHandler()
  providers/
    mailjet.js               # Mailjet sendMail() adapter
  verifiers/
    turnstile.js             # Cloudflare Turnstile verify() adapter
package.json                 # ESM package exports
```

## Installation

Install from GitHub in the consuming site's project:

```bash
npm install github:d-kidd-studio/verified-form-mailer
```

For a production deployment, pin the dependency to a release tag or commit rather than tracking a moving branch. The package currently exposes these entry points:

| Import path | Exports |
|---|---|
| `@d-kidd-studio/verified-form-mailer/form` | `createFormHandler` |
| `@d-kidd-studio/verified-form-mailer/verifiers/turnstile` | `verify` |
| `@d-kidd-studio/verified-form-mailer/providers/mailjet` | `sendMail` |

## Cloudflare Pages integration

Cloudflare Pages discovers Functions from the consuming site's root `functions/` directory. Keep a small endpoint file in that location and use it to configure the package:

```js
// functions/api/contact.js
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

The relative import for `buildContactMessage` is an example; place your message builder wherever it makes sense in your site. Cloudflare bundles imports used by the Pages Function during deployment. The package does not automatically create or deploy the site's `functions/api/contact.js` entry point.

See [the integration guide](docs/integration.md) for a complete walkthrough and configuration details.

## Required Cloudflare environment variables

For the included Turnstile verifier and Mailjet adapter, configure these as Cloudflare Pages environment variables/secrets:

| Variable | Used by | Purpose |
|---|---|---|
| `TURNSTILE_SECRET_KEY` | Turnstile verifier | Secret key used for server-side Turnstile verification |
| `MAILJET_API_KEY` | Mailjet adapter | Mailjet API key |
| `MAILJET_API_SECRET` | Mailjet adapter | Mailjet API secret |
| `CONTACT_FROM_EMAIL` | Handler | Sender email address |
| `CONTACT_TO_EMAIL` | Handler | Recipient email address |

Set the values in each environment that needs them (for example Preview and Production). Do not commit secrets or expose them in Hugo's public site configuration. The Turnstile **site key** is public and belongs in the form markup; the **secret key** belongs only in the Cloudflare environment.

## Message contract

Your `buildMessage(formData, { request, env })` function receives the submitted `FormData` and request context. It returns a message object:

```js
export function buildContactMessage(formData, { request }) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  return {
    subject: "New website inquiry",
    text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
    replyTo: { email, name },
    // Optional:
    fromName: "Website",
    toName: "Website Contact",
    html: "<p>Optional HTML version</p>",
  };
}
```

Required message properties are `subject` and `text`. Optional properties are `html`, `replyTo`, `fromName`, and `toName`. The handler supplies sender and recipient email addresses from `CONTACT_FROM_EMAIL` and `CONTACT_TO_EMAIL`.

The message builder owns all site-specific field interpretation, validation beyond verification, subject/body wording, and reply-to selection. Treat submitted values as untrusted input; validate and safely encode them for any HTML email.

## Redirect behavior

The handler accepts `successPath` and `errorPath` options. They default to `/thank-you` and `/contact?error=1`, respectively, but consuming sites should set them explicitly so navigation remains a site-level decision.

Successful delivery redirects with HTTP 303 to `successPath`. A message-builder error or unsuccessful provider result redirects with HTTP 303 to `errorPath`. A failed verification currently returns its verifier-provided status/message directly rather than redirecting.

## Responsibilities and extension points

- **Handler:** orchestrates verification, message construction, delivery, and redirects.
- **Verifier:** implements `verify(formData, { request, env })` and returns `{ ok: true }` or `{ ok: false, status, message }`.
- **Message builder:** maps site-specific form fields into the standard message shape.
- **Provider:** implements `sendMail(message, env)` and returns `{ ok: true }` or `{ ok: false, ... }`.

A different provider can be supplied without changing the handler, provided it follows the provider contract. The included Mailjet adapter is the only provider implementation currently in this repository.

## Documentation

- [Integration guide](docs/integration.md) — install, configure, and connect a Cloudflare Pages form endpoint.
- [Architecture and contracts](docs/architecture.md) — package responsibilities, data flow, and adapter interfaces.
- [Design notes](docs/design.md) — project decisions and known follow-up areas.

## Current limitations

- The package does not provide a generic form template or front-end form validation.
- The site is responsible for validating required fields and constructing safe email content.
- The handler currently expects the provider to return a result; unexpected exceptions thrown by a provider are not converted into the configured error redirect.
- Redirect paths are concatenated to the request origin; supply trusted same-site path values beginning with `/`, not external URLs.
- Only Mailjet and Cloudflare Turnstile adapters are included today.
- The package has no automated test suite or published npm release configured in the current repository.

## License

No license has been added yet. Until one is chosen and committed, do not assume the repository grants broad reuse or redistribution rights.

# Verified Form Mailer

[![Test](https://github.com/d-kidd-studio/verified-form-mailer/actions/workflows/test.yml/badge.svg)](https://github.com/d-kidd-studio/verified-form-mailer/actions/workflows/test.yml)

A small, provider-pluggable JavaScript toolkit for Cloudflare Pages form endpoints. It coordinates three responsibilities:

1. Verify a submitted form (Cloudflare Turnstile by default).
2. Let the consuming site turn submitted fields into an email message.
3. Deliver that message through a provider adapter (Mailjet included).

The package deliberately does not define your form fields, email copy, page markup, or site-specific redirect destinations. Those belong to the site using it.

> **Current status:** the repository contains the reusable handler, a Turnstile verifier, a Mailjet provider adapter, and starter files with an initialization CLI. The package is currently ESM and is not a Hugo theme or a complete contact-form UI.

## Package layout

```text
src/
  handler.js
  providers/mailjet.js
  verifiers/turnstile.js
bin/
  cli.js
starters/cloudflare-pages/
  functions/api/contact.js
  functions/_lib/message.js
package.json
```

## Installation

Install from GitHub in the consuming site's project:

```bash
npm install @d-kidd-studio/verified-form-mailer
```

For production, pin the dependency to a release tag or commit rather than tracking a moving branch.

## Scaffold starter files

After installing the package, run this from the root of the consuming project:

```bash
npm exec -- verified-form-mailer init
```

The command copies two starter files into your project:

| Destination                 | Purpose                                                                        |
| --------------------------- | ------------------------------------------------------------------------------ |
| `functions/api/contact.js`  | Cloudflare Pages `POST /api/contact` entry point wired to the package adapters |
| `functions/_lib/message.js` | Site-specific message builder for your form fields and email content           |

The command will not overwrite existing files. If either destination already exists, it reports the conflict and exits without copying. Review the files before choosing to overwrite:

```bash
npm exec -- verified-form-mailer init -- --force
```

Preview the files that would be copied without changing the project:

```bash
npm exec -- verified-form-mailer init -- --dry-run
```

After scaffolding, customize `functions/_lib/message.js`, review the success/error paths in `functions/api/contact.js`, add the required Cloudflare environment variables, and connect your HTML form to `POST /api/contact`.

See [the integration guide](docs/integration.md) for the complete setup.

## Public JavaScript exports

| Import path                                               | Export              |
| --------------------------------------------------------- | ------------------- |
| `@d-kidd-studio/verified-form-mailer/form`                | `createFormHandler` |
| `@d-kidd-studio/verified-form-mailer/verifiers/turnstile` | `verify`            |
| `@d-kidd-studio/verified-form-mailer/providers/mailjet`   | `sendMail`          |

## Required Cloudflare environment variables

For the included Turnstile verifier and Mailjet adapter, configure these as Cloudflare Pages environment variables/secrets:

| Variable               | Used by            | Purpose                                                |
| ---------------------- | ------------------ | ------------------------------------------------------ |
| `TURNSTILE_SECRET_KEY` | Turnstile verifier | Secret key used for server-side Turnstile verification |
| `MAILJET_API_KEY`      | Mailjet adapter    | Mailjet API key                                        |
| `MAILJET_API_SECRET`   | Mailjet adapter    | Mailjet API secret                                     |
| `CONTACT_FROM_EMAIL`   | Handler            | Sender email address                                   |
| `CONTACT_TO_EMAIL`     | Handler            | Recipient email address                                |

Set the values in each environment that needs them (for example Preview and Production). Do not commit secrets or expose them in Hugo's public site configuration. The Turnstile **site key** is public and belongs in the form markup; the **secret key** belongs only in the Cloudflare environment.

## Message contract

Your `buildMessage(formData, { request, env })` function receives the submitted `FormData` and request context. It returns a message object:

```js
{
  subject: "New website inquiry",
  text: "Plain-text message body",
  replyTo: { email: "visitor@example.com", name: "Visitor" },
  fromName: "Website",
  toName: "Website Contact"
}
```

Required message properties are `subject` and `text`. Optional properties are `html`, `replyTo`, `fromName`, and `toName`. The handler supplies sender and recipient email addresses from `CONTACT_FROM_EMAIL` and `CONTACT_TO_EMAIL`.

The message builder owns all site-specific field interpretation, validation beyond verification, subject/body wording, and reply-to selection. Treat submitted values as untrusted input; validate and safely encode them for any HTML email.

## Redirect behavior

The handler accepts `successPath` and `errorPath` options. They default to `/thank-you` and `/contact?error=1`, respectively, but consuming sites should set them explicitly so navigation remains a site-level decision.

Successful delivery redirects with HTTP 303 to `successPath`. A message-builder error, an unsuccessful provider result, an exception thrown by the provider or verifier, or a request body that can't be parsed as form data redirects with HTTP 303 to `errorPath` (and is logged with `console.error`). A verifier that _returns_ a failure (for example a missing or invalid Turnstile token) is answered directly with the verifier-provided status/message rather than a redirect.

## Responsibilities and extension points

- **Handler:** orchestrates verification, message construction, delivery, and redirects.
- **Verifier:** implements `verify(formData, { request, env })` and returns `{ ok: true }` or `{ ok: false, status, message }`.
- **Message builder:** maps site-specific form fields into the standard message shape.
- **Provider:** implements `sendMail(message, env)` and returns `{ ok: true }` or `{ ok: false, ... }`.

A different provider can be supplied without changing the handler, provided it follows the provider contract. The included Mailjet adapter is the only provider implementation currently in this repository.

## Documentation

- [Integration guide](docs/integration.md) — install, scaffold, configure, and connect a Cloudflare Pages form endpoint.
- [Architecture and contracts](docs/architecture.md) — package responsibilities, data flow, and adapter interfaces.
- [Design notes](docs/design.md) — project decisions and known follow-up areas.

## Current limitations

- The package does not provide a generic form template or front-end form validation.
- The site is responsible for validating required fields and constructing safe email content.
- Redirect paths are concatenated to the request origin; supply trusted same-site path values beginning with `/`, not external URLs.
- Only Mailjet and Cloudflare Turnstile adapters are included today.
- No published npm release is configured yet; install from a GitHub tag or commit.
- The handler does not yet validate that `subject`/`text` are present or that the required environment variables are set; missing values surface as a provider error and an `errorPath` redirect.

## Development

```bash
npm test
```

Tests use Node's built-in test runner (no dependencies) and cover the handler's success and failure branches plus the Turnstile and Mailjet adapters, with `fetch` mocked.

## License

This project is licensed under the [MIT License](LICENSE). Copyright (c) 2026 D-Kidd Studio.

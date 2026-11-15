# Architecture and API contracts

## Overview

The package is a small orchestration layer for form submissions handled by Cloudflare Pages Functions. It separates the generic request flow from site-specific email content and provider-specific delivery.

```text
Cloudflare Pages Function (owned by consuming site)
  |
  v
createFormHandler(...)
  |
  +--> verify(formData, { request, env })
  |
  +--> buildMessage(formData, { request, env })
  |
  +--> sendMail(normalizedMessage, env)
  |
  +--> redirect to successPath or errorPath
```

The consuming site owns its route entry point, HTML form, field names, message builder, environment configuration, and destination pages.

## Package exports

The package is an ES module with these public subpath exports:

| Import | Export |
|---|---|
| `@d-kidd-studio/verified-form-mailer/form` | `createFormHandler` |
| `@d-kidd-studio/verified-form-mailer/verifiers/turnstile` | `verify` |
| `@d-kidd-studio/verified-form-mailer/providers/mailjet` | `sendMail` |

## Handler factory

`createFormHandler(options)` accepts:

| Option | Required | Default | Contract |
|---|---:|---|---|
| `buildMessage` | Yes | — | Function called with `(formData, { request, env })`; returns the email message |
| `sendMail` | Yes | — | Function called with `(message, env)`; returns a delivery result |
| `verify` | Yes | — | Function called with `(formData, { request, env })`; returns a verification result |
| `successPath` | No | `/thank-you` | Same-site destination after successful delivery |
| `errorPath` | No | `/contact?error=1` | Same-site destination after message/provider failure |

The factory validates that the three callbacks are functions and returns an async Cloudflare Pages `onRequestPost` handler.

### Verification result

A successful verifier returns:

```js
{ ok: true }
```

A rejected verification returns:

```js
{
  ok: false,
  status: 400,
  message: "Verification failed"
}
```

The handler returns the verifier's message and status directly. The status defaults to 400 when omitted.

### Message builder result

The message builder returns an object with:

```js
{
  subject: "Subject",
  text: "Plain-text body",
  html: "<p>Optional HTML body</p>",
  fromName: "Optional sender display name",
  toName: "Optional recipient display name",
  replyTo: {
    email: "visitor@example.com",
    name: "Visitor"
  }
}
```

Only `subject` and `text` are required by the included Mailjet adapter. `html` and `replyTo` are optional. The handler supplies `from.email` and `to.email` from the Cloudflare environment and defaults the display names to `Website` and `Website Contact`.

The handler does not define or validate site-specific form fields. The consuming site's builder must validate its input and return a message object with safe content.

### Provider result

A successful provider returns:

```js
{ ok: true }
```

A rejected provider returns a result with `ok: false`; the included Mailjet adapter also returns the HTTP status and response text:

```js
{ ok: false, status: 401, error: "Provider response body" }
```

The handler logs unsuccessful provider results and redirects to `errorPath`.

## Included adapters

### Cloudflare Turnstile verifier

Import:

```js
import { verify } from "@d-kidd-studio/verified-form-mailer/verifiers/turnstile";
```

The verifier:

1. Requires `env.TURNSTILE_SECRET_KEY`.
2. Reads `cf-turnstile-response` from the submitted `FormData`.
3. Sends the token and, when available, the `CF-Connecting-IP` value to Cloudflare Siteverify.
4. Returns `{ ok: true }` when Siteverify reports success, otherwise a failure result.

A missing secret returns status 500. A missing or invalid token returns status 400. Network errors and non-JSON responses are not currently caught and normalized.

### Mailjet provider

Import:

```js
import { sendMail } from "@d-kidd-studio/verified-form-mailer/providers/mailjet";
```

The adapter maps the normalized message into a Mailjet v3.1 `Messages` payload, authenticates with `MAILJET_API_KEY` and `MAILJET_API_SECRET`, and posts to Mailjet's send endpoint.

It returns `{ ok: true }` for a successful HTTP response. For a non-success response it returns `{ ok: false, status, error }`, where `error` is the response body text.

## Redirect construction

The handler creates the redirect destination by concatenating the request URL's origin with the configured path and returns an HTTP 303 redirect. The defaults are convenient for a simple contact form, but consumers should explicitly supply their own paths.

**Current security limitation:** the configured path is not validated. Only provide trusted, same-origin paths beginning with a single `/`; never populate these options from request data. A future hardening change should parse the destination with the request origin and reject any value whose resulting origin differs from the request origin, including protocol-relative paths.

## Error-handling boundaries

The current handler catches errors thrown by `buildMessage`, logs them, and redirects to `errorPath`. It does not currently wrap verifier or provider calls in equivalent try/catch handling. A thrown network error from either adapter can therefore escape the handler and become a platform-level error response.

The current implementation also does not provide a generic server-side schema validator, request-size limit, rate limiter, or structured logging abstraction. Those are responsibilities to consider for a production deployment or future package versions.

## Cloudflare Pages and package boundary

Cloudflare Pages requires a root-level Function entry point in the consuming site's repository, such as `functions/api/contact.js`. That file imports the package modules and exports the configured `onRequestPost` handler.

The package includes an optional CLI scaffold that copies a Cloudflare Pages route entry point to `functions/api/contact.js` and a site-specific message builder to `functions/_lib/message.js`. The `_lib` directory keeps supporting code alongside the Pages Functions while avoiding a public route. The CLI does not overwrite existing files unless `--force` is supplied.

The package does not supply a Hugo layout or automatically deploy the Function entry point. A Hugo site can use any form markup it chooses, provided its form posts the expected data to the endpoint and includes the Turnstile response field when using the included verifier.

## Design principles

- Keep site-specific fields and email wording outside the shared handler.
- Keep provider API payload formats inside provider adapters.
- Keep secrets in the runtime environment, never in client-side form markup.
- Keep redirect destinations configurable by the consuming site.
- Keep the Cloudflare Pages entry point small and explicit.

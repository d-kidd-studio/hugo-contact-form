# Hugo Contact Form

A reusable contact-form integration for Hugo websites deployed to Cloudflare Pages.

The project provides a configurable Hugo form interface and a Cloudflare Pages Function that validates submissions and sends notification email through Mailjet. Cloudflare Turnstile is the default bot-protection integration.

## Goals

- Reuse one maintained implementation across multiple Hugo sites.
- Keep site-specific form fields, labels, recipient addresses, and branding configurable.
- Keep Mailjet credentials and the Turnstile secret server-side in Cloudflare environment variables.
- Keep the form visually native to each site's Hugo theme.
- Support ordinary contact forms as well as specialized inquiry forms.
- Avoid requiring a hosted form-builder service.

## Initial reference implementation

The first reference integration is in [d-kidd-studio/robertsapt](https://github.com/d-kidd-studio/robertsapt):

- `functions/api/contact.js` — Cloudflare Pages Function and Mailjet request.
- `themes/apartments/layouts/_default/contact.html` — apartment-specific Hugo form.

That implementation is a reference, not a drop-in reusable component. It currently mixes apartment-specific fields and email content into the generic submission handler. The new implementation will separate the shared submission pipeline from each site's form definition.

## Proposed architecture

1. **Hugo form component** — reusable partial/template and small client-side script. Each site supplies its own fields and presentation.
2. **Cloudflare Pages Function** — shared endpoint for request parsing, server-side validation, Turnstile verification, and Mailjet delivery.
3. **Site configuration** — recipient, verified sender identity, subject, redirect/response behavior, and allowed form fields.
4. **Deployment integration** — a documented way to put the Pages Function into the consuming site's root `functions/api` directory.

Cloudflare Pages requires Functions to be present in the deployed site's `functions` directory. The distribution mechanism must account for that. A Hugo Module alone can mount Hugo templates and assets, but should not be assumed to deploy the Pages Function automatically.

## Initial environment variables

| Variable | Purpose |
|---|---|
| `MAILJET_API_KEY` | Mailjet API key (Cloudflare secret) |
| `MAILJET_API_SECRET` | Mailjet API secret (Cloudflare secret) |
| `MAILJET_FROM_EMAIL` | Verified sender address |
| `MAILJET_FROM_NAME` | Sender display name |
| `CONTACT_TO_EMAIL` | Destination for submissions |
| `TURNSTILE_SECRET_KEY` | Turnstile secret (Cloudflare secret) |

The Turnstile site key is public and belongs in site configuration / rendered markup, not in a secret.

No placeholder recipient or sender addresses should be used as production fallbacks. Missing configuration should produce a safe server error and a useful server-side log.

## Security and reliability requirements

- Validate request method, content type, size, field lengths, and email address server-side.
- Verify Turnstile server-side; fail closed if protection is configured as required but verification is unavailable or unsuccessful.
- Support a honeypot field and sensible rate limiting / abuse controls.
- Never accept arbitrary recipient or sender addresses from the browser.
- Use the visitor's validated email only as `ReplyTo`, never as the Mailjet sender.
- Escape or safely format submitted content in email output.
- Do not log secrets, full message bodies, or unnecessary personal information.
- Return predictable success and error responses; don't expose Mailjet credentials or raw provider errors.
- Keep Mailjet credentials in Cloudflare secrets.

## Development sequence

1. Document the existing Roberts Apartments behavior and identify what should become generic.
2. Define a small configuration contract for site-specific fields and email metadata.
3. Implement and test the generic Pages Function.
4. Implement the Hugo form partial and client-side behavior.
5. Document installation and Cloudflare configuration.
6. Pilot the integration in PropertySuiteHQ, then migrate Roberts Apartments after the pilot is stable.

## Status

Initial repository scaffold. No production-ready handler or release has been published yet.

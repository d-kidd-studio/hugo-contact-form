# Hugo Contact Form

An extraction of the contact form integration currently used by Roberts Apartments.

## Version 1 scope

Version 1 is intentionally a **drop-in replacement for Roberts Apartments**, not a generalized form framework. The first goal is to move the current implementation into this repository without changing its behavior. Once that extraction is tested, we can make it configurable and reusable for other Hugo sites.

## Included files

| This repository | Roberts Apartments destination |
|---|---|
| `functions/api/contact.js` | `functions/api/contact.js` |
| `themes/apartments/layouts/_default/contact.html` | `themes/apartments/layouts/_default/contact.html` |

The consuming site continues to own its contact page content, theme styling, contact information, Turnstile site key, thank-you page, and thank-you layout.

## Behavior to preserve

- POST submissions to `/api/contact`
- Cloudflare Turnstile verification
- Mailjet v3.1 email delivery
- Existing apartment inquiry fields and conditional student fields
- Existing email subject, content, sender/recipient names, and Reply-To behavior
- Redirect to `/thank-you` on success
- Redirect to `/contact?error=1` on delivery failure

## Cloudflare Pages environment variables

Configure these in the Roberts Apartments Cloudflare Pages project:

- `MAILJET_API_KEY`
- `MAILJET_API_SECRET`
- `CONTACT_TO_EMAIL`
- `CONTACT_FROM_EMAIL`
- `TURNSTILE_SECRET_KEY`

The Hugo site must continue to provide `.Site.Params.turnstileSiteKey` as the public Turnstile site key.

## Installation

Copy the two files above into the corresponding paths in the Roberts Apartments repository, replacing the existing versions. No other page or theme files are intended to change in this first extraction.

## Follow-up work

This first version deliberately preserves the existing implementation for a direct behavior comparison. Before adopting it on additional sites, we can separately improve configuration, validation, error handling, and the way site-specific fields and email content are defined. Those changes should be introduced after the drop-in extraction has been verified.

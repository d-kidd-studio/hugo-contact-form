# Design notes

## Version 1: faithful Roberts Apartments extraction

The first milestone is intentionally narrow: extract the current Roberts Apartments contact form and Cloudflare Pages Function into this repository without changing behavior.

The acceptance criteria are:

- The form markup and conditional student-field behavior match the existing theme template.
- The endpoint remains `POST /api/contact`.
- Turnstile verification and Mailjet delivery work the same way as the current implementation.
- The email subject, body, sender/recipient display names, and Reply-To behavior remain unchanged.
- Successful submissions redirect to `/thank-you`.
- Failed Mailjet submissions redirect to `/contact?error=1`.
- The consuming Roberts Apartments site only needs the two extracted files replaced; its content, theme styling, Cloudflare environment variables, Turnstile site key, and thank-you page remain in place.

The files in this repository's `functions/api/contact.js` and `themes/apartments/layouts/_default/contact.html` are currently byte-for-byte content matches of the corresponding files in `d-kidd-studio/robertsapt` main.

## Version 1 is not a redesign

Do not introduce a generalized form schema, new response format, new field names, or a different email template as part of the initial extraction. That would make it harder to distinguish extraction regressions from behavior changes.

The current implementation has limitations, including minimal server-side field validation, placeholder fallback configuration, and limited Mailjet error handling. Record and address those as deliberate follow-up changes after the drop-in replacement has been tested. Preserve the current behavior for the extraction milestone rather than silently mixing those changes into it.

## Later milestone: make the integration reusable

After the Roberts Apartments replacement is verified, we can evolve the code to support other Hugo sites. Likely areas include:

- Site-specific fields and email formatting supplied through configuration.
- Explicit required configuration rather than placeholder fallbacks.
- Stronger server-side validation and safer provider error handling.
- Optional success/error destinations.
- A clear installation/update mechanism for multiple Hugo + Cloudflare Pages sites.

## Distribution consideration

Cloudflare Pages discovers Functions from the consuming site's root `functions/` directory. A Hugo Module can distribute Hugo templates and assets, but should not be assumed to deploy the Pages Function automatically. Any future module/package approach must explicitly install or synchronize `functions/api/contact.js` into the consuming site's root.

For the first milestone, a documented two-file copy is sufficient and keeps the integration easy to verify.

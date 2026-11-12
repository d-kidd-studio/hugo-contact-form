# Design notes

## Key design decision: separate shared behavior from site-specific content

The Roberts Apartments implementation currently combines a general Mailjet delivery pipeline with apartment-specific form fields (role, apartment size, school year, lease length, and move-in month). The new integration should not hardcode those fields or their email formatting into the shared handler.

The shared handler should accept a bounded set of submitted form fields, validate them against server-side configuration, and construct the Mailjet message using trusted server-side sender and recipient settings.

## Distribution approach

The project should initially be structured as a reusable integration repository, not immediately as a hosted form service.

A Hugo Module is a natural fit for Hugo partials, layouts, assets, and configuration examples. However, Cloudflare Pages Functions are discovered from the consuming site's root `functions/` directory. We need a deliberate installation strategy for that part, such as a versioned package/install script or a documented copy step. Avoid a design that appears reusable in Hugo but silently omits the API endpoint from the Cloudflare deployment.

Recommendation for the first release:

- Keep the canonical implementation in this repository.
- Provide Hugo Module-compatible templates/assets where practical.
- Provide a versioned installer or documented copy/integration step for `functions/api/contact.js`.
- Keep site configuration in the consuming site repository.
- Pin consumers to a release/tag rather than tracking a moving branch.

We can revisit an npm package or Hugo module wrapper once the first two sites prove the interface.

## Form configuration

The initial configuration should support:

- Form endpoint (default `/api/contact`)
- Public Turnstile site key
- Site-specific heading, labels, and fields
- Required/optional fields and basic field types
- Optional success URL and error handling
- Site-specific recipient and sender settings stored as Cloudflare environment variables

Do not build a large general-purpose form builder. The target is a dependable contact/inquiry form with a small, explicit configuration surface.

## Response behavior

The Roberts Apartments implementation uses browser form POST followed by a 303 redirect. Preserve that as an optional progressive-enhancement-friendly mode, but design the handler so a future fetch-based form can receive structured JSON responses. The default should be chosen during implementation based on both pilot sites.

## Security decisions to retain

- Recipient and sender are server configuration only.
- Turnstile verification happens on the server.
- Email syntax and field constraints are checked on the server.
- Use the validated visitor email as Reply-To only.
- Add honeypot support.
- Rate limiting needs an explicit Cloudflare-compatible design; a honeypot alone is not rate limiting.

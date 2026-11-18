# Design notes and roadmap

## Current design

The package separates a form endpoint into four cooperating pieces:

1. **Handler** — coordinates the request lifecycle through `createFormHandler()`.
2. **Verifier** — validates that a submission is legitimate. Cloudflare Turnstile is the included implementation.
3. **Message builder** — supplied by the consuming site; translates that site's `FormData` into a normalized email message.
4. **Provider** — delivers the normalized message. Mailjet is the included implementation.

The consuming site owns the Cloudflare Pages route entry point, form markup, field names, message content, environment configuration, and redirect destinations.

See [Architecture and API contracts](architecture.md) for the current interfaces and [Integration guide](integration.md) for setup instructions.

## Decisions

### Keep site-specific content out of the shared handler

The handler should not know whether a form is a property inquiry, a general contact form, or something else. The site supplies `buildMessage(formData, context)`, which owns field mapping and message construction.

This keeps form-specific content out of the shared package and allows multiple sites to use the same request orchestration.

### Keep provider details in adapters

The handler calls a provider using a normalized message contract. Provider adapters translate that contract into the API payload and authentication scheme required by a specific email service.

Mailjet is the first adapter because it was used by the initial Roberts Apartments integration. Other providers can be added without coupling their API details to the handler.

### Keep verification pluggable

The handler receives a `verify(formData, context)` function. Turnstile is included, but the contract allows a consuming site to supply another verification implementation.

### Let the consuming site own redirect paths

The handler provides fallback defaults for `successPath` and `errorPath`, but the consuming site should explicitly pass both options. The paths represent the site's own navigation and error experience, not email-delivery policy.

Only trusted same-origin paths should be configured. Redirect destination validation is a known hardening item.

### Keep the Cloudflare Pages entry point in the consuming site

Cloudflare Pages discovers Functions from the consuming repository's root `functions/` directory. The consuming site therefore retains a small entry point that imports the package and exports the configured `onRequestPost`. The package does not automatically create or deploy this entry point.

## Current implementation status

The package currently exports:

- `createFormHandler` from `/form`
- `verify` from `/verifiers/turnstile`
- `sendMail` from `/providers/mailjet`

The implementation is an ES module. It is not a Hugo theme, does not provide the site's form markup, and does not currently include a published npm release workflow or CI workflow.

## Follow-up work

The following items are candidates for future work; they are not represented as existing package capabilities.

1. **Redirect safety:** resolve configured paths against the request URL and reject external/protocol-relative destinations.
2. ~~**Exception handling:**~~ Done: the handler converts exceptions from the verifier, builder, provider and form parsing into the `errorPath` redirect and logs them.
3. **Configuration validation:** fail clearly when required sender, recipient, or provider credentials are missing.
4. **Message validation:** define and enforce the required normalized message properties before delivery.
5. **Input validation guidance:** document that site-specific builders must validate form fields and safely encode values in HTML email.
6. ~~**Testing:**~~ Done: `npm test` covers the handler, Turnstile verifier and Mailjet adapter.
7. **Provider expansion:** add another adapter only when there is a real consumer/use case to validate the interface.
8. **Release management:** define versioning, tags, and dependency pinning guidance for consuming sites.
9. **Second consumer:** validate the package in a second site to confirm that the abstractions are genuinely reusable.

## Scope principle

Keep the shared package small. Add an abstraction when a real consumer needs it, and keep site-specific behavior in the consuming site. Documentation should describe the code that is currently shipped and clearly label planned behavior as future work.

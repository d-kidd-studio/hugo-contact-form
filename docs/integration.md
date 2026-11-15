# Integration guide

This guide shows how to connect a site's HTML form to the reusable handler in `@d-kidd-studio/verified-form-mailer`.

## 1. Install the package

From the consuming site's repository:

```bash
npm install github:d-kidd-studio/verified-form-mailer
```

Commit the generated package manifest and lockfile changes. For reproducible deployments, pin the Git dependency to a release tag or commit once the project establishes a release/versioning policy.

## 2. Generate the starter files

Run this from the root of the consuming project:

```bash
npm exec -- verified-form-mailer init
```

The CLI copies these files from the package:

| Destination in your project | Purpose |
|---|---|
| `functions/api/contact.js` | Cloudflare Pages Function entry point |
| `src/contact-message.js` | Site-specific message builder |

The CLI creates parent directories as needed. It checks for existing destination files before copying; if either file already exists, it stops without overwriting anything.

To see what would be copied without changing files:

```bash
npm exec -- verified-form-mailer init -- --dry-run
```

To intentionally overwrite existing starter files:

```bash
npm exec -- verified-form-mailer init -- --force
```

**Important:** `--force` replaces both destination files, including any customizations you have made. Back up or commit your changes first.

## 3. Customize the message builder

Open `src/contact-message.js`. The starter expects fields named `name`, `email`, and `message`. Change these to match your form, and customize the validation, subject, body, and Reply-To behavior.

The handler calls:

```js
buildMessage(formData, { request, env })
```

The function can be synchronous or asynchronous. It should return the normalized message shape expected by the provider adapter.

Example:

```js
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

Your message builder is the right place to interpret the site's own field names and create the message content. Validate submitted values on the server. If you create HTML email content, escape untrusted values before inserting them into HTML.

## 4. Review the Cloudflare Pages Function

Open `functions/api/contact.js`. The starter imports the handler, Turnstile verifier, and Mailjet provider, then exports `onRequestPost`.

Update `successPath` and `errorPath` to destinations that exist in your site:

```js
export const onRequestPost = createFormHandler({
  buildMessage: buildContactMessage,
  sendMail,
  verify,
  successPath: "/thank-you",
  errorPath: "/contact?error=1",
});
```

Cloudflare Pages discovers Functions from the consuming site's root `functions/` directory. Keep this endpoint file in that location. The package does not automatically create or deploy the route entry point.

## 5. Configure Cloudflare environment variables

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

## 6. Add Turnstile to the form

The submitted form must include the Turnstile response field named `cf-turnstile-response`. Cloudflare's widget generates this field when it is successfully completed.

Add the Turnstile script and widget markup to your form using the public site key for your hostname. The package's server-side verifier reads the generated response field and checks it with Cloudflare Siteverify.

## 7. Understand the response behavior

The current handler behaves as follows:

| Stage | Result |
|---|---|
| Turnstile verifier returns `{ ok: true }` | Continue to message creation |
| Verifier returns `{ ok: false, status, message }` | Return that status and message directly |
| Message builder throws | Log the error and redirect to `errorPath` with HTTP 303 |
| Provider returns `{ ok: true }` | Redirect to `successPath` with HTTP 303 |
| Provider returns `{ ok: false, ... }` | Log the provider result and redirect to `errorPath` with HTTP 303 |

Unexpected exceptions thrown by the verifier or provider are not currently caught by the handler. Plan for this limitation when testing and operating the integration.

## 8. Test in Preview before Production

- [ ] The package is installed and the lockfile is committed.
- [ ] Starter files were generated and customized.
- [ ] The Pages Function is present at `functions/api/contact.js`.
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

# Hugo example

A copy-paste setup for adding a contact form to a Hugo site deployed on Cloudflare Pages. It assumes you have already installed the package and run the scaffold command from the project root:

```bash
npm install @d-kidd-studio/verified-form-mailer
npm exec -- verified-form-mailer init
```

For the full setup (environment variables, provider contract, redirect behavior), see the [integration guide](integration.md).

## 1. Add your Turnstile site key

The Turnstile **site key** is public and safe to put in your Hugo config. The **secret key** never goes in the repo. It belongs only in your Cloudflare Pages environment variables.

```toml
# hugo.toml
[params]
  turnstileSiteKey = "YOUR_PUBLIC_SITE_KEY"
```

## 2. Add the form partial

Save this as `layouts/partials/contact-form.html`:

```html
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<form action="/api/contact" method="post">
  <label>Name <input type="text" name="name" required></label>
  <label>Email <input type="email" name="email" required></label>
  <label>Message <textarea name="message" rows="6" required></textarea></label>

  <!-- Honeypot: real visitors never see or fill this field -->
  <div style="position:absolute;left:-9999px" aria-hidden="true">
    <label>Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label>
  </div>

  <div class="cf-turnstile" data-sitekey="{{ site.Params.turnstileSiteKey }}"></div>
  <button type="submit">Send message</button>
</form>
```

Use it on any page or template with:

```go-html-template
{{ partial "contact-form.html" . }}
```

The Turnstile widget adds a hidden token to the form automatically. The package verifies it server-side before anything is sent.

## 3. Write your message builder

Edit `functions/_lib/message.js`, which `init` created. The package does not care what your fields are called. This function decides what gets validated and what the email looks like. Adjust the export to match the file `init` generated.

```js
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const oneLine = (v) => String(v || '').replace(/[\r\n]+/g, ' ').trim();
const escapeHtml = (v) =>
  String(v).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));

export function buildMessage(formData) {
  // Honeypot: bots fill hidden fields, people don't.
  if (formData.get('website')) throw new Error('Rejected');

  const name = oneLine(formData.get('name'));
  const email = oneLine(formData.get('email'));
  const message = String(formData.get('message') || '').trim();

  if (!name || !EMAIL_RE.test(email) || !message) {
    throw new Error('Invalid submission');
  }

  return {
    subject: `New website inquiry from ${name}`,
    text: `From: ${name} <${email}>\n\n${message}`,
    html:
      `<p><strong>${escapeHtml(name)}</strong> (${escapeHtml(email)})</p>` +
      `<p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>`,
    replyTo: { email, name },
    fromName: 'Website',
    toName: 'Website Contact',
  };
}
```

A few things this example does on purpose:

- **Header injection:** line breaks are stripped from `name` and `email` before they can reach the subject or reply-to.
- **HTML injection:** every submitted value is escaped before it goes into the HTML body.
- **Honeypot:** a filled hidden field throws an error, which sends the visitor to your `errorPath`. A bot and a mistyped email take the same path, which is fine for this purpose.

## 4. Add the thank-you and error pages

Create `content/thank-you.md` so the default `successPath` (`/thank-you`) resolves.

For the default error redirect (`/contact?error=1`), Hugo cannot read query strings at build time. Show the notice with a small script on your contact page:

```html
<p id="form-error" hidden>Something went wrong. Please try again.</p>
<script>
  if (location.search.includes('error=1')) {
    document.getElementById('form-error').hidden = false;
  }
</script>
```

You can change both paths with the `successPath` and `errorPath` handler options. Use same-site paths that begin with `/`, not external URLs.

## 5. Test locally

Build the site and run it with Wrangler's Pages dev server:

```bash
hugo
npx wrangler pages dev public
```

Put your environment variables in a `.dev.vars` file at the project root and keep it out of git:

```
TURNSTILE_SECRET_KEY=...
MAILJET_API_KEY=...
MAILJET_API_SECRET=...
CONTACT_FROM_EMAIL=...
CONTACT_TO_EMAIL=...
```

Cloudflare publishes always-pass Turnstile test keys for development. Check their Turnstile testing documentation and use those instead of your real secret while testing.

## 6. Deploy

Set the same five variables in your Pages project settings for both Preview and Production. `CONTACT_FROM_EMAIL` must be a sender you have verified in Mailjet, or delivery will fail. Push, submit the form once from the live site, and confirm the email arrives with a working reply-to.

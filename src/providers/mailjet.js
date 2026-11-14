export function createContactHandler({
  buildMessage,
  sendMail,
  verify,
  successPath = "/thank-you",
  errorPath = "/contact?error=1",
} = {}) {
  for (const [name, fn] of Object.entries({ buildMessage, sendMail, verify })) {
    if (typeof fn !== "function") {
      throw new Error(`createContactHandler requires a ${name} function`);
    }
  }

  return async function onRequestPost({ request, env }) {
    const url = new URL(request.url);
    const fail = () => Response.redirect(`${url.origin}${errorPath}`, 303);
    const formData = await request.formData();

    // 1. Validation
    const check = await verify(formData, { request, env });
    if (!check.ok) {
      return new Response(check.message, { status: check.status ?? 400 });
    }

    // 2. Content (site)
    let msg;
    try {
      msg = await buildMessage(formData, { request, env });
    } catch (err) {
      console.error("buildMessage failed:", err);
      return fail();
    }

    // 3. Delivery (provider)
    const result = await sendMail(
      {
        from: {
          email: env.CONTACT_FROM_EMAIL,
          name: msg.fromName ?? "Website",
        },
        to: {
          email: env.CONTACT_TO_EMAIL,
          name: msg.toName ?? "Website Contact",
        },
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
        replyTo: msg.replyTo,
      },
      env,
    );

    if (result.ok) return Response.redirect(`${url.origin}${successPath}`, 303);

    console.error("Email provider rejected submission:", result);
    return fail();
  };
}

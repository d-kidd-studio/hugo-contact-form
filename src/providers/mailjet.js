export async function sendMail(msg, env) {
  const payload = {
    Messages: [
      {
        From: { Email: msg.from.email, Name: msg.from.name },
        To: [{ Email: msg.to.email, Name: msg.to.name }],
        Subject: msg.subject,
        TextPart: msg.text,
        ...(msg.html && { HTMLPart: msg.html }),
        ...(msg.replyTo && {
          ReplyTo: { Email: msg.replyTo.email, Name: msg.replyTo.name },
        }),
      },
    ],
  };

  const resp = await fetch("https://api.mailjet.com/v3.1/send", {
    method: "POST",
    headers: {
      Authorization:
        "Basic " + btoa(`${env.MAILJET_API_KEY}:${env.MAILJET_API_SECRET}`),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (resp.ok) return { ok: true };

  return { ok: false, status: resp.status, error: await resp.text() };
}

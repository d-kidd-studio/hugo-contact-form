/**
 * Convert this site's submitted form fields into the message sent by the
 * configured email provider.
 *
 * Customize the field names, validation, subject, and message body for your
 * own form. Submitted values are untrusted input.
 */
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

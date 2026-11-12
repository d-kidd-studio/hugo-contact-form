export const onRequestPost = async (context) => {
  const { request, env } = context;
  const apiKey = env.MAILJET_API_KEY;
  const apiSecret = env.MAILJET_API_SECRET;
  const toEmail = env.CONTACT_TO_EMAIL || "your-recipient@example.com";
  const fromEmail = env.CONTACT_FROM_EMAIL || "noreply@roberts-apts.com";

  const formData = await request.formData();
  const token = formData.get("cf-turnstile-response");

  // Verify Turnstile token
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!token) {
    return new Response("Turnstile token missing", { status: 400 });
  }

  const verifyResponse = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:
        `secret=${encodeURIComponent(secret)}` +
        `&response=${encodeURIComponent(token)}`,
    },
  );
  const verification = await verifyResponse.json();
  if (!verification.success) {
    return new Response("Turnstile verification failed", { status: 400 });
  }

  // Basic fields
  const name = formData.get("name");
  const email = formData.get("email");
  const phone = formData.get("phone");
  const message = formData.get("message");
  const referer = request.headers.get("Referer") || ""; // <— changed
  const role = formData.get("role");

  // Student-specific fields
  const apartmentSizes = formData.getAll("apartmentSize[]");
  const schoolYear = formData.get("schoolYear");
  const leaseLength = formData.get("leaseLength");
  const moveInMonth = formData.get("moveInMonth");

  // Payload
  const payload = {
    Messages: [
      {
        From: { Email: fromEmail, Name: "Apartment Inquiry" },
        To: [{ Email: toEmail, Name: "Apartment Leasing" }],
        Subject: "New Apartment Inquiry",
        TextPart: `Message from the Contact Form:

Name: ${name}
Email: ${email}
Phone: ${phone}
Referrer: ${referer}

--- Apartment Details ---
Role: ${role || "N/A"}
Apartment sizes: ${
          apartmentSizes && apartmentSizes.length
            ? apartmentSizes.join(", ")
            : "N/A"
        }
School year: ${schoolYear || "N/A"}
Lease length: ${leaseLength || "N/A"}
Desired move-in month: ${moveInMonth || "N/A"}

----- Message -----
${message}
`,
        ReplyTo: { Email: email, Name: name },
      },
    ],
  };

  const resp = await fetch("https://api.mailjet.com/v3.1/send", {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${apiKey}:${apiSecret}`),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const url = new URL(request.url);
  if (resp.ok) {
    return Response.redirect(`${url.origin}/thank-you`, 303);
  } else {
    return Response.redirect(`${url.origin}/contact?error=1`, 303);
  }
};

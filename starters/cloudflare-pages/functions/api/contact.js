import { createFormHandler } from "@d-kidd-studio/verified-form-mailer/form";
import { verify } from "@d-kidd-studio/verified-form-mailer/verifiers/turnstile";
import { sendMail } from "@d-kidd-studio/verified-form-mailer/providers/mailjet";
import { buildContactMessage } from "../../src/contact-message.js";

export const onRequestPost = createFormHandler({
  buildMessage: buildContactMessage,
  sendMail,
  verify,

  // Change these paths to pages that exist in your site.
  successPath: "/thank-you",
  errorPath: "/contact?error=1",
});

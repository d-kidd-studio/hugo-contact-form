export async function verify(formData, { request, env }) {
  if (!env.TURNSTILE_SECRET_KEY) {
    return {
      ok: false,
      status: 500,
      message: "Turnstile secret not configured",
    };
  }

  const token = formData.get("cf-turnstile-response");
  if (!token) {
    return { ok: false, status: 400, message: "Turnstile token missing" };
  }

  const body = new URLSearchParams({
    secret: env.TURNSTILE_SECRET_KEY,
    response: token,
  });
  const ip = request.headers.get("CF-Connecting-IP");
  if (ip) body.set("remoteip", ip);

  const resp = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body },
  );
  const result = await resp.json();

  return result.success
    ? { ok: true }
    : { ok: false, status: 400, message: "Turnstile verification failed" };
}

/*
 * POST /api/contact  -  contact form backend for a static site on Cloudflare Pages.
 *
 * Cloudflare Pages turns every file under functions/ into a route, so this file
 * answers /api/contact. There is no build step, no npm, and no wrangler config.
 * Push the repo and the endpoint exists.
 *
 * Configure it with environment variables in the Cloudflare dashboard, under
 * Workers and Pages > the project > Settings > Variables and secrets:
 *
 *   CONTACT_TO      Inbox that receives the messages. Must be a verified
 *                   destination address under Email Routing on the same account.
 *   CONTACT_FROM    Address the mail is sent from, on the site's own domain,
 *                   for example form@example.com. Nothing has to receive mail
 *                   there, it only has to exist as a sender.
 *   CF_ACCOUNT_ID   Account ID from the Workers and Pages overview page.
 *   CF_EMAIL_TOKEN  API token with the "Email Sending: Edit" permission.
 *                   Add this one as a secret, not a plain text variable.
 *
 * Sending to a verified destination address on your own account is free on
 * every Cloudflare plan, including the free one, and does not count against any
 * sending quota. That is the point of this setup: no third party service and
 * nothing for the site owner to sign up for beyond Cloudflare itself.
 *
 * RESEND_API_KEY is an optional escape hatch. Set it and this endpoint sends
 * through Resend instead, which delivers to any address rather than only to
 * verified ones. CONTACT_TO and CONTACT_FROM still apply.
 *
 * With none of it configured the endpoint answers 501 and the front end falls
 * back to opening the visitor's mail app, so the form is never a dead end.
 */

const LIMITS = { name: 120, email: 200, message: 6000 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const jsonResponse = function (data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
};

/* A submit with JavaScript switched off lands here too, so answer that one with
   something a browser can render instead of raw JSON. */
const pageResponse = function (data, status) {
  const line = data.ok
    ? "Message sent. Thanks, you will hear back soon."
    : "That message did not send. Please send an email instead.";
  const body =
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    "<title>Contact</title></head>" +
    '<body style="font:16px/1.6 system-ui,sans-serif;margin:12vh auto;max-width:34rem;padding:0 1.5rem">' +
    "<p>" + line + '</p><p><a href="/">Back to the site</a></p></body></html>';
  return new Response(body, {
    status: status || 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }
  });
};

/* Escapes text before it goes anywhere near the HTML body. A message is
   whatever a stranger typed into a form on the open internet, so it is treated
   as text in every direction and never as markup. */
const escapeHtml = function (value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const LABEL =
  "font:600 11px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;" +
  "letter-spacing:.12em;text-transform:uppercase;color:#6F8276";
const BODY =
  "font:400 15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#17201C";

/* A real looking email instead of a wall of unstyled text. Tables and inline
   styles, because that is still what mail clients understand: no flexbox, no
   grid, no external stylesheet, no remote images. The site's own colours on a
   light card, which reads correctly both in clients that ignore dark mode and
   in the ones that invert it. */
const htmlBody = function (mail) {
  const rows = mail.facts
    .map(function (fact) {
      const value = fact.href
        ? '<a href="' + escapeHtml(fact.href) + '" style="color:#1C5F4A">' + escapeHtml(fact.value) + "</a>"
        : escapeHtml(fact.value);
      return (
        '<tr><td style="' + LABEL + ';padding:0 14px 10px 0;width:84px;vertical-align:top">' +
        escapeHtml(fact.label) +
        '</td><td style="' + BODY + ';padding:0 0 10px">' + value + "</td></tr>"
      );
    })
    .join("");

  return [
    '<!doctype html><html lang="en"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    "<title>" + escapeHtml(mail.subject) + "</title></head>",
    '<body style="margin:0;padding:0;background:#EEF1EF">',
    /* Sits in the inbox preview line instead of the first words of the message. */
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0">' + escapeHtml(mail.preview) + "</div>",
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EEF1EF;padding:24px 12px">',
    "<tr><td align=\"center\">",
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#FFFFFF;border:1px solid #DCE3DE">',

    '<tr><td style="background:#0F1815;padding:22px 28px">',
    "<div style=\"font:700 17px/1.2 -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#ECF1EC\">Haydn McIntyre</div>",
    '<div style="' + LABEL + ';color:#E5B457;padding-top:6px">New enquiry</div>',
    "</td></tr>",
    '<tr><td style="height:3px;background:#E5B457;font-size:0;line-height:0">&nbsp;</td></tr>',

    '<tr><td style="padding:26px 28px 6px">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' + rows + "</table>",
    "</td></tr>",

    '<tr><td style="padding:10px 28px 4px">',
    '<div style="' + LABEL + ';padding-bottom:8px">Message</div>',
    '<div style="border-left:3px solid #1C5F4A;background:#F6F8F7;padding:16px 18px;' + BODY + '">',
    mail.messageHtml,
    "</div></td></tr>",

    '<tr><td style="padding:22px 28px 28px">',
    '<a href="mailto:' + escapeHtml(mail.replyTo) + '" ',
    'style="display:inline-block;background:#E5B457;color:#17130A;text-decoration:none;',
    "font:600 14px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;padding:14px 22px\">",
    "Reply to " + escapeHtml(mail.name) + "</a>",
    "</td></tr>",

    '<tr><td style="border-top:1px solid #DCE3DE;padding:16px 28px;',
    "font:400 12px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#6F8276\">",
    "Sent from the contact form on " + escapeHtml(mail.site) + ". Replying goes straight to the sender.",
    "</td></tr>",

    "</table></td></tr></table></body></html>"
  ].join("");
};

/* Which mail path is configured, if any. */
const provider = function (env) {
  if (!env.CONTACT_TO || !env.CONTACT_FROM) return null;
  if (env.RESEND_API_KEY) return "resend";
  if (env.CF_ACCOUNT_ID && env.CF_EMAIL_TOKEN) return "cloudflare";
  return null;
};

/* Collapses whitespace and strips line breaks, which also stops anyone from
   smuggling extra mail headers in through the name or email field. */
const oneLine = function (value, max) {
  return String(value == null ? "" : value)
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
};

const readFields = async function (request) {
  const type = request.headers.get("content-type") || "";
  if (type.indexOf("application/json") !== -1) {
    const body = await request.json();
    return body && typeof body === "object" ? body : {};
  }
  const form = await request.formData();
  const out = {};
  form.forEach(function (value, key) { out[key] = value; });
  return out;
};

const sendWithCloudflare = async function (env, mail) {
  const url =
    "https://api.cloudflare.com/client/v4/accounts/" +
    env.CF_ACCOUNT_ID +
    "/email/sending/send";
  const headers = {
    authorization: "Bearer " + env.CF_EMAIL_TOKEN,
    "content-type": "application/json"
  };
  const payload = {
    from: mail.from,
    to: env.CONTACT_TO,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    reply_to: mail.replyTo
  };

  let res = await fetch(url, { method: "POST", headers: headers, body: JSON.stringify(payload) });
  /* Shed the optional parts one at a time rather than lose the message. Some
     accounts reject reply_to, and an older sending API may not know html. The
     plain text body is the last thing standing, so the mail still arrives. */
  if (res.status === 400) {
    delete payload.reply_to;
    res = await fetch(url, { method: "POST", headers: headers, body: JSON.stringify(payload) });
  }
  if (res.status === 400) {
    delete payload.html;
    res = await fetch(url, { method: "POST", headers: headers, body: JSON.stringify(payload) });
  }
  return res;
};

const sendWithResend = function (env, mail) {
  return fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: "Bearer " + env.RESEND_API_KEY,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      from: mail.from,
      to: [env.CONTACT_TO],
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      reply_to: mail.replyTo
    })
  });
};

/* GET /api/contact reports whether the mail path is wired up. Handy on handover
   day: curl it and you know in one second whether the form will deliver. */
export function onRequestGet(context) {
  const how = provider(context.env);
  return jsonResponse({ ok: true, configured: Boolean(how), provider: how });
}

export async function onRequestPost(context) {
  const request = context.request;
  const env = context.env;
  const wantsJson = (request.headers.get("accept") || "").indexOf("application/json") !== -1;
  const respond = function (data, status) {
    return wantsJson ? jsonResponse(data, status) : pageResponse(data, status);
  };

  let fields;
  try {
    fields = await readFields(request);
  } catch (err) {
    return respond({ ok: false, code: "bad_request" }, 400);
  }

  /* Two cheap spam traps: a hidden field a human never sees, and a form filled
     out faster than anyone can type. Both answer as if the send worked, so a
     bot learns nothing from the response. */
  if (String(fields._gotcha || "").length) return respond({ ok: true }, 200);
  const started = Number(fields._t);
  if (started > 0 && Date.now() - started < 2000) return respond({ ok: true }, 200);

  const name = oneLine(fields.name, LIMITS.name);
  const email = oneLine(fields.email, LIMITS.email);
  const message = String(fields.message == null ? "" : fields.message).trim().slice(0, LIMITS.message);

  const bad = [];
  if (!name) bad.push("name");
  if (!EMAIL_RE.test(email)) bad.push("email");
  if (!message) bad.push("message");
  if (bad.length) return respond({ ok: false, code: "invalid", fields: bad }, 422);

  const how = provider(env);
  if (!how) return respond({ ok: false, code: "not_configured" }, 501);

  const site = new URL(request.url).hostname;
  const country = (request.cf && request.cf.country) || "unknown";
  const sent = new Date().toUTCString();

  const mail = {
    /* A display name reads as a person rather than a bare robot address, and
       filters weigh a naked automated sender more harshly. */
    from: 'Haydn McIntyre website <' + env.CONTACT_FROM + '>',
    subject: "New enquiry from " + name,
    replyTo: email,
    name: name,
    site: site,
    preview: message.replace(/\s+/g, " ").slice(0, 140),
    facts: [
      { label: "Name", value: name },
      { label: "Email", value: email, href: "mailto:" + email },
      { label: "Sent", value: sent },
      { label: "Country", value: country }
    ],
    messageHtml: escapeHtml(message).replace(/\r?\n/g, "<br>"),
    /* The plain text alternative is not a leftover. Mail carrying both parts
       looks like real mail, where a text-only body is a spam signal on its own. */
    text: [
      "New enquiry from " + name,
      "",
      "Name:    " + name,
      "Email:   " + email,
      "Sent:    " + sent,
      "Country: " + country,
      "",
      message,
      "",
      "Sent from the contact form on " + site + ". Reply to reach " + name + " directly."
    ].join("\n")
  };
  mail.html = htmlBody(mail);

  let res;
  try {
    res = how === "resend" ? await sendWithResend(env, mail) : await sendWithCloudflare(env, mail);
  } catch (err) {
    console.log("contact: send threw", String(err));
    return respond({ ok: false, code: "send_failed" }, 502);
  }

  if (!res.ok) {
    /* Shows up in the dashboard log stream and in wrangler pages deployment tail. */
    console.log("contact: " + how + " returned " + res.status, await res.text());
    return respond({ ok: false, code: "send_failed" }, 502);
  }

  return respond({ ok: true }, 200);
}

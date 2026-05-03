import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const TRIGGER_SECRET = Deno.env.get('TRIGGER_SECRET') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_EMAIL = 'Inkbug Beta <notifications@inkbugbeta.com>';
const APP_NAME = 'Inkbug Beta';

function buildHtml(heading: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ef;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#1a1f2d;padding:24px 32px;">
            <p style="margin:0;color:#faf7f2;font-size:18px;font-weight:bold;letter-spacing:0.02em;">${APP_NAME}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h2 style="margin:0 0 16px;font-size:20px;color:#1a1f2d;">${heading}</h2>
            ${body}
            <hr style="margin:32px 0 24px;border:none;border-top:1px solid #eee;" />
            <p style="margin:0;color:#aaa;font-size:12px;line-height:1.6;">
              You're receiving this because you have an ${APP_NAME} account.<br/>
              To stop these emails, visit Account Settings in the app.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const secret = req.headers.get('x-trigger-secret');
  if (!TRIGGER_SECRET || secret !== TRIGGER_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: Record<string, string>;
  try {
    payload = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { type, recipientEmail, recipientName, senderName, preview, chapterTitle } = payload;

  if (!recipientEmail || !type) {
    return new Response('Missing required fields', { status: 400 });
  }

  const name = recipientName || 'there';

  let subject: string;
  let html: string;

  if (type === 'message') {
    subject = `${senderName} sent you a message on ${APP_NAME}`;
    html = buildHtml(
      `New message from ${senderName}`,
      `<p style="color:#444;line-height:1.7;margin:0 0 20px;">Hi ${name},</p>
       <blockquote style="margin:0 0 20px;padding:14px 18px;background:#f9f7f4;border-left:3px solid #4f9e8f;border-radius:4px;color:#333;font-style:italic;">
         "${preview}"
       </blockquote>
       <p style="margin:0 0 20px;">
         <a href="https://inkbugbeta.com" style="display:inline-block;padding:11px 22px;background:#4f9e8f;color:#fff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">
           Open Inbox &rarr;
         </a>
       </p>`
    );
  } else if (type === 'comment') {
    subject = `${senderName} commented on "${chapterTitle}"`;
    html = buildHtml(
      `New comment on "${chapterTitle}"`,
      `<p style="color:#444;line-height:1.7;margin:0 0 20px;">Hi ${name}, <strong>${senderName}</strong> left a comment on your chapter:</p>
       <blockquote style="margin:0 0 20px;padding:14px 18px;background:#f9f7f4;border-left:3px solid #4f9e8f;border-radius:4px;color:#333;font-style:italic;">
         "${preview}"
       </blockquote>
       <p style="margin:0 0 20px;">
         <a href="https://inkbugbeta.com" style="display:inline-block;padding:11px 22px;background:#4f9e8f;color:#fff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">
           View Comment &rarr;
         </a>
       </p>`
    );
  } else {
    return new Response('Unknown notification type', { status: 400 });
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: recipientEmail, subject, html }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Resend error:', err);
    return new Response('Email send failed', { status: 502 });
  }

  return new Response('ok', { status: 200 });
});

/**
 * submission-created.js
 * =====================
 * Netlify Function that fires automatically when a form submission is created.
 *
 * Receives: the Netlify form submission payload (audit data + email)
 * Does:
 *   1. Generates the personalized 4-page audit PDF
 *   2. Emails it to the lead via Resend (with calendar CTA)
 *   3. Emails a notification to VOLA (info@) so Greg sees the lead immediately
 *
 * Environment variables (set in Netlify UI → Site settings → Environment variables):
 *   RESEND_API_KEY       — your re_... key from resend.com
 *   FROM_EMAIL           — greg@vola-benefits.com (domain must be verified in Resend)
 *   FROM_NAME            — display name, e.g. "Gregory Meyer at VOLA Benefits"
 *   NOTIFICATION_EMAIL   — where lead alerts go (info@vola-benefits.com)
 *   CALENDAR_URL         — Zoho Bookings link (default fallback baked in)
 */

const { generateReport, calculate, INDUSTRY_DATA, SETUP_LABELS, dollars } = require('./build-audit-report');

const DEFAULT_CALENDAR_URL = 'https://vola.zohobookings.com/#/4052706000000281038';

// ---------------------------------------------------------------------------
// Resend API call (no SDK — just fetch, keeps the bundle tiny)
// ---------------------------------------------------------------------------
async function sendEmailViaResend({ apiKey, from, to, subject, html, attachments }) {
  const body = {
    from,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  };
  if (attachments && attachments.length) body.attachments = attachments;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Resend API error ${res.status}: ${text}`);
  }
  return JSON.parse(text);
}

// ---------------------------------------------------------------------------
// Email templates
// ---------------------------------------------------------------------------
function leadEmailHtml({ industryLabel, headcount, total, dpc, savings, calendarUrl }) {
  const savingsLine = savings > 0
    ? `<p style="margin:0 0 16px;color:#B8C5D1;font-size:15px;line-height:1.6;">
         The math: roughly <strong style="color:#2DD4BF;">${dollars(savings)}</strong> a year
         in hidden cost you'd redirect into actual benefits your team uses.
       </p>`
    : `<p style="margin:0 0 16px;color:#B8C5D1;font-size:15px;line-height:1.6;">
         Your hidden cost is in the same ballpark as a DPC investment — the difference is
         what you get for the spend: real benefits, lower turnover, recruiting leverage.
       </p>`;

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#0E2A3F;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#0E2A3F;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#0E2A3F;">

      <tr><td style="padding:8px 0 24px;">
        <span style="color:#FFFFFF;font-weight:700;font-size:22px;letter-spacing:0.18em;">V O L A</span>
        <span style="color:#FFFFFF;font-weight:600;font-size:11px;vertical-align:super;margin-left:2px;">TM</span>
        <span style="color:#2DD4BF;font-weight:600;font-size:11px;letter-spacing:0.18em;margin-left:14px;border-left:1px solid rgba(45,212,191,0.4);padding-left:14px;">THE CAROLINAS AGENCY</span>
      </td></tr>

      <tr><td style="padding:0 0 8px;">
        <p style="margin:0;color:#2DD4BF;font-size:11px;letter-spacing:0.18em;font-weight:700;">YOUR BENEFITS AUDIT</p>
      </td></tr>

      <tr><td style="padding:0 0 20px;">
        <h1 style="margin:0;color:#FFFFFF;font-size:28px;font-weight:700;line-height:1.2;">
          Here's your audit report.
        </h1>
      </td></tr>

      <tr><td style="padding:0 0 24px;">
        <p style="margin:0;color:#B8C5D1;font-size:15px;line-height:1.6;">
          Attached is the full PDF — your numbers, your industry benchmarks, and a one-page
          summary of what redirecting that hidden cost into a real plan would look like.
        </p>
      </td></tr>

      <tr><td style="padding:0 0 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
               style="background:#0A1E2D;border:1px solid #2DD4BF;border-radius:10px;">
          <tr><td style="padding:24px;">
            <p style="margin:0 0 6px;color:#94A3B8;font-size:11px;letter-spacing:0.15em;font-weight:700;">YOUR ANNUAL HIDDEN COST</p>
            <p style="margin:0 0 14px;color:#2DD4BF;font-size:36px;font-weight:700;line-height:1;">${dollars(total)}</p>
            <p style="margin:0;color:#B8C5D1;font-size:13px;">
              ${industryLabel} business · ${headcount} employees · vs. ${dollars(dpc)} for a comparable DPC plan
            </p>
          </td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:0 0 24px;">
        ${savingsLine}
      </td></tr>

      <tr><td style="padding:0 0 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="background:#2DD4BF;border-radius:8px;">
            <a href="${calendarUrl}"
               style="display:inline-block;padding:14px 28px;color:#0E2A3F;text-decoration:none;font-weight:700;font-size:15px;">
              Book a 20-minute walkthrough
            </a>
          </td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:0 0 8px;">
        <p style="margin:0;color:#94A3B8;font-size:14px;line-height:1.6;">
          No follow-up unless you reply. If you'd rather talk now, you can also reach us
          directly at <strong style="color:#FFFFFF;">1-336-221-7101</strong>.
        </p>
      </td></tr>

      <tr><td style="padding:32px 0 0;border-top:1px solid #16364E;">
        <p style="margin:24px 0 4px;color:#FFFFFF;font-size:14px;font-weight:600;">Gregory Meyer</p>
        <p style="margin:0;color:#94A3B8;font-size:12px;">Managing Partner · VOLA Benefits</p>
        <p style="margin:8px 0 0;color:#64748B;font-size:11px;">
          701 Green Valley Rd. Ste 100, Greensboro, NC 27408 · vola-benefits.com
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}

function notificationEmailHtml({ leadEmail, industryLabel, headcount, setupLabel, turnover, total, dpc }) {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#F5F7FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr><td align="center" style="padding:24px 16px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:10px;">
      <tr><td style="padding:24px 28px;background:#0E2A3F;border-radius:10px 10px 0 0;">
        <p style="margin:0;color:#2DD4BF;font-size:11px;letter-spacing:0.18em;font-weight:700;">NEW AUDIT LEAD</p>
        <h1 style="margin:4px 0 0;color:#FFFFFF;font-size:22px;">${leadEmail}</h1>
      </td></tr>
      <tr><td style="padding:24px 28px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-size:14px;color:#0E2A3F;">
          <tr>
            <td style="padding:8px 0;color:#64748B;width:140px;">Industry</td>
            <td style="padding:8px 0;font-weight:600;">${industryLabel}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#64748B;">Headcount</td>
            <td style="padding:8px 0;font-weight:600;">${headcount}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#64748B;">Current setup</td>
            <td style="padding:8px 0;font-weight:600;">${setupLabel}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#64748B;">Turnover / year</td>
            <td style="padding:8px 0;font-weight:600;">${turnover}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#64748B;border-top:1px solid #E5E7EB;">Calculated hidden cost</td>
            <td style="padding:8px 0;font-weight:700;color:#0E2A3F;border-top:1px solid #E5E7EB;">${dollars(total)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#64748B;">Comparable DPC investment</td>
            <td style="padding:8px 0;font-weight:600;">${dollars(dpc)}</td>
          </tr>
        </table>
        <p style="margin:20px 0 0;color:#64748B;font-size:13px;">
          The lead has been emailed a copy of their personalized PDF report along with a
          link to book on your Zoho calendar. No further action required unless you want
          to reach out proactively.
        </p>
      </td></tr>
    </table>
    <p style="margin:16px 0 0;color:#94A3B8;font-size:11px;">VOLA Audit · automated notification</p>
  </td></tr>
</table>
</body></html>`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function parseSubmission(event) {
  // Netlify wraps the form submission in event.body as JSON.
  // The actual submitted fields live at payload.data.
  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (err) {
    throw new Error(`Invalid JSON in event body: ${err.message}`);
  }
  const data = (payload && payload.payload && payload.payload.data) || payload.data || {};

  const industry  = String(data.industry  || 'other');
  const headcount = parseInt(data.headcount, 10);
  const setup     = String(data.setup     || 'notsure');
  const turnover  = parseInt(data.turnover,  10);
  const email     = String(data.email     || '').trim();

  return {
    industry,
    headcount: Number.isFinite(headcount) ? headcount : 15,
    setup,
    turnover:  Number.isFinite(turnover)  ? turnover  : 2,
    email,
  };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
exports.handler = async (event) => {
  console.log('submission-created invoked');

  const RESEND_API_KEY     = process.env.RESEND_API_KEY;
  const FROM_EMAIL         = process.env.FROM_EMAIL         || 'greg@vola-benefits.com';
  const FROM_NAME          = process.env.FROM_NAME          || 'Gregory Meyer at VOLA Benefits';
  const NOTIFICATION_EMAIL = process.env.NOTIFICATION_EMAIL || 'info@vola-benefits.com';
  const CALENDAR_URL       = process.env.CALENDAR_URL       || DEFAULT_CALENDAR_URL;

  if (!RESEND_API_KEY) {
    console.error('Missing RESEND_API_KEY env var');
    return { statusCode: 500, body: 'Server misconfigured: missing RESEND_API_KEY' };
  }

  let submission;
  try {
    submission = parseSubmission(event);
  } catch (err) {
    console.error('Bad submission payload:', err.message);
    return { statusCode: 400, body: err.message };
  }

  const { industry, headcount, setup, turnover, email } = submission;
  const industryData = INDUSTRY_DATA[industry] || INDUSTRY_DATA.other;
  const r = calculate(industry, headcount, setup, turnover);

  console.log(`Generating report for ${email || '(no email)'} — ${industryData.label}, ${headcount} EEs`);

  // --- Generate the PDF
  let pdfBuffer;
  try {
    pdfBuffer = await generateReport({
      industry, headcount, setup, turnover, calendarUrl: CALENDAR_URL,
    });
  } catch (err) {
    console.error('PDF generation failed:', err);
    return { statusCode: 500, body: 'Failed to generate report PDF' };
  }
  const pdfBase64 = pdfBuffer.toString('base64');
  const pdfFilename = `VOLA-Benefits-Audit-${industryData.label.replace(/\W+/g, '-')}.pdf`;

  // --- Send lead email (with PDF attachment) — only if lead provided a valid-looking email
  const fromHeader = `${FROM_NAME} <${FROM_EMAIL}>`;
  const looksLikeEmail = /.+@.+\..+/.test(email);

  if (looksLikeEmail) {
    try {
      const leadHtml = leadEmailHtml({
        industryLabel: industryData.label,
        headcount,
        total:    r.total,
        dpc:      r.dpc,
        savings:  r.savings,
        calendarUrl: CALENDAR_URL,
      });
      await sendEmailViaResend({
        apiKey: RESEND_API_KEY,
        from:   fromHeader,
        to:     email,
        subject: 'Your VOLA Benefits Audit Report',
        html:   leadHtml,
        attachments: [{
          filename: pdfFilename,
          content:  pdfBase64,
        }],
      });
      console.log(`Lead email sent to ${email}`);
    } catch (err) {
      console.error('Lead email failed:', err.message);
      // Continue — still try to notify Greg even if the lead email bounces
    }
  } else {
    console.warn('Skipping lead email — no valid address on submission');
  }

  // --- Send notification email to VOLA (no attachment — PDF link to Netlify submission instead)
  try {
    const notifyHtml = notificationEmailHtml({
      leadEmail: email || '(no email provided)',
      industryLabel: industryData.label,
      headcount,
      setupLabel: SETUP_LABELS[setup] || setup,
      turnover,
      total: r.total,
      dpc:   r.dpc,
    });
    await sendEmailViaResend({
      apiKey: RESEND_API_KEY,
      from:   fromHeader,
      to:     NOTIFICATION_EMAIL,
      subject: `New audit lead — ${industryData.label}, ${headcount} EEs (${dollars(r.total)})`,
      html:   notifyHtml,
      attachments: [{
        filename: pdfFilename,
        content:  pdfBase64,
      }],
    });
    console.log(`Notification email sent to ${NOTIFICATION_EMAIL}`);
  } catch (err) {
    console.error('Notification email failed:', err.message);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true }),
  };
};

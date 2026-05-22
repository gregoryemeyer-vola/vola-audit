# VOLA Audit Landing Page

The Carolinas Small Business Healthcare Audit — interactive calculator + automated
PDF report delivery.

Lives at **https://audit.vola-benefits.com**.

## What this is

A single-page audit calculator (4 questions) that produces a personalized
hidden-cost number, then offers to email a branded 4-page PDF report to the lead
and notify VOLA of the new submission.

## How it works

1. Visitor fills out the 4-step audit on `public/index.html`
2. They submit their email → Netlify Forms captures the submission
3. Netlify automatically invokes `netlify/functions/submission-created.js`
4. That function:
   - Generates a personalized 4-page PDF (`build-audit-report.js` using pdfkit)
   - Emails the PDF + booking CTA to the lead via Resend
   - Emails a notification with audit details to `info@vola-benefits.com`

## Project structure

```
vola-audit/
├── public/
│   └── index.html              ← The live landing page
├── netlify/
│   └── functions/
│       ├── submission-created.js   ← Handler that fires on form submit
│       ├── build-audit-report.js   ← PDF generator (pdfkit)
│       └── package.json            ← Function deps (pdfkit)
├── netlify.toml                ← Netlify build configuration
├── package.json                ← Project root
└── README.md                   ← This file
```

## Required environment variables (set in Netlify UI)

| Variable             | Example value                                              |
|----------------------|------------------------------------------------------------|
| `RESEND_API_KEY`     | `re_...` from resend.com                                   |
| `FROM_EMAIL`         | `greg@vola-benefits.com` (domain verified in Resend)       |
| `FROM_NAME`          | `Gregory Meyer at VOLA Benefits`                           |
| `NOTIFICATION_EMAIL` | `info@vola-benefits.com`                                   |
| `CALENDAR_URL`       | `https://vola.zohobookings.com/#/4052706000000281038`      |

## Local testing

```bash
npm install --prefix netlify/functions
node netlify/functions/build-audit-report.js   # writes test_audit_report.pdf
```

## Deploy

This repo is deployed automatically via Netlify continuous deployment.
Push to `main` → Netlify rebuilds and ships in under a minute.

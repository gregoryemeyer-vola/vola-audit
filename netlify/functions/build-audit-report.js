/**
 * build-audit-report.js
 * =====================
 * VOLA Audit PDF generator (Node.js / pdfkit).
 *
 * Takes form submission data, runs the calculation, returns a Buffer
 * containing the polished, branded 4-page PDF.
 *
 * Brand system: navy/teal/white card-based, TM superscript on every page.
 * Matches the Audit landing page calculator exactly.
 */

const PDFDocument = require('pdfkit');

// -----------------------------------------------------------------------------
// BRAND TOKENS
// -----------------------------------------------------------------------------
const NAVY        = '#0E2A3F';
const NAVY_DEEP   = '#081E2B';
const NAVY_SOFT   = '#16364E';
const NAVY_CARD   = '#1E3A52';
const NAVY_BLACK  = '#0A1E2D';
const TEAL_DARK   = '#0A2A2A';
const TEAL        = '#2DD4BF';
const WHITE       = '#FFFFFF';
const GRAY_300    = '#B8C5D1';
const GRAY_400    = '#94A3B8';
const GRAY_500    = '#64748B';

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN_X = 0.6 * 72;  // 0.6 inch = 43.2pt

// -----------------------------------------------------------------------------
// INDUSTRY DATA
// -----------------------------------------------------------------------------
const INDUSTRY_DATA = {
  trades: {
    label: 'Construction & Trades',
    replacement_cost: 7500,
    top_pain: "Skilled trades shortage and high turnover make every replacement painful — and the work doesn't pause while you find them.",
    benchmark_note: 'Construction turnover runs higher than nearly any other industry. Even a small reduction has outsized financial impact.',
  },
  restaurant: {
    label: 'Restaurant & Food Service',
    replacement_cost: 4500,
    top_pain: 'Hourly staff burn out fast. The cost of constantly rehiring eats your margin before you ever see it.',
    benchmark_note: 'Food service has the highest turnover in the U.S. workforce. Every benefit you add becomes a retention lever.',
  },
  professional: {
    label: 'Professional Services',
    replacement_cost: 12000,
    top_pain: 'When a senior staffer leaves, you lose client relationships and institutional memory — not just a head.',
    benchmark_note: "Professional services workers expect strong benefits. Falling short signals you can't compete for talent.",
  },
  medical: {
    label: 'Dental / Medical Practice',
    replacement_cost: 10000,
    top_pain: "Credentialed staff are hard to replace and harder to train. Patient satisfaction follows your team's stability.",
    benchmark_note: "Practices that don't offer benefits lose talent to hospital systems within a year, on average.",
  },
  auto: {
    label: 'Auto Repair',
    replacement_cost: 7500,
    top_pain: 'A certified tech walks out and takes two bays of throughput with them. Hard to find, harder to train.',
    benchmark_note: 'Skilled techs are increasingly looking for benefits — not just hourly rate. A plan can be the deciding factor.',
  },
  manufacturing: {
    label: 'Distribution / Light Manufacturing',
    replacement_cost: 6500,
    top_pain: "Workers' comp claims escalate when employees don't have primary care — small issues become surgery.",
    benchmark_note: 'Mfg workers respond strongly to benefits — most jobs in their wage band offer little. You stand out fast.',
  },
  realestate: {
    label: 'Real Estate',
    replacement_cost: 8000,
    top_pain: 'Agent turnover means deals walk out the door — and the relationships took years to build.',
    benchmark_note: 'Brokerages offering benefits to admin and ops staff retain them dramatically longer than commission-only shops.',
  },
  other: {
    label: 'Small Business',
    replacement_cost: 7500,
    top_pain: "Most small businesses don't price their turnover. The ones that do realize it's their #1 hidden expense.",
    benchmark_note: 'About half of small employers offer health benefits. The other half lose talent to the half that do.',
  },
};

const SETUP_LABELS = {
  nothing:        'No benefits offered',
  highdeductible: 'High-deductible plan',
  partial:        'Partial / mixed coverage',
  notsure:        'Setup unclear',
};

const VACANCY_COST  = { nothing: 10000, highdeductible: 4000, partial: 2000, notsure: 5000 };
const SICK_DAY_RATE = { nothing: 600,   highdeductible: 600,  partial: 300,  notsure: 500 };
const WC_RATE       = { nothing: 150,   highdeductible: 75,   partial: 0,    notsure: 50 };

// -----------------------------------------------------------------------------
// CALCULATION (mirrors landing page JS exactly)
// -----------------------------------------------------------------------------
function calculate(industry, headcount, setup, turnover) {
  const data = INDUSTRY_DATA[industry] || INDUSTRY_DATA.other;
  const rep = data.replacement_cost;
  const turnoverCost = turnover * rep;
  const vacancyCost  = VACANCY_COST[setup]  ?? 5000;
  const sickCost     = headcount * (SICK_DAY_RATE[setup] ?? 500);
  const ficaCost     = headcount * 306;
  const wcCost       = headcount * (WC_RATE[setup] ?? 0);
  const total        = turnoverCost + vacancyCost + sickCost + ficaCost + wcCost;
  const dpc          = headcount * 1200;
  const savings      = total - dpc;
  return { turnoverCost, vacancyCost, sickCost, ficaCost, wcCost, total, dpc, savings };
}

function dollars(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

// -----------------------------------------------------------------------------
// DRAWING HELPERS
// -----------------------------------------------------------------------------
function drawPageBg(doc) {
  doc.save()
     .rect(0, 0, PAGE_W, PAGE_H)
     .fill(NAVY)
     .restore();
}

function drawHeader(doc, pageLabel) {
  // Wordmark
  doc.fillColor(WHITE)
     .font('Helvetica-Bold').fontSize(14)
     .text('V O L A', MARGIN_X, 32, { lineBreak: false });

  // TM superscript
  doc.fontSize(7)
     .text('TM', MARGIN_X + 56, 30, { lineBreak: false });

  // Tag
  doc.fillColor(TEAL)
     .fontSize(7)
     .text('THE CAROLINAS AGENCY', MARGIN_X + 72, 34, { lineBreak: false });

  if (pageLabel) {
    doc.fillColor(GRAY_400)
       .font('Helvetica').fontSize(8)
       .text(pageLabel.toUpperCase(),
             MARGIN_X, 34,
             { width: PAGE_W - 2 * MARGIN_X, align: 'right', lineBreak: false });
  }

  // Accent line
  doc.strokeColor(TEAL)
     .lineWidth(0.5)
     .moveTo(MARGIN_X, 54)
     .lineTo(PAGE_W - MARGIN_X, 54)
     .stroke();
}

function drawFooter(doc, pageNum, totalPages) {
  doc.strokeColor(NAVY_SOFT)
     .lineWidth(0.5)
     .moveTo(MARGIN_X, PAGE_H - 47)
     .lineTo(PAGE_W - MARGIN_X, PAGE_H - 47)
     .stroke();

  doc.fillColor(GRAY_500)
     .font('Helvetica').fontSize(7)
     .text('VOLA Benefits  •  1-336-221-7101  •  info@vola-benefits.com  •  vola-benefits.com',
           MARGIN_X, PAGE_H - 37, { lineBreak: false });

  doc.text(`Page ${pageNum} of ${totalPages}`,
           MARGIN_X, PAGE_H - 37,
           { width: PAGE_W - 2 * MARGIN_X, align: 'right', lineBreak: false });

  doc.font('Helvetica-Oblique').fontSize(6)
     .text('Estimates based on SHRM, BLS, KFF, and Premise Health published data. Conservative defaults; your actual figures are typically higher.',
           MARGIN_X, PAGE_H - 24, { lineBreak: false });
}

function drawCard(doc, x, y, w, h, fill, border) {
  doc.save();
  doc.roundedRect(x, y, w, h, 8)
     .fillColor(fill)
     .strokeColor(border || NAVY_CARD)
     .lineWidth(0.6)
     .fillAndStroke();
  doc.restore();
}

// -----------------------------------------------------------------------------
// PAGE BUILDERS
// -----------------------------------------------------------------------------
function pageCover(doc, industryData, headcount, setup, r, today) {
  drawPageBg(doc);
  drawHeader(doc, 'Confidential Audit');

  let y = 100;

  // Eyebrow
  doc.fillColor(TEAL)
     .font('Helvetica-Bold').fontSize(8)
     .text('PREPARED FOR YOUR BUSINESS  •  ' + today.toUpperCase(),
           MARGIN_X, y, { lineBreak: false });

  // Title
  y += 36;
  doc.fillColor(WHITE)
     .font('Helvetica-Bold').fontSize(26)
     .text('Your Benefits Gap', MARGIN_X, y, { lineBreak: false });

  y += 34;
  doc.fillColor(TEAL)
     .font('Helvetica-BoldOblique').fontSize(26)
     .text('Audit Report', MARGIN_X, y, { lineBreak: false });

  // Subhead
  y += 50;
  const sub =
    `A snapshot of what your current benefits setup is costing you every year — ` +
    `and what redirecting that into a Direct Primary Care plan would look like for a ` +
    `${industryData.label} business with ${headcount} employees.`;
  doc.fillColor(GRAY_300)
     .font('Helvetica').fontSize(11)
     .text(sub, MARGIN_X, y, {
       width: PAGE_W - 2 * MARGIN_X,
       lineGap: 4,
     });
  y = doc.y;

  // Big number card
  y += 24;
  const cardH = 165;
  drawCard(doc, MARGIN_X, y, PAGE_W - 2 * MARGIN_X, cardH, NAVY_BLACK, TEAL);

  // Big $ centered
  doc.fillColor(TEAL)
     .font('Helvetica-Bold').fontSize(54)
     .text(dollars(r.total),
           MARGIN_X, y + 28,
           { width: PAGE_W - 2 * MARGIN_X, align: 'center', lineBreak: false });

  // Caption
  doc.fillColor(GRAY_300)
     .font('Helvetica').fontSize(10)
     .text('ESTIMATED ANNUAL HIDDEN COST OF YOUR CURRENT BENEFITS GAP',
           MARGIN_X, y + 95,
           { width: PAGE_W - 2 * MARGIN_X, align: 'center', characterSpacing: 1, lineBreak: false });

  // Three stat columns
  const stats = [
    ['HEADCOUNT', String(headcount)],
    ['INDUSTRY',  industryData.label],
    ['SETUP',     SETUP_LABELS[setup] || setup],
  ];
  const colW = (PAGE_W - 2 * MARGIN_X) / 3;
  const statTop = y + 122;
  stats.forEach(([label, value], i) => {
    const cx = MARGIN_X + i * colW;
    doc.fillColor(GRAY_500)
       .font('Helvetica-Bold').fontSize(7)
       .text(label, cx, statTop, { width: colW, align: 'center', characterSpacing: 0.5, lineBreak: false });
    doc.fillColor(WHITE)
       .font('Helvetica-Bold').fontSize(11)
       .text(value, cx, statTop + 14, { width: colW, align: 'center', lineBreak: false });
  });

  // Tagline
  y += cardH + 36;
  doc.fillColor(WHITE)
     .font('Helvetica-Oblique').fontSize(11)
     .text('Your Choice.  Your Coverage.  Your Life.',
           MARGIN_X, y,
           { width: PAGE_W - 2 * MARGIN_X, align: 'center', lineBreak: false });

  drawFooter(doc, 1, 4);
}

function pageBreakdown(doc, industryData, headcount, setup, turnover, r) {
  drawPageBg(doc);
  drawHeader(doc, 'How It Adds Up');

  let y = 90;
  doc.fillColor(TEAL)
     .font('Helvetica-Bold').fontSize(8)
     .text('THE BREAKDOWN', MARGIN_X, y, { lineBreak: false });

  y += 28;
  doc.fillColor(WHITE)
     .font('Helvetica-Bold').fontSize(20)
     .text('Where the cost is hiding.', MARGIN_X, y, { lineBreak: false });

  y += 30;
  doc.fillColor(GRAY_300)
     .font('Helvetica').fontSize(10)
     .text("Most of these numbers don't show up on a P&L. They show up everywhere else.",
           MARGIN_X, y, { lineBreak: false });

  y += 38;
  const rows = [
    ['Turnover replacement cost',
     `${turnover} employees × ${dollars(industryData.replacement_cost)} per replacement`,
     dollars(r.turnoverCost)],
    ["Vacancies you can't fill",
     'Open-role productivity loss + recruiting time',
     dollars(r.vacancyCost)],
    ['Sick days from untreated issues',
     `${headcount} employees × industry-average lost productivity`,
     dollars(r.sickCost)],
    ['Missed Section 125 / FICA savings',
     `${headcount} employees × 7.65% on pre-tax contributions`,
     dollars(r.ficaCost)],
  ];
  if (r.wcCost > 0) {
    rows.push(["Workers' comp claim escalation",
               'Untreated minor injuries that grow into claims',
               dollars(r.wcCost)]);
  }

  const rowH = 44;
  rows.forEach(([label, sub, val]) => {
    drawCard(doc, MARGIN_X, y, PAGE_W - 2 * MARGIN_X, rowH - 6, NAVY_SOFT);
    doc.fillColor(WHITE)
       .font('Helvetica-Bold').fontSize(11)
       .text(label, MARGIN_X + 14, y + 9, { lineBreak: false });
    doc.fillColor(GRAY_400)
       .font('Helvetica').fontSize(8.5)
       .text(sub, MARGIN_X + 14, y + 24, { lineBreak: false });
    doc.fillColor(TEAL)
       .font('Helvetica-Bold').fontSize(16)
       .text(val, MARGIN_X, y + 13,
             { width: PAGE_W - 2 * MARGIN_X - 14, align: 'right', lineBreak: false });
    y += rowH;
  });

  // Total
  y += 6;
  const totalH = 56;
  drawCard(doc, MARGIN_X, y, PAGE_W - 2 * MARGIN_X, totalH, NAVY_BLACK, TEAL);
  doc.fillColor(WHITE)
     .font('Helvetica-Bold').fontSize(12)
     .text('ESTIMATED ANNUAL HIDDEN COST', MARGIN_X + 14, y + 14,
           { characterSpacing: 0.5, lineBreak: false });
  doc.fillColor(TEAL)
     .font('Helvetica-Bold').fontSize(22)
     .text(dollars(r.total), MARGIN_X, y + 14,
           { width: PAGE_W - 2 * MARGIN_X - 14, align: 'right', lineBreak: false });
  doc.fillColor(GRAY_400)
     .font('Helvetica-Oblique').fontSize(8)
     .text('Sum of line items above — conservative estimate.',
           MARGIN_X + 14, y + 36, { lineBreak: false });

  drawFooter(doc, 2, 4);
}

function pageComparison(doc, industryData, headcount, r) {
  drawPageBg(doc);
  drawHeader(doc, 'The Comparison');

  let y = 90;
  doc.fillColor(TEAL)
     .font('Helvetica-Bold').fontSize(8)
     .text('DOING NOTHING vs. DPC PLAN', MARGIN_X, y, { lineBreak: false });

  y += 28;
  doc.fillColor(WHITE)
     .font('Helvetica-Bold').fontSize(20)
     .text("The math isn't theoretical.", MARGIN_X, y, { lineBreak: false });

  y += 30;
  doc.fillColor(GRAY_300)
     .font('Helvetica').fontSize(10)
     .text('Side-by-side: what the gap is costing vs. what a comparable plan investment would be.',
           MARGIN_X, y, { lineBreak: false });

  // Two cards side by side
  y += 38;
  const cardH = 175;
  const gap = 18;
  const cardW = (PAGE_W - 2 * MARGIN_X - gap) / 2;

  // Left — Doing Nothing
  drawCard(doc, MARGIN_X, y, cardW, cardH, NAVY_SOFT);
  doc.fillColor(GRAY_400)
     .font('Helvetica-Bold').fontSize(8)
     .text('DOING NOTHING', MARGIN_X + 14, y + 14, { characterSpacing: 0.5, lineBreak: false });
  doc.fillColor(WHITE)
     .font('Helvetica-Bold').fontSize(32)
     .text(dollars(r.total), MARGIN_X + 14, y + 50, { lineBreak: false });
  doc.fillColor(GRAY_300)
     .font('Helvetica').fontSize(9)
     .text('Quietly bleeding off the bottom line every year — and getting worse, not better.',
           MARGIN_X + 14, y + 100,
           { width: cardW - 28, lineGap: 3 });

  // Right — VOLA DPC
  const rx = MARGIN_X + cardW + gap;
  drawCard(doc, rx, y, cardW, cardH, TEAL_DARK, TEAL);
  doc.fillColor(TEAL)
     .font('Helvetica-Bold').fontSize(8)
     .text('A VOLA DPC PLAN', rx + 14, y + 14, { characterSpacing: 0.5, lineBreak: false });
  doc.fillColor(TEAL)
     .font('Helvetica-Bold').fontSize(32)
     .text(dollars(r.dpc), rx + 14, y + 50, { lineBreak: false });
  doc.fillColor(GRAY_300)
     .font('Helvetica').fontSize(9)
     .text(`Typical employer investment for ${headcount} employees — DPC + Rx Valet + critical illness protection included.`,
           rx + 14, y + 100,
           { width: cardW - 28, lineGap: 3 });

  y += cardH + 22;

  // Savings bar (if positive)
  if (r.savings > 0) {
    const swingH = 60;
    drawCard(doc, MARGIN_X, y, PAGE_W - 2 * MARGIN_X, swingH, TEAL_DARK, TEAL);
    doc.fillColor(TEAL)
       .font('Helvetica-Bold').fontSize(8)
       .text('YOUR POTENTIAL ANNUAL SWING', MARGIN_X + 14, y + 12,
             { characterSpacing: 0.5, lineBreak: false });
    doc.fillColor(WHITE)
       .font('Helvetica-Bold').fontSize(22)
       .text(dollars(r.savings), MARGIN_X + 14, y + 26, { lineBreak: false });
    doc.fillColor(GRAY_300)
       .font('Helvetica').fontSize(9)
       .text('Redirected from waste into benefits your team actually uses.',
             MARGIN_X, y + 33,
             { width: PAGE_W - 2 * MARGIN_X - 14, align: 'right', lineBreak: false });
    y += swingH + 18;
  }

  // Industry context
  const ctxH = 120;
  drawCard(doc, MARGIN_X, y, PAGE_W - 2 * MARGIN_X, ctxH, NAVY_SOFT);
  doc.fillColor(TEAL)
     .font('Helvetica-Bold').fontSize(8)
     .text(`WHY THIS HITS YOUR INDUSTRY HARDER  •  ${industryData.label.toUpperCase()}`,
           MARGIN_X + 14, y + 14, { characterSpacing: 0.5, lineBreak: false });

  doc.fillColor(WHITE)
     .font('Helvetica').fontSize(10)
     .text(industryData.top_pain,
           MARGIN_X + 14, y + 34,
           { width: PAGE_W - 2 * MARGIN_X - 28, lineGap: 3 });

  doc.fillColor(GRAY_300)
     .font('Helvetica-Oblique').fontSize(9)
     .text(industryData.benchmark_note,
           MARGIN_X + 14, y + 78,
           { width: PAGE_W - 2 * MARGIN_X - 28, lineGap: 2 });

  drawFooter(doc, 3, 4);
}

function pageNextSteps(doc, calendarUrl) {
  drawPageBg(doc);
  drawHeader(doc, 'Next Steps');

  let y = 90;
  doc.fillColor(TEAL)
     .font('Helvetica-Bold').fontSize(8)
     .text('WHAT TO DO WITH THIS', MARGIN_X, y, { lineBreak: false });

  y += 28;
  doc.fillColor(WHITE)
     .font('Helvetica-Bold').fontSize(20)
     .text('Three decisions, not thirty.', MARGIN_X, y, { lineBreak: false });

  y += 42;
  const steps = [
    ['01', 'Decide your contribution.',
     "A typical small employer share is $100/employee/month — but it's your call. We model what you choose."],
    ['02', 'Pick your benefits stack.',
     'MyDPCplus (everyday care), Rx Valet (prescriptions), critical illness, plus optional dental, vision, disability, life.'],
    ['03', 'Pick a start date.',
     'VOLA handles communication, enrollment, and ongoing service. You handle picking the date.'],
  ];
  const stepH = 60;
  steps.forEach(([num, title, body]) => {
    drawCard(doc, MARGIN_X, y, PAGE_W - 2 * MARGIN_X, stepH - 4, NAVY_SOFT);
    doc.fillColor(TEAL)
       .font('Helvetica-Bold').fontSize(22)
       .text(num, MARGIN_X + 18, y + 18, { lineBreak: false });
    doc.fillColor(WHITE)
       .font('Helvetica-Bold').fontSize(12)
       .text(title, MARGIN_X + 64, y + 12, { lineBreak: false });
    doc.fillColor(GRAY_300)
       .font('Helvetica').fontSize(9.5)
       .text(body, MARGIN_X + 64, y + 28,
             { width: PAGE_W - 2 * MARGIN_X - 78, lineGap: 2 });
    y += stepH + 8;
  });

  // CTA card
  y += 6;
  const ctaH = 122;
  drawCard(doc, MARGIN_X, y, PAGE_W - 2 * MARGIN_X, ctaH, TEAL_DARK, TEAL);

  doc.fillColor(WHITE)
     .font('Helvetica-Bold').fontSize(16)
     .text('Ready to walk through your numbers?',
           MARGIN_X + 18, y + 18, { lineBreak: false });

  doc.fillColor(GRAY_300)
     .font('Helvetica').fontSize(10)
     .text('A 20-minute walkthrough — we map your contribution, your benefits stack, and a realistic start date. No pressure to commit.',
           MARGIN_X + 18, y + 42,
           { width: PAGE_W - 2 * MARGIN_X - 36, lineGap: 3 });

  // Booking link (text + vector arrow)
  const linkText = 'Book a 20-minute walkthrough';
  const linkY = y + 84;
  doc.fillColor(TEAL)
     .font('Helvetica-Bold').fontSize(12);
  const linkW = doc.widthOfString(linkText);
  doc.text(linkText, MARGIN_X + 18, linkY, {
    lineBreak: false,
    width: linkW + 2,
    link: calendarUrl,
    underline: false,
  });
  // Draw an arrow glyph after the text
  const arrowX = MARGIN_X + 18 + linkW + 8;
  const arrowY = linkY + 6;
  doc.save()
     .strokeColor(TEAL).lineWidth(1.6).lineCap('round').lineJoin('round')
     .moveTo(arrowX,     arrowY)
     .lineTo(arrowX + 10, arrowY)
     .moveTo(arrowX + 6, arrowY - 4)
     .lineTo(arrowX + 10, arrowY)
     .lineTo(arrowX + 6, arrowY + 4)
     .stroke()
     .restore();

  doc.fillColor(GRAY_400)
     .font('Helvetica').fontSize(9)
     .text('Or call us directly: 1-336-221-7101  •  info@vola-benefits.com',
           MARGIN_X + 18, y + 104, { lineBreak: false });

  // Signature
  y += ctaH + 16;
  doc.fillColor(GRAY_400)
     .font('Helvetica-Oblique').fontSize(9)
     .text('Prepared by Gregory Meyer  •  Managing Partner, VOLA Benefits',
           MARGIN_X, y, { lineBreak: false });

  drawFooter(doc, 4, 4);
}

// -----------------------------------------------------------------------------
// PUBLIC API
// -----------------------------------------------------------------------------
function generateReport({ industry, headcount, setup, turnover,
                          calendarUrl = 'https://vola.zohobookings.com/#/4052706000000281038' }) {
  const industryData = INDUSTRY_DATA[industry] || INDUSTRY_DATA.other;
  const r = calculate(industry, headcount, setup, turnover);
  const today = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margin: 0,
      info: {
        Title:    'VOLA Benefits Gap Audit Report',
        Author:   'VOLA Benefits',
        Subject:  `Annual Benefits Audit for ${industryData.label}`,
        Creator:  'VOLA Benefits',
      },
    });

    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    pageCover(doc, industryData, headcount, setup, r, today);
    doc.addPage({ size: 'LETTER', margin: 0 });
    pageBreakdown(doc, industryData, headcount, setup, turnover, r);
    doc.addPage({ size: 'LETTER', margin: 0 });
    pageComparison(doc, industryData, headcount, r);
    doc.addPage({ size: 'LETTER', margin: 0 });
    pageNextSteps(doc, calendarUrl);

    doc.end();
  });
}

module.exports = { generateReport, calculate, INDUSTRY_DATA, SETUP_LABELS, dollars };

// -----------------------------------------------------------------------------
// CLI test
// -----------------------------------------------------------------------------
if (require.main === module) {
  const fs = require('fs');
  generateReport({ industry: 'trades', headcount: 18, setup: 'nothing', turnover: 4 })
    .then((buf) => {
      fs.writeFileSync('test_audit_report.pdf', buf);
      console.log(`Wrote test_audit_report.pdf (${buf.length.toLocaleString()} bytes)`);
    })
    .catch((err) => {
      console.error('Error:', err);
      process.exit(1);
    });
}

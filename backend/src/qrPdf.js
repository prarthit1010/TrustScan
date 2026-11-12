const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const { scanUrl } = require('./scanUrl');

// All layout is in millimetres and converted to PDF points (1 pt = 1/72 inch) so cards print at exact size at 100% scale
const MM = 72 / 25.4;

// A4 portrait: 210 x 297 mm
const PAGE_W = 210;
const PAGE_H = 297;

// 3" x 1.5" cards, 2 columns x 7 rows = 14 per page, 0.2 mm gap between cards
const CARD_W = 76.2;
const CARD_H = 38.1;
const GAP = 0.2;
const COLS = 2;
const ROWS = 7;
const PER_PAGE = COLS * ROWS;

// Grid is centred on the page: 152.6 x 267.9 mm, leaving 28.7 mm left/right and 14.55 mm top/bottom for printer margins
const GRID_W = COLS * CARD_W + (COLS - 1) * GAP;
const GRID_H = ROWS * CARD_H + (ROWS - 1) * GAP;
const ORIGIN_X = (PAGE_W - GRID_W) / 2;
const ORIGIN_Y = (PAGE_H - GRID_H) / 2;

const PAD = 2.5; // space between the left cut line and the QR box
const TOP = 1.5; // space above the QR box (its quiet zone adds more white on top)
const ID_FONT = 12; // pt, printed ID under the QR
const ID_H = 5; // mm reserved under the QR for the ID
const QR_BOX = CARD_H - TOP - ID_H - 1.5; // square QR area (includes its quiet zone)
const QUIET = 4; // quiet zone in modules, as required by the QR spec
const CUT_LINE = 0.25; // pt

// Vector QR drawn into a square box with a QUIET-module white border on every side.
// One filled rect per run of dark modules, slightly overlapped so no hairline seams show when printed.
function drawQr(doc, text, x, y, size) {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const cell = size / (modules.size + 2 * QUIET);
  const ox = x + QUIET * cell;
  const oy = y + QUIET * cell;
  for (let row = 0; row < modules.size; row++) {
    let col = 0;
    while (col < modules.size) {
      if (!modules.get(row, col)) { col++; continue; }
      const start = col;
      while (col < modules.size && modules.get(row, col)) col++;
      doc.rect(ox + start * cell, oy + row * cell, (col - start) * cell + 0.05, cell + 0.05);
    }
  }
  doc.fillColor('#000000').fill();
}

function drawCard(doc, qr, xMm, yMm) {
  const x = xMm * MM;
  const y = yMm * MM;
  const w = CARD_W * MM;
  const h = CARD_H * MM;

  // Vector cutting line around the card
  doc.save().lineWidth(CUT_LINE).strokeColor('#9ca3af').rect(x, y, w, h).stroke().restore();

  // QR: square, never stretched, on the left
  const qrX = x + PAD * MM;
  const qrY = y + TOP * MM;
  const qrSize = QR_BOX * MM;
  drawQr(doc, scanUrl(qr.code), qrX, qrY, qrSize);

  // Printed ID centred under the QR so each physical card can be matched to its record
  doc.font('Courier-Bold').fontSize(ID_FONT).fillColor('#000000')
    .text(qr.display_id, qrX, qrY + qrSize + 0.3 * MM, { width: qrSize, align: 'center', lineBreak: false });
}

// Streams a print-ready A4 portrait PDF: 14 cards (3" x 1.5") per page, as many pages as needed
function writeLabelsPdf(stream, codes, batch) {
  const doc = new PDFDocument({ size: [PAGE_W * MM, PAGE_H * MM], margin: 0, autoFirstPage: false,
    info: { Title: `${batch.product_name} – QR codes`, Author: 'TrustScan' } });
  doc.pipe(stream);

  codes.forEach((qr, i) => {
    if (i % PER_PAGE === 0) doc.addPage();
    const slot = i % PER_PAGE;
    const col = slot % COLS;
    const row = Math.floor(slot / COLS);
    drawCard(doc, qr, ORIGIN_X + col * (CARD_W + GAP), ORIGIN_Y + row * (CARD_H + GAP));
  });
  doc.end();
}

module.exports = { writeLabelsPdf };

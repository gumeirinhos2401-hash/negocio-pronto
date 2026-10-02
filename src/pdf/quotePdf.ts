import type { jsPDF } from 'jspdf';
import { formatEuros } from '../domain/money';
import { formatQuoteDate, QUOTE_FOOTER, quoteTotal, VAT_NOTE_TEXT } from '../domain/quotes';
import type { BusinessProfile, Quote } from '../domain/types';
import { isHttpUrl } from '../domain/validation';

// A4 in millimetres.
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 20;
const RIGHT = PAGE_WIDTH - MARGIN;
const BOTTOM = PAGE_HEIGHT - MARGIN;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
const PRICE_COLUMN = 35;
const TILE = 12;

const INK = '#18202B';
const STONE = '#56606B';
const RULE = '#D9DCD8';
const WHITE = '#FFFFFF';
const DEFAULT_ACCENT = '#1B4DB1';
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

const POINT_TO_MM = 0.3528;

// The built-in PDF fonts have no non-breaking spaces, which Intl puts before "€".
const plain = (text: string) => text.replace(/[   ]/g, ' ').replace(/\t/g, ' ');

interface TextStyle { size?: number; bold?: boolean; color?: string; width?: number; gapAfter?: number }

export async function buildQuotePdf(q: Quote, business: BusinessProfile): Promise<jsPDF> {
  // Loaded on demand so the PDF library stays out of the main bundle.
  const { jsPDF: JsPdf } = await import('jspdf');
  const doc = new JsPdf({ unit: 'mm', format: 'a4' });
  const accent = HEX_COLOR.test(business.accentColor) ? business.accentColor : DEFAULT_ACCENT;
  let y = 0;

  const ensureRoom = (height: number) => {
    if (y + height > BOTTOM) {
      doc.addPage();
      y = MARGIN;
    }
  };

  const fill = (color: string, x: number, top: number, width: number, height: number) => {
    doc.setFillColor(color);
    doc.rect(x, top, width, height, 'F');
  };

  const rule = (color: string, thickness: number) => {
    ensureRoom(thickness + 4);
    fill(color, MARGIN, y, CONTENT_WIDTH, thickness);
    y += thickness;
  };

  const setStyle = ({ size = 10, bold = false, color = INK }: TextStyle) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(color);
    return size * POINT_TO_MM * 1.45;       // line height in mm
  };

  // Writes wrapped text at the left margin and moves down, breaking the page when needed.
  const write = (text: string, style: TextStyle = {}) => {
    const lineHeight = setStyle(style);
    for (const paragraph of plain(text).split(/\r?\n/)) {
      const lines: string[] = paragraph.trim() ? doc.splitTextToSize(paragraph, style.width ?? CONTENT_WIDTH) : [''];
      for (const line of lines) {
        ensureRoom(lineHeight);
        y += lineHeight;
        if (line) doc.text(line, MARGIN, y);
      }
    }
    y += style.gapAfter ?? 0;
  };

  const writeRight = (text: string, baseline: number, style: TextStyle) => {
    setStyle(style);
    doc.text(plain(text), RIGHT, baseline, { align: 'right' });
  };

  // Tile band: a row of squares in the business color, echoing the band on screen.
  fill(accent, 0, 0, PAGE_WIDTH, TILE);
  for (let x = 0; x < PAGE_WIDTH; x += TILE) {
    fill(WHITE, x + 2.5, 2.5, TILE - 5, TILE - 5);
    fill(accent, x + 4.5, 4.5, TILE - 9, TILE - 9);
  }

  // Header: the business on the left, the document title on the right.
  const top = TILE + 10;
  writeRight('Orçamento', top + 7, { size: 18, bold: true });
  writeRight(`N.º ${q.number}`, top + 13, { size: 10, color: STONE });
  const date = formatQuoteDate(q.createdAt);
  if (date) writeRight(date, top + 18, { size: 10, color: STONE });

  y = top;
  const headerWidth = CONTENT_WIDTH - 60;
  const name = business.name.trim();
  if (name) write(name, { size: 15, bold: true, width: headerWidth, gapAfter: 1 });
  const website = business.website.trim();
  const contactLines = [
    [business.address.trim(), business.city.trim()].filter(Boolean).join(', '),
    business.phone.trim(),
    business.email.trim(),
    isHttpUrl(website) ? website : '',
  ].filter(Boolean);
  for (const line of contactLines) write(line, { size: 9.5, color: STONE, width: headerWidth });
  y = Math.max(y, top + 20) + 6;

  fill(accent, MARGIN, y, CONTENT_WIDTH, 0.8);
  y += 0.8 + 4;

  if (q.isExample) write('Documento de exemplo, com dados fictícios.', { size: 9.5, color: STONE, gapAfter: 2 });

  write('Cliente', { size: 9.5, color: STONE });
  write(q.clientName.trim(), { size: 12, bold: true, gapAfter: 8 });

  // Items.
  const tableHeaderHeight = setStyle({ size: 9.5, color: STONE });
  ensureRoom(tableHeaderHeight + 12);
  y += tableHeaderHeight;
  doc.text('Descrição', MARGIN, y);
  doc.text('Preço', RIGHT, y, { align: 'right' });
  y += 2;
  rule(INK, 0.3);

  for (const item of q.items) {
    y += 1.5;
    const lineHeight = setStyle({ size: 10.5 });
    const lines: string[] = doc.splitTextToSize(plain(item.description.trim()), CONTENT_WIDTH - PRICE_COLUMN);
    lines.forEach((line, index) => {
      ensureRoom(lineHeight);
      y += lineHeight;
      doc.text(line, MARGIN, y);
      if (index === 0) doc.text(plain(formatEuros(item.priceCents)), RIGHT, y, { align: 'right' });
    });
    y += 2.5;
    rule(RULE, 0.2);
  }

  const totalHeight = setStyle({ size: 13, bold: true });
  ensureRoom(totalHeight + 6);
  y += totalHeight + 3;
  doc.text('Total', RIGHT - 70, y);
  doc.text(plain(formatEuros(quoteTotal(q))), RIGHT, y, { align: 'right' });
  y += 2;

  const vat = VAT_NOTE_TEXT[q.vatNote];
  if (vat) {
    const vatHeight = setStyle({ size: 9.5, color: STONE });
    ensureRoom(vatHeight);
    y += vatHeight;
    doc.text(vat, RIGHT, y, { align: 'right' });
  }
  y += 8;

  if (q.deadline.trim()) {
    write('Prazo', { size: 9.5, color: STONE });
    write(q.deadline.trim(), { size: 10.5, gapAfter: 5 });
  }
  if (q.notes.trim()) {
    write('Observações', { size: 9.5, color: STONE });
    write(q.notes.trim(), { size: 10.5, gapAfter: 5 });
  }

  y += 4;
  rule(RULE, 0.2);
  y += 1;
  write(QUOTE_FOOTER, { size: 9, color: STONE });

  return doc;
}

export async function downloadQuotePdf(q: Quote, business: BusinessProfile): Promise<void> {
  const doc = await buildQuotePdf(q, business);
  // The number is the only user-related part of the file name; keep it to safe characters.
  const number = q.number.replace(/[^0-9A-Za-z-]/g, '') || 'sem-numero';
  doc.save(`orcamento-${number}.pdf`);
}

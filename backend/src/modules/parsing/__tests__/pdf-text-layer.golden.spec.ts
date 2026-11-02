/// <reference types="vitest/globals" />

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { extractTextAndLayoutFromPdf } from '../../../common/utils/pdf-parser.util';

/** A one-page PDF drawing `content` with Helvetica as /F1, offsets computed. */
function buildPdf(content: string): Buffer {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets = objects.map((object, index) => {
    const offset = Buffer.byteLength(body);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}

const text = (x: number, y: number, size: number, words: string) =>
  `BT /F1 ${size} Tf ${x} ${y} Td (${words}) Tj ET`;

/** The page's own text layer, as the parsers read it: what a reader sees, not what an editor painted over. */
describe('PDF text layer', () => {
  let dir: string;
  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-text-layer-'));
  });
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  const read = async (content: string) => {
    const file = path.join(dir, `${Math.random().toString(36).slice(2)}.pdf`);
    fs.writeFileSync(file, buildPdf(content));
    return extractTextAndLayoutFromPdf(file);
  };

  it('leaves out text a white fill drawn after it covers, and keeps what is drawn on top', async () => {
    const { text: page, rows } = await read(
      [
        text(40, 200, 10, '19 Jun OPENING BALANCE'),
        '1 1 1 rg 35 195 200 16 re f',
        '0 0 0 rg',
        text(40, 200, 10, '19 Jan OPENING BALANCE'),
        // A white background drawn before its text hides nothing.
        '1 1 1 rg 35 145 200 16 re f',
        '0 0 0 rg',
        text(40, 150, 10, 'Closing Balance'),
      ].join('\n'),
    );
    expect(page).toContain('19 Jan OPENING BALANCE');
    expect(page).not.toContain('Jun');
    expect(page).toContain('Closing Balance');
    expect(rows.map(row => row.text)).toEqual(
      expect.arrayContaining(['19 Jan OPENING BALANCE', 'Closing Balance']),
    );
  });

  it('leaves out tiny text set over text at least twice its size', async () => {
    const { text: page } = await read(
      [text(40, 200, 10, '01 Feb Transfer'), text(41, 201, 3.75, '01 Jul')].join('\n'),
    );
    expect(page).toContain('01 Feb Transfer');
    expect(page).not.toContain('Jul');
  });

  it('keeps small print that stands on its own', async () => {
    const { text: page } = await read(
      [text(40, 200, 10, 'Balance'), text(40, 100, 4, 'Terms apply')].join('\n'),
    );
    expect(page).toContain('Terms apply');
  });
});

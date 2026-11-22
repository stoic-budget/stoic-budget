import * as fs from 'fs';
import type { Transaction } from '../../../entities/transaction.entity';
import { loadPdfMake } from '../report-document.util';
import {
  buildWorkspaceSummaryRows,
  formatWorkspaceAmount,
  mapWorkspaceTransactionRows,
} from './workspace-export-rows.util';

export async function generateWorkspacePdf(
  transactions: Transaction[],
  filePath: string,
): Promise<void> {
  const rows = mapWorkspaceTransactionRows(transactions);
  const summaryRows = buildWorkspaceSummaryRows(rows);
  const pdfMake = await loadPdfMake();

  const docDefinition = {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [20, 24, 20, 24],
    content: [
      { text: 'Отчет по транзакциям workspace', style: 'title' },
      {
        columns: summaryRows.map(row => ({
          stack: [
            { text: String(row.Показатель), style: 'summaryLabel' },
            { text: String(row.Значение), style: 'summaryValue' },
          ],
        })),
        columnGap: 12,
        margin: [0, 0, 0, 16],
      },
      {
        table: {
          headerRows: 1,
          widths: [24, 56, 50, '*', 64, 80],
          body: [
            ['№', 'Дата', 'Тип', 'Контрагент', 'Сумма', 'Категория'],
            ...rows.map(row => [
              String(row.index),
              row.transactionDate,
              row.transactionType,
              row.counterpartyName,
              formatWorkspaceAmount(row.amount),
              row.category,
            ]),
          ],
        },
        layout: 'lightHorizontalLines',
      },
    ],
    styles: {
      title: { bold: true, fontSize: 16, margin: [0, 0, 0, 12] },
      summaryLabel: { fontSize: 9, color: '#6b7280' },
      summaryValue: { fontSize: 11, bold: true },
    },
    defaultStyle: {
      font: 'Roboto',
      fontSize: 8,
    },
  };

  await new Promise<void>(resolve => {
    pdfMake.createPdf(docDefinition).getBuffer((buffer: Uint8Array) => {
      fs.writeFileSync(filePath, Buffer.from(buffer));
      resolve();
    });
  });
}

export async function generateWorkspaceDocx(
  transactions: Transaction[],
  filePath: string,
): Promise<void> {
  const rows = mapWorkspaceTransactionRows(transactions);
  const summaryRows = buildWorkspaceSummaryRows(rows);
  const docxModule = await import('docx');
  const {
    Document,
    HeadingLevel,
    Packer,
    Paragraph,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
  } = docxModule;

  const createCell = (text: string, bold = false) =>
    new TableCell({
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text,
              bold,
              size: 18,
            }),
          ],
        }),
      ],
    });

  const summaryParagraph = new Paragraph({
    children: summaryRows.flatMap((row, index) => {
      const parts = [
        new TextRun({ text: `${row.Показатель}: `, bold: true, size: 20 }),
        new TextRun({ text: String(row.Значение), size: 20 }),
      ];

      if (index < summaryRows.length - 1) {
        parts.push(new TextRun({ text: '   ', size: 20 }));
      }

      return parts;
    }),
    spacing: { after: 240 },
  });

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          createCell('№', true),
          createCell('Дата', true),
          createCell('Тип', true),
          createCell('Контрагент', true),
          createCell('Сумма', true),
          createCell('Категория', true),
        ],
      }),
      ...rows.map(
        row =>
          new TableRow({
            children: [
              createCell(String(row.index)),
              createCell(row.transactionDate),
              createCell(row.transactionType),
              createCell(row.counterpartyName),
              createCell(formatWorkspaceAmount(row.amount)),
              createCell(row.category),
            ],
          }),
      ),
    ],
  });

  const document = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: 'landscape',
            },
          },
        },
        children: [
          new Paragraph({
            text: 'Отчет по транзакциям workspace',
            heading: HeadingLevel.HEADING_1,
          }),
          summaryParagraph,
          table,
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(document);
  fs.writeFileSync(filePath, buffer);
}

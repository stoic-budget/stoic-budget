import { describe, expect, it } from 'vitest';
import type { ReceiptDocument, Transaction } from '../types/statement-types';
import { keepConfirmed } from './confirmed-analytics';

const transaction = (id: string, isVerified?: boolean): Transaction => ({ id, isVerified });
const receipt = (id: string, status: string): ReceiptDocument =>
  (({
    id,
    status,
    subject: id,
    sender: 's',
    receivedAt: '2026-09-01'
  }) as ReceiptDocument);

describe('keepConfirmed', () => {
  it('keeps only confirmed transactions and approved receipts', () => {
    const result = keepConfirmed({
      transactions: [transaction('ok', true), transaction('open', false), transaction('old')],
      receipts: [receipt('approved', 'approved'), receipt('draft', 'draft'), receipt('nr', 'needs_review')],
    });

    expect(result.transactions.map(item => item.id)).toEqual(['ok']);
    expect(result.receipts.map(item => item.id)).toEqual(['approved']);
  });

  it('leaves out a row the bank still holds, even an approved one', () => {
    const result = keepConfirmed({
      transactions: [{ id: 'held', isVerified: true, isPending: true }, transaction('booked', true)],
      receipts: [],
    });

    expect(result.transactions.map(item => item.id)).toEqual(['booked']);
  });

  it('leaves out what is no income or spending, as the tiles beside the tables do', () => {
    const result = keepConfirmed({
      transactions: [
        transaction('purchase', true),
        { id: 'to-savings', isVerified: true, transferPairId: 'pair-1' },
        { id: 'from-main', isVerified: true, transferPairId: 'pair-1' },
        { id: 'car', isVerified: true, excludedFromBudgets: true },
        { id: 'swap', isVerified: true, cryptoWalletId: 'wallet-1' },
      ],
      receipts: [],
    });

    expect(result.transactions.map(item => item.id)).toEqual(['purchase']);
  });

  it("keeps a receipt out with its row: a reimbursed lunch's receipt is no spending either", () => {
    const result = keepConfirmed({
      transactions: [{ id: 'lunch', isVerified: true, transferPairId: 'pair-reimb' }],
      receipts: [{ ...receipt('rc-lunch', 'approved'), transactionId: 'lunch' }],
    });

    expect(result.receipts).toEqual([]);
  });
});

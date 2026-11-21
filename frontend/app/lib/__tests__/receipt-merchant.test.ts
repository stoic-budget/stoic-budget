import { describe, expect, it } from 'vitest';

import { resolveReceiptMerchantLabel } from '@/app/lib/receipt-merchant';

describe('resolveReceiptMerchantLabel', () => {
  it('uses parsed vendor when it is a short brand-like value', () => {
    const label = resolveReceiptMerchantLabel({
      vendor: 'GitHub',
      sender: 'GitHub <noreply@github.com>',
      subject: '[GitHub] Receipt',
    });

    expect(label).toBe('GitHub');
  });

  it('prefers sender brand when vendor is long descriptive sentence', () => {
    const label = resolveReceiptMerchantLabel({
      vendor:
        'We received payment for your sponsorship. Thanks for your support of Open Source Software!',
      sender: 'GitHub <noreply@github.com>',
      subject: '[GitHub] Payment receipt',
    });

    expect(label).toBe('GitHub');
  });

  it('strips support suffix from sender display name', () => {
    const label = resolveReceiptMerchantLabel({
      sender: 'Bitwage Support <support@bitwage.com>',
    });

    expect(label).toBe('Bitwage');
  });

  it('extracts brand from sender domain when sender has no display name', () => {
    const label = resolveReceiptMerchantLabel({
      sender: '<billing@lidl.com>',
    });

    expect(label).toBe('Lidl');
  });

  it('does not return generic page marker text', () => {
    const label = resolveReceiptMerchantLabel({
      vendor: 'Page 1 of 1',
      sender: 'GitHub <noreply@github.com>',
      subject: 'Payment receipt',
    });

    expect(label).toBe('GitHub');
  });

  it('rejects date-like vendor values and falls back to sender', () => {
    const label = resolveReceiptMerchantLabel({
      vendor: 'Date2026-02-16 10:57AM PST',
      sender: 'GitHub <noreply@github.com>',
      subject: 'Payment receipt',
    });

    expect(label).toBe('GitHub');
  });

  it('rejects timestamp vendor values', () => {
    const label = resolveReceiptMerchantLabel({
      vendor: '2026-02-16 10:57',
      sender: 'Spotify <no-reply@spotify.com>',
    });

    expect(label).toBe('Spotify');
  });

  it('rejects amount-like vendor values', () => {
    const label = resolveReceiptMerchantLabel({
      vendor: '$49.99',
      sender: 'Adobe <mail@adobe.com>',
    });

    expect(label).toBe('Adobe');
  });

  it('rejects email-like vendor values', () => {
    const label = resolveReceiptMerchantLabel({
      vendor: 'noreply@github.com',
      sender: 'GitHub <noreply@github.com>',
    });

    expect(label).toBe('GitHub');
  });

  it('keeps the shop from an e-mail subject over a sentence read off the receipt', () => {
    // The documents list passes no sender, so only the subject names the shop here.
    const shop = 'ACME';
    const subject = `[${shop}] Payment receipt`;
    for (const vendor of [
      'Thank you for your order',
      'We received payment for your subscription.',
      '123 Main Street, Springfield, Example State 00000',
    ]) {
      expect(resolveReceiptMerchantLabel({ vendor, subject })).toBe(shop);
      expect(resolveReceiptMerchantLabel({ vendor, sender: '', subject })).toBe(shop);
    }
  });

  describe('a scanned file', () => {
    const fileName = 'photo_2026-01-02_10-00-00.jpg';
    // Six words: long enough to read as a sentence, still the name someone typed.
    const longVendor = 'ACME Case for Tablet Pro Series';

    it('is named by its vendor, not its file name, when the vendor is six words', () => {
      const label = resolveReceiptMerchantLabel({
        vendor: longVendor,
        subject: fileName,
        fallback: fileName,
      });

      expect(label).toBe(longVendor);
    });

    it.each(['camera-scan', 'telegram', 'manual-upload'])(
      'does not take the "%s" sender for the merchant',
      sender => {
        expect(resolveReceiptMerchantLabel({ vendor: longVendor, sender, subject: fileName })).toBe(
          longVendor,
        );
        expect(resolveReceiptMerchantLabel({ sender, subject: fileName })).toBe(fileName);
      },
    );

    it('keeps the whole vendor: the column cuts it where it ends', () => {
      const vendor = 'ACME Leather Folio Case for Tablet Pro Series Twelve Inch';

      expect(resolveReceiptMerchantLabel({ vendor, subject: fileName })).toBe(vendor);
    });

    it('falls back to the whole file name when nothing names the merchant', () => {
      const longFileName = 'photo_2026-01-02_10-00-00_front_page_scan.jpg';

      expect(
        resolveReceiptMerchantLabel({ subject: 'Receipt', fallback: longFileName }),
      ).toBe(longFileName);
    });
  });
});

'use client';

import { useEffect, useState } from 'react';
import type { ReceiptRecord } from '@/app/lib/api';
import { fetchReceiptPreview } from '../receipt-requests';

/** The receipt's file as an object URL, released when the receipt changes or the page closes. */
export function useReceiptPreview(receipt: ReceiptRecord | null) {
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewMimeType, setPreviewMimeType] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!receipt) {
      setPreviewUrl(currentUrl => {
        if (currentUrl) {
          URL.revokeObjectURL(currentUrl);
        }
        return null;
      });
      setPreviewMimeType(null);
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }

    let active = true;
    let objectUrl: string | null = null;

    const revokeAndSet = (nextUrl: string | null) => {
      setPreviewUrl(currentUrl => {
        if (currentUrl) {
          URL.revokeObjectURL(currentUrl);
        }
        return nextUrl;
      });
    };

    const run = async () => {
      setPreviewLoading(true);
      setPreviewError(null);
      const result = await fetchReceiptPreview(receipt.id);
      objectUrl = result.url;
      if (!active) {
        return;
      }
      if (result.error) {
        setPreviewError(result.error);
      }
      revokeAndSet(result.url);
      setPreviewMimeType(result.mimeType);
      setPreviewLoading(false);
    };

    void run();

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [receipt]);

  return { previewLoading, previewUrl, previewMimeType, previewError };
}

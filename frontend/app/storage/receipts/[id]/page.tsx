'use client';
import { Box, Typography } from '@mui/material';
import { useParams, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useState } from 'react';
import { ArrowLeft } from '@/app/components/icons';
import { EInvoicePanel } from '@/app/components/receipts/EInvoicePanel';
import { ReceiptLocationSection } from '@/app/components/receipts/location/ReceiptLocationSection';
import { ReceiptLinks } from '@/app/components/receipts/ReceiptLinks';
import { ReceiptParsedDataForm } from '@/app/components/receipts/ReceiptParsedDataForm';
import { ReceiptTransactionMatch } from '@/app/components/receipts/ReceiptTransactionMatch';
import { useIntlayer } from '@/app/i18n';
import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import { formatStoredDate } from '@/app/lib/user-format-store';
import { tokens } from '@/lib/theme-tokens';
import { useReceiptActions } from './hooks/useReceiptActions';
import { useReceiptAutosave } from './hooks/useReceiptAutosave';
import { useReceiptDocument } from './hooks/useReceiptDocument';
import { useReceiptPreview } from './hooks/useReceiptPreview';
import { ReceiptExportDialog } from './ReceiptExportDialog';
import { ReceiptHeaderActions } from './ReceiptHeaderActions';
import { ReceiptLoadError } from './ReceiptLoadError';
import { ReceiptPageSkeleton } from './ReceiptPageSkeleton';
import { ReceiptPreviewContent } from './ReceiptPreviewContent';
import { buildReceiptDisplayTitle } from './receipt-form';

export default function ReceiptDocumentPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const receiptId = params.id;
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? tokens.dark.color : tokens.color;
  const t = useIntlayer('receiptDocumentPage');

  const { receipt, setReceipt, categories, formValue, setFormValue, loading, error, loadData } =
    useReceiptDocument(receiptId);
  const { previewLoading, previewUrl, previewMimeType, previewError } = useReceiptPreview(receipt);
  const { handleFormChange, lastSavedPayloadRef } = useReceiptAutosave(
    receipt,
    setReceipt,
    setFormValue,
  );
  const { saving, exportingToTable, handleApprove, handleDownload, handleExportToTable } =
    useReceiptActions(receipt, formValue, lastSavedPayloadRef);
  const [exportConfirmOpen, setExportConfirmOpen] = useState(false);

  if (loading) {
    return <ReceiptPageSkeleton />;
  }

  if (error || !receipt) {
    return <ReceiptLoadError message={error} />;
  }

  const attachment = receipt.metadata?.attachments?.[0];
  const isPdf = (previewMimeType || attachment?.mimeType || '').includes('pdf');
  const canExportToTable = Boolean(receipt);
  const displayTitle = buildReceiptDisplayTitle(receipt, t.displayTitle.value);

  return (
    <Box
      className="container-shared"
      // On wide screens the page fits the viewport: the document and the form
      // scroll on their own, so the header and Approve stay in view.
      sx={{
        height: '100%',
        overflowY: { xs: 'auto', xl: 'hidden' },
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        px: { xs: 2, sm: 3, lg: 4 },
        py: { xs: 4, xl: 2.5 },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          width: '100%',
          flexDirection: 'column',
          gap: { xs: 3, xl: 2 },
          flex: { xl: 1 },
          minHeight: { xl: 0 },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 2,
            borderBottom: `1px solid ${c.ink150}`,
            pb: { xs: 3, xl: 2 },
            flexShrink: 0,
            alignItems: { sm: 'center' },
            justifyContent: { sm: 'space-between' },
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box
              component="button"
              type="button"
              onClick={() => router.back()}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                fontSize: 13,
                fontWeight: 500,
                color: c.ink500,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                p: 0,
                '&:hover': { color: c.ink700 },
              }}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t.back}
            </Box>
            <Box>
              <Typography
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.2em',
                  color: c.ink500,
                }}
              >
                {t.eyebrow}
              </Typography>
              <Typography
                component="h1"
                style={{
                  marginTop: 4,
                  fontSize: 24,
                  fontWeight: 600,
                  letterSpacing: '-0.02em',
                  color: c.ink900,
                }}
              >
                {displayTitle}
              </Typography>
              {displayTitle !== receipt.subject && (
                <Typography style={{ marginTop: 4, fontSize: 12, color: c.ink500 }}>
                  {receipt.subject}
                </Typography>
              )}
              <Typography style={{ marginTop: 4, fontSize: 13, color: c.ink700 }}>
                {receipt.source} · {formatStoredDate(receipt.receivedAt)}
              </Typography>
            </Box>
          </Box>

          <ReceiptHeaderActions
            receipt={receipt}
            formValue={formValue}
            saving={saving}
            exportDisabled={exportingToTable || !canExportToTable}
            onDownload={() => void handleDownload()}
            onExport={() => setExportConfirmOpen(true)}
            onApprove={() => void handleApprove()}
          />
        </Box>

        <ReceiptTransactionMatch
          receipt={receipt}
          categories={categories}
          saving={saving}
          onApprove={handleApprove}
          onChanged={loadData}
        />

        <Box
          sx={{
            display: 'grid',
            alignItems: 'stretch',
            gap: { xs: 3, xl: 2.5 },
            // minmax(0, …): a wide screenshot must not stretch the column past the screen.
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', xl: 'minmax(0, 1fr) minmax(0, 1fr)' },
            gridTemplateRows: { xl: 'minmax(0, 1fr)' },
            flex: { xl: 1 },
            minHeight: { xl: 0 },
          }}
        >
          <Box
            component="section"
            sx={{ display: 'flex', height: '100%', minHeight: 0, flexDirection: 'column' }}
          >
            <Box
              sx={{
                display: 'flex',
                height: '100%',
                minHeight: { xs: 420, xl: 0 },
                flexDirection: 'column',
                overflow: 'hidden',
                border: `1px solid ${c.ink150}`,
                borderRadius: tokens.radius.lg,
                bgcolor: 'background.paper',
              }}
            >
              <Box sx={{ borderBottom: `1px solid ${c.ink150}`, px: 2.5, py: 2 }}>
                <Typography style={{ fontSize: 14, fontWeight: 600, color: c.ink900 }}>
                  {t.originalDocument}
                </Typography>
              </Box>
              <Box sx={{ flex: 1, overflow: 'auto', bgcolor: c.ink50, p: 2 }}>
                <ReceiptPreviewContent
                  loading={previewLoading}
                  error={previewError}
                  url={previewUrl}
                  isPdf={isPdf}
                  title={receipt.subject}
                  inkColor={c.ink500}
                  borderColor={c.ink150}
                />
              </Box>
            </Box>
          </Box>

          <Box
            component="section"
            sx={{
              height: '100%',
              minHeight: 0,
              overflowY: { xl: 'auto' },
              display: 'flex',
              flexDirection: 'column',
              gap: 2.5,
              // No card: the form sits straight on the page, beside the document.
              px: { xl: 1 },
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
                borderBottom: `1px solid ${c.ink150}`,
                pb: 1.5,
              }}
            >
              <Box>
                <Typography style={{ fontSize: 16, fontWeight: 600, color: c.ink900 }}>
                  {t.parsedFields}
                </Typography>
                <Typography style={{ marginTop: 2, fontSize: 13, color: c.ink500 }}>
                  {t.parsedFieldsHint}
                </Typography>
              </Box>
            </Box>

            <ReceiptParsedDataForm
              compact
              value={formValue}
              categories={categories}
              onChange={handleFormChange}
              receiptId={receipt.id}
            />

            <ReceiptLinks receipt={receipt} />

            {receipt.parsedData?.einvoice ? (
              <EInvoicePanel
                einvoice={receipt.parsedData.einvoice}
                issues={receipt.parsedData.validationIssues ?? []}
                currency={receipt.parsedData.currency ?? FALLBACK_CURRENCY}
              />
            ) : null}

            {/* In the form's column, so correcting a place never scrolls the document away. */}
            <ReceiptLocationSection flat receipt={receipt} onReceiptChange={setReceipt} />
          </Box>
        </Box>
      </Box>

      <ReceiptExportDialog
        open={exportConfirmOpen}
        exporting={exportingToTable}
        disabled={exportingToTable || !canExportToTable}
        onClose={() => setExportConfirmOpen(false)}
        onConfirm={() => {
          setExportConfirmOpen(false);
          void handleExportToTable();
        }}
      />
    </Box>
  );
}

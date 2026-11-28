import type { DeviceLocation } from '@/app/lib/device-location';
import type { ManualExpenseDraft } from '@/app/lib/statement-expense-drawer';

export type SubmitScanPayload = {
  files: File[];
  allowDuplicates: boolean;
  requireManualCategorySelection: boolean;
  deviceLocationRequest: Promise<DeviceLocation | null> | null;
};

export type SubmitManualPayload = {
  draft: ManualExpenseDraft;
  date: string;
  files: File[];
  allowDuplicates: boolean;
};

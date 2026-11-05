import { CustomTableColumn } from '../../../entities/custom-table-column.entity';
import { columnSourceConfig } from './source-columns';

export type DataEntryFieldKey = 'date' | 'type' | 'amount' | 'currency' | 'note';

export function getDataEntryColumnMapping(columns: CustomTableColumn[]): {
  fieldKeyByName: Partial<Record<DataEntryFieldKey, string>>;
  customFieldKeyByName: Map<string, string>;
} {
  const fieldKeyByName: Partial<Record<DataEntryFieldKey, string>> = {};
  const customFieldKeyByName = new Map<string, string>();
  const titleToField: Record<string, DataEntryFieldKey> = {
    дата: 'date',
    тип: 'type',
    сумма: 'amount',
    валюта: 'currency',
    комментарий: 'note',
  };

  for (const column of columns) {
    const source = columnSourceConfig(column.config);
    if (
      source?.kind === 'data_entry_field' &&
      source.field &&
      !fieldKeyByName[source.field as DataEntryFieldKey]
    ) {
      fieldKeyByName[source.field as DataEntryFieldKey] = column.key;
    }
    if (
      source?.kind === 'data_entry_custom_tab' &&
      source.field &&
      !fieldKeyByName[source.field as DataEntryFieldKey]
    ) {
      fieldKeyByName[source.field as DataEntryFieldKey] = column.key;
    }
    if (
      source?.kind === 'data_entry_custom_field' &&
      source.name &&
      !customFieldKeyByName.has(source.name)
    ) {
      customFieldKeyByName.set(source.name, column.key);
    }

    const normalizedTitle = column.title?.trim().toLowerCase();
    const fallbackField = normalizedTitle ? titleToField[normalizedTitle] : undefined;
    if (fallbackField && !fieldKeyByName[fallbackField]) {
      fieldKeyByName[fallbackField] = column.key;
    }
  }

  return { fieldKeyByName, customFieldKeyByName };
}

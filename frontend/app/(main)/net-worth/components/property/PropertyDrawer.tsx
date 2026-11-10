'use client';

import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import { useState } from 'react';
import { Select } from '@/app/components/ui/select';
import { useIntlayer } from '@/app/i18n';
import type { PropertyLine } from '@/app/lib/contracts';
import { AccountSideDrawer, Field } from '../../../accounts/components/AccountSideDrawer';
import { usePropertyDebts } from '../../hooks/useProperty';
import { plainLineName } from '../net-worth-ui';
import {
  formToBody,
  invalidFields,
  type PropertyBody,
  type PropertyForm,
  TEXT_MAX,
  toForm,
} from './property-form';

const pair = { display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 12 };

/** What a property is, the debt it was bought with, and (for a vehicle) how fast it loses value. */
export function PropertyDrawer({
  property,
  saving,
  onClose,
  onSave,
}: {
  /** The property as the refreshed net worth list has it; null while closed. */
  property: PropertyLine | null;
  saving: boolean;
  onClose: () => void;
  onSave: (body: PropertyBody) => void;
}): React.JSX.Element {
  const t = useIntlayer('netWorthProperty');
  const { options } = usePropertyDebts(property !== null);
  // The card mounts the drawer afresh for each property it opens (keyed by
  // id), so the form starts from the property's figures as they are now.
  const [current, setForm] = useState<PropertyForm | null>(() =>
    property ? toForm(property) : null,
  );
  const [tried, setTried] = useState(false);
  const openId = property?.accountId ?? null;

  const kind = property?.kind ?? 'real_estate';
  const invalid = current ? invalidFields(current, kind) : [];
  const set = (patch: Partial<PropertyForm>) =>
    setForm(prev => (prev ? { ...prev, ...patch } : prev));

  const text = (key: keyof PropertyForm, label: React.ReactNode, numeric = false) => {
    const id = `property-${key}`;
    const wrong = tried && invalid.includes(key as never);
    return (
      <Field id={id} label={label} hint={wrong ? t.invalidNumber : undefined}>
        <TextField
          id={id}
          size="small"
          fullWidth
          value={current?.[key] ?? ''}
          error={wrong}
          onChange={event => set({ [key]: event.target.value })}
          slotProps={{
            htmlInput: numeric ? { inputMode: 'decimal' } : { maxLength: TEXT_MAX[key] ?? 200 },
          }}
        />
      </Field>
    );
  };
  const unit = (key: 'areaUnit' | 'mileageUnit', values: Array<[string, string]>) => (
    <Field id={`property-${key}`} label={<span aria-hidden>{'\u00a0'}</span>}>
      <Select
        id={`property-${key}`}
        size="small"
        fullWidth
        value={current?.[key] ?? values[0][0]}
        options={values.map(([value, label]) => ({ value, label }))}
        onChange={value => set({ [key]: value } as Partial<PropertyForm>)}
      />
    </Field>
  );

  const submit = () => {
    setTried(true);
    const body = current ? formToBody(current, kind) : null;
    if (body) onSave(body);
  };

  // The linked debt stays shown even when it is no longer offered (a closed loan).
  const linked = property?.debt;
  const offered =
    linked && !options.some(option => option.id === linked.id)
      ? [...options, { kind: linked.kind, id: linked.id, name: linked.name, linkedTo: openId }]
      : options;
  const debtOptions = [
    { value: '', label: t.none.value },
    ...offered.map(option => {
      const taken = option.linkedTo !== null && option.linkedTo !== openId;
      return {
        value: `${option.kind}:${option.id}`,
        label: taken
          ? `${plainLineName(option.name)} (${t.taken.value})`
          : plainLineName(option.name),
        disabled: taken,
      };
    }),
  ];

  return (
    <AccountSideDrawer
      open={property !== null}
      title={kind === 'vehicle' ? t.drawerVehicle.value : t.drawerRealEstate.value}
      backLabel={t.cancel.value}
      onClose={onClose}
      footer={
        <>
          <Button variant="text" onClick={onClose} disabled={saving}>
            {t.cancel}
          </Button>
          <Button variant="contained" onClick={submit} disabled={saving}>
            {t.save}
          </Button>
        </>
      }
    >
      {kind === 'real_estate' ? (
        <>
          <div style={pair}>
            {text('area', t.area, true)}
            {unit('areaUnit', [
              ['m2', 'm²'],
              ['ft2', 'ft²'],
            ])}
          </div>
          {text('yearBuilt', t.yearBuilt, true)}
          {text('address', t.address)}
        </>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
              gap: 12,
            }}
          >
            {text('make', t.make)}
            {text('model', t.model)}
          </div>
          {text('year', t.year, true)}
          <div style={pair}>
            {text('mileage', t.mileage, true)}
            {unit('mileageUnit', [
              ['km', 'km'],
              ['mi', 'mi'],
            ])}
          </div>
        </>
      )}
      <Field id="property-debt" label={t.linkedDebt}>
        <Select
          id="property-debt"
          size="small"
          fullWidth
          value={current?.debt ?? ''}
          options={debtOptions}
          onChange={value => set({ debt: value })}
        />
      </Field>
      {kind === 'vehicle' && (
        <Field
          id="property-depreciationRate"
          label={t.depreciation}
          hint={
            tried && invalid.includes('depreciationRate') ? t.invalidNumber : t.depreciationHint
          }
        >
          <TextField
            id="property-depreciationRate"
            size="small"
            fullWidth
            value={current?.depreciationRate ?? ''}
            error={tried && invalid.includes('depreciationRate')}
            onChange={event => set({ depreciationRate: event.target.value })}
            slotProps={{ htmlInput: { inputMode: 'decimal' } }}
          />
        </Field>
      )}
    </AccountSideDrawer>
  );
}

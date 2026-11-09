// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TagsFilterField } from './TagsFilterField';

vi.mock('@/app/components/tags/TagDrawer', () => ({ TagDrawer: () => null }));

const known = { id: '4c1d9e2a-3b5f-4a6c-8d7e-9f0a1b2c3d4e', name: 'Holiday', color: null, usageCount: 1 };
const missing = '9e8d7c6b-5a49-4382-9170-6f5e4d3c2b1a';

function renderField(value: string[]) {
  render(
    <TagsFilterField
      label="Tags"
      value={value}
      tags={[known]}
      onChange={() => undefined}
      anyLabel="Any tag"
      selectedLabel="{{count}} tags"
    />,
  );
  return screen.getByRole('button', { name: 'Tags' });
}

describe('TagsFilterField', () => {
  it('names the picked tags', () => {
    expect(renderField([known.id]).textContent).toContain(known.name);
  });

  it('does not say "Any tag" while a tag missing from the list still narrows the rows', () => {
    const field = renderField([missing]);
    expect(field.textContent).not.toContain('Any tag');
    expect(field.textContent).toContain(missing);
  });
});

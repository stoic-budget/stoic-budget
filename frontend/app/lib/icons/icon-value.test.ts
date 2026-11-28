import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATEGORY_ICON_CHOICES } from '../category-icon-choices';
import { ICON_GROUP_KEYS, groupIcons } from './icon-groups';
import { BUNDLED_ICONS, humanIconName, iconName, iconValue } from './icon-value';
import { LUCIDE_ICON_COUNT, LUCIDE_VERSION } from './lucide-version';

const catalogue = JSON.parse(
  readFileSync(
    join(__dirname, '../../../public/icons/lucide', LUCIDE_VERSION, 'nodes.json'),
    'utf8',
  ),
) as Record<string, unknown>;

describe('icon values', () => {
  it('reads a Lucide value, an old mdi pick and nothing else', () => {
    expect(iconName(iconValue('cigarette'))).toBe('cigarette');
    expect(iconName('mdi:airplane')).toBe('plane');
    expect(iconName('mdi:unknown')).toBeNull();
    expect(iconName('/uploads/icon.png')).toBeNull();
    expect(iconName('lucide:')).toBeNull();
    expect(iconName(null)).toBeNull();
  });

  it('keeps every icon the editor used to offer, drawn without the catalogue', () => {
    for (const choice of CATEGORY_ICON_CHOICES) {
      expect(BUNDLED_ICONS[choice.name], choice.value).toBeDefined();
    }
  });

  it('lists an icon without a translation by its English name', () => {
    expect(humanIconName('gamepad-2')).toBe('Gamepad 2');
  });
});

// Guards a Lucide version bump: a renamed icon would turn into a tag on every
// category that picked it, and drop out of its group.
describe('the generated catalogue', () => {
  it('has every icon the version file counts', () => {
    expect(Object.keys(catalogue)).toHaveLength(LUCIDE_ICON_COUNT);
  });

  it('has every bundled icon and every grouped icon', () => {
    const named = [...Object.keys(BUNDLED_ICONS), ...ICON_GROUP_KEYS.flatMap(groupIcons)];
    expect(named.filter(name => !(name in catalogue))).toEqual([]);
  });
});

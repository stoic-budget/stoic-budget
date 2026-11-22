import type { UpdateWorkspaceBody } from '../../contracts';
import { withoutNulls } from '../effect/without-nulls';
import { mergePluginSettings } from './workspace-plugins.util';

/** Settings key of the day the workspace's month starts on (see `MonthStartSetting`). */
export const MONTH_START_KEY = 'monthStart';

/**
 * Applies the parts of a workspace update that live in the `settings` blob
 * (plugin switches, the day the month starts), keeping every other key. A
 * part left out or sent as null leaves its key as it is.
 */
export function mergeSettingsPatch(
  current: Record<string, unknown> | null,
  patch: Pick<UpdateWorkspaceBody, 'plugins' | 'monthStart'>,
): Record<string, unknown> | null {
  let settings = current;
  if (patch.plugins != null) {
    settings = mergePluginSettings(settings, withoutNulls(patch.plugins));
  }
  if (patch.monthStart != null) {
    settings = { ...(settings ?? {}), [MONTH_START_KEY]: patch.monthStart };
  }
  return settings;
}

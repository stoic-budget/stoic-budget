import * as Schema from 'effect/Schema';
import { Timestamp, type Wire } from '../common/wire';

/**
 * A folder on the rules page. It only groups rules for reading: which rule
 * wins a row is still the one global order of the list.
 */
export const RuleGroup = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  /** Where the folder sits among the others, smallest first. */
  position: Schema.Number,
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type RuleGroup = Wire<typeof RuleGroup>;

/** `GET /categorization-rule-groups`: the workspace's folders in their order. */
export const RuleGroupList = Schema.Struct({
  data: Schema.Array(RuleGroup),
});
export type RuleGroupList = Wire<typeof RuleGroupList>;

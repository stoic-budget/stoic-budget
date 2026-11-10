import * as Schema from 'effect/Schema';
import type { Wire } from '../common/wire';

/** Not blank: a folder is told apart by its name. */
const FolderName = Schema.String.check(
  Schema.isMaxLength(100),
  Schema.isPattern(/\S/, { message: 'Expected a name' }),
);

/** `POST /categorization-rule-groups`: a new folder, placed after the others. */
export const CreateRuleGroupBody = Schema.Struct({
  name: FolderName,
});
export type CreateRuleGroupBody = Wire<typeof CreateRuleGroupBody>;

/** `PUT /categorization-rule-groups/:id`: renames the folder. */
export const UpdateRuleGroupBody = Schema.Struct({
  name: FolderName,
});
export type UpdateRuleGroupBody = Wire<typeof UpdateRuleGroupBody>;

/** `/categorization-rule-groups/:id`. */
export const RuleGroupParams = Schema.Struct({
  id: Schema.String.check(Schema.isUUID()),
});
export type RuleGroupParams = Wire<typeof RuleGroupParams>;

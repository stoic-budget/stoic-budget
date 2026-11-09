import * as Schema from 'effect/Schema';
import type { Wire } from '../common/wire';

const ImportTarget = Schema.Literals([
  'transactions',
  'subscriptions',
  'payables',
  'invoices',
  'budgets',
  'metals',
]);

/** `POST /entity-imports/suggest`: what a pasted sheet most likely is, by column roles. */
export const ImportSuggestion = Schema.Struct({
  /** `table` when the rows fit no entity: they go into a custom table. */
  target: Schema.Union([ImportTarget, Schema.Literal('table')]),
  confidence: Schema.Number,
  columns: Schema.Array(
    Schema.Struct({ index: Schema.Number, role: Schema.NullOr(Schema.String) }),
  ),
  alternatives: Schema.Array(Schema.Struct({ target: ImportTarget, confidence: Schema.Number })),
});
export type ImportSuggestion = Wire<typeof ImportSuggestion>;

/** `POST /entity-imports`: what each row became; a dry run creates nothing. */
export const EntityImportResult = Schema.Struct({
  batchId: Schema.NullOr(Schema.String),
  target: ImportTarget,
  dryRun: Schema.Boolean,
  counts: Schema.Struct({
    created: Schema.Number,
    updated: Schema.Number,
    skipped: Schema.Number,
    errors: Schema.Number,
  }),
  rows: Schema.Array(
    Schema.Struct({
      index: Schema.Number,
      status: Schema.Literals(['created', 'updated', 'skipped', 'error']),
      reason: Schema.optional(Schema.String),
      id: Schema.optional(Schema.String),
    }),
  ),
  createdIds: Schema.Array(Schema.String),
});
export type EntityImportResult = Wire<typeof EntityImportResult>;

/** `DELETE /entity-imports/:batchId`: rows the batch created removed, rows it updated put back. */
export const EntityImportUndone = Schema.Struct({
  undone: Schema.Literal(true),
  removed: Schema.Number,
  restored: Schema.Number,
});
export type EntityImportUndone = Wire<typeof EntityImportUndone>;

/** `PUT /entity-imports/mapping-profiles`: column roles remembered for one header row. */
export const ImportMappingProfile = Schema.Struct({
  id: Schema.String,
  target: ImportTarget,
  /** Target field → column index. */
  mapping: Schema.Record(Schema.String, Schema.Number),
});
export type ImportMappingProfile = Wire<typeof ImportMappingProfile>;

/** `POST /entity-imports/mapping-profiles/match`: the remembered mapping, or null. */
export const ImportMappingProfileMatch = Schema.Struct({
  profile: Schema.NullOr(ImportMappingProfile),
});
export type ImportMappingProfileMatch = Wire<typeof ImportMappingProfileMatch>;

const AppImportStatus = Schema.Literals(['created', 'matched']);

/**
 * `POST /entity-imports/apps`: per kind of record, what the files create, what
 * they match in the workspace and what they skip. A dry run writes nothing.
 */
export const AppImportResult = Schema.Struct({
  batchId: Schema.NullOr(Schema.String),
  dryRun: Schema.Boolean,
  files: Schema.Array(
    Schema.Struct({
      fileName: Schema.String,
      /** Null: not an export this importer reads. */
      app: Schema.NullOr(Schema.Literals(['ynab', 'actual', 'firefly'])),
      kind: Schema.NullOr(Schema.Literals(['register', 'plan'])),
      rows: Schema.Number,
    }),
  ),
  accounts: Schema.Array(
    Schema.Struct({
      name: Schema.String,
      status: AppImportStatus,
      walletId: Schema.NullOr(Schema.String),
      currency: Schema.String,
      transactions: Schema.Number,
      /**
       * Opening balance a new account starts from, or that an account an
       * earlier import created at zero (the other side of a transfer) takes.
       */
      opening: Schema.Number,
      /** Opening-balance rows left out: the matched account keeps its own. */
      openingsSkipped: Schema.Number,
    }),
  ),
  categories: Schema.Struct({
    created: Schema.Number,
    matched: Schema.Number,
    /** New top-level categories holding the app's category groups. */
    groups: Schema.Number,
    items: Schema.Array(
      Schema.Struct({
        group: Schema.NullOr(Schema.String),
        name: Schema.String,
        status: AppImportStatus,
      }),
    ),
  }),
  payees: Schema.Struct({ created: Schema.Number, matched: Schema.Number }),
  transactions: Schema.Struct({
    created: Schema.Number,
    /** Already in the workspace: an earlier import of the same file. */
    skipped: Schema.Number,
    /** Rows the workspace already had that became a leg of a transfer, instead of a new row. */
    linked: Schema.Number,
    errors: Schema.Number,
    transfers: Schema.Number,
    splits: Schema.Number,
  }),
  budgets: Schema.Struct({
    /** `YYYY-MM` whose assigned amounts became the monthly limits. */
    month: Schema.NullOr(Schema.String),
    created: Schema.Number,
    updated: Schema.Number,
    skipped: Schema.Number,
  }),
  problems: Schema.Array(
    Schema.Struct({ fileName: Schema.String, row: Schema.Number, reason: Schema.String }),
  ),
});
export type AppImportResult = Wire<typeof AppImportResult>;

import { FindOperator } from 'typeorm';
import { StorageAccessService } from '@/modules/storage/storage-access.service';
import { StorageFilesQueryService } from '@/modules/storage/storage-files-query.service';
import { StorageFoldersService } from '@/modules/storage/storage-folders.service';
import { StorageService } from '@/modules/storage/storage.service';

/**
 * Builds StorageService over in-memory repositories, so a spec states the rows
 * it starts from and reads the rows it ends with, whichever class inside the
 * storage module does the work. Pass a key to replace one dependency.
 */

type Row = Record<string, any>;

function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, expected]) => {
    const actual = row[key];
    if (expected instanceof FindOperator) {
      if (expected.type === 'in') {
        return (expected.value as unknown[]).includes(actual);
      }
      if (expected.type === 'isNull') {
        return actual === null || actual === undefined;
      }
      throw new Error(`memoryRepo: unsupported operator ${expected.type}`);
    }
    if (expected === null || expected === undefined) {
      // TypeORM's default (invalidWhereValuesBehavior: throw) refuses these too.
      throw new Error(`memoryRepo: ${String(expected)} for "${key}" in a where`);
    }
    if (typeof expected === 'object' && !(expected instanceof Date)) {
      return actual !== null && typeof actual === 'object' && matches(actual, expected);
    }
    return actual === expected;
  });
}

function filter(rows: Row[], where?: Row | Row[]): Row[] {
  if (!where) {
    return rows;
  }
  const options = Array.isArray(where) ? where : [where];
  return rows.filter(row => options.some(option => matches(row, option)));
}

let nextId = 1;

export function memoryRepo<T extends Row = Row>(initial: T[] = []) {
  const rows: T[] = initial.map(row => ({ ...row }));
  return {
    rows,
    find: vi.fn(async (options: { where?: Row | Row[] } = {}) => filter(rows, options.where)),
    findBy: vi.fn(async (where: Row | Row[]) => filter(rows, where)),
    findOne: vi.fn(async (options: { where?: Row | Row[] }) => filter(rows, options.where)[0] ?? null),
    count: vi.fn(async (options: { where?: Row | Row[] } = {}) => filter(rows, options.where).length),
    create: vi.fn((data: Row) => ({ ...data })),
    save: vi.fn(async (entity: Row) => {
      const existing = entity.id ? rows.find(row => row.id === entity.id) : undefined;
      if (existing) {
        Object.assign(existing, entity);
        return existing;
      }
      const saved = { id: `row-${nextId++}`, createdAt: new Date(), ...entity } as unknown as T;
      rows.push(saved);
      return saved;
    }),
    update: vi.fn(async (where: Row, patch: Row) => {
      const hit = filter(rows, where);
      for (const row of hit) {
        Object.assign(row, patch);
      }
      return { affected: hit.length };
    }),
    remove: vi.fn(async (entity: Row) => {
      const index = rows.findIndex(row => row.id === entity.id);
      if (index >= 0) {
        rows.splice(index, 1);
      }
      return entity;
    }),
    createQueryBuilder: vi.fn(),
  };
}

export type MemoryRepo = ReturnType<typeof memoryRepo>;

/** What assertRowsRemovable asks: no row of the batch is on a filed return. */
export function transactionRepo(initial: Row[] = []) {
  const repo = memoryRepo(initial);
  const countQb: any = {
    setFindOptions: vi.fn(() => countQb),
    innerJoin: vi.fn(() => countQb),
    getCount: vi.fn(async () => 0),
  };
  repo.createQueryBuilder.mockReturnValue(countQb);
  return repo;
}

export interface StorageDeps {
  sharedLinkRepository: any;
  filePermissionRepository: any;
  statementRepository: any;
  fileVersionRepository: any;
  storageViewRepository: any;
  folderRepository: any;
  tagRepository: any;
  workspaceMemberRepository: any;
  fileStorageService: any;
  statementsService: any;
  transactionRepository: any;
  categoryRepository: any;
  metricsService: any;
}

export function buildStorageService(overrides: Partial<StorageDeps> = {}) {
  const deps: StorageDeps = {
    sharedLinkRepository: memoryRepo(),
    filePermissionRepository: memoryRepo(),
    statementRepository: memoryRepo(),
    fileVersionRepository: memoryRepo(),
    storageViewRepository: memoryRepo(),
    folderRepository: memoryRepo(),
    tagRepository: memoryRepo(),
    workspaceMemberRepository: memoryRepo(),
    fileStorageService: {
      getFileAvailability: vi.fn(async () => ({ onDisk: true, inDb: false, status: 'disk' })),
      getStatementFileStream: vi.fn(async (statement: Row) => ({
        stream: { statementId: statement.id },
        fileName: statement.fileName,
        mimeType: 'application/pdf',
        source: 'disk',
      })),
      resolveFilePath: vi.fn(() => null),
      restoreFile: vi.fn(async () => null),
      isOnDisk: vi.fn(() => true),
    },
    statementsService: {
      remove: vi.fn(async () => undefined),
      permanentDelete: vi.fn(async () => undefined),
    },
    transactionRepository: transactionRepo(),
    categoryRepository: memoryRepo(),
    metricsService: undefined,
    ...overrides,
  };
  const storageAccess = new StorageAccessService(
    deps.statementRepository,
    deps.filePermissionRepository,
    deps.workspaceMemberRepository,
  );
  const service = new StorageService(
    deps.sharedLinkRepository,
    deps.filePermissionRepository,
    deps.statementRepository,
    deps.fileVersionRepository,
    deps.tagRepository,
    deps.workspaceMemberRepository,
    deps.fileStorageService,
    deps.statementsService,
    deps.transactionRepository,
    deps.categoryRepository,
    storageAccess,
    new StorageFilesQueryService(
      deps.statementRepository,
      deps.filePermissionRepository,
      deps.sharedLinkRepository,
      deps.transactionRepository,
      deps.fileStorageService,
      storageAccess,
    ),
    new StorageFoldersService(
      deps.folderRepository,
      deps.tagRepository,
      deps.statementRepository,
      deps.storageViewRepository,
      deps.statementsService,
      storageAccess,
    ),
    deps.metricsService,
  );
  return { service, deps };
}

/** The error code a Nest exception carries, or the thrown value when it is none. */
export async function errorCode(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error: any) {
    const body = typeof error?.getResponse === 'function' ? error.getResponse() : null;
    return body?.code ?? String(error);
  }
  return 'resolved';
}

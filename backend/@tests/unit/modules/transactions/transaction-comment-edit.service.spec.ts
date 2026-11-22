import { describe, expect, it, vi } from 'vitest';
import {
  ActorType,
  AuditAction,
  type AuditEvent,
} from '../../../../src/entities/audit-event.entity';
import { TransactionCommentEditService } from '../../../../src/modules/transactions/services/transaction-comment-edit.service';

const workspaceId = 'ws-1';
const viewer = 'user-viewer';
const partner = 'user-partner';
const viewerMemberId = 'member-viewer';
const at = new Date('2026-05-12T09:30:00Z');

function event(
  overrides: Partial<AuditEvent>,
  comment?: [string | null, string | null],
): AuditEvent {
  return {
    id: `event-${Math.random()}`,
    action: AuditAction.UPDATE,
    actorType: ActorType.USER,
    actorId: viewer,
    actorLabel: 'member-1@example.com',
    createdAt: at,
    meta: null,
    diff: comment
      ? { before: { comments: comment[0] }, after: { comments: comment[1] } }
      : { before: { categoryId: 'a' }, after: { categoryId: 'b' } },
    ...overrides,
  } as AuditEvent;
}

/** `comments` is what the row holds now. */
function build(
  events: AuditEvent[],
  {
    comments = null as string | null,
    isPrivate = false,
    ownerMemberId = null as string | null,
    member = { user: { name: 'Member Two', email: 'member-2@example.com' } } as unknown,
  } = {},
) {
  const auditService = { findEventsByEntity: vi.fn().mockResolvedValue(events) };
  const transactionsService = {
    findOne: vi.fn().mockResolvedValue({ id: 'tx-1', comments, isPrivate, ownerMemberId }),
  };
  const memberRepository = { findOne: vi.fn().mockResolvedValue(member) };
  const service = new TransactionCommentEditService(
    auditService as never,
    transactionsService as never,
    memberRepository as never,
  );
  return {
    latest: () => service.latest(workspaceId, viewer, 'tx-1', viewerMemberId),
    auditService,
    transactionsService,
    memberRepository,
  };
}

describe('TransactionCommentEditService', () => {
  it('says "you" when the viewer changed the comment last', async () => {
    const { latest } = build([event({}, ['Team coffee', 'Coffee for the team'])], {
      comments: 'Coffee for the team',
    });

    expect(await latest()).toEqual({
      edit: { at: at.toISOString(), by: 'you', name: null },
    });
  });

  it('names the member who changed it, by name and never by e-mail, looked up in this workspace', async () => {
    const { latest, memberRepository, transactionsService, auditService } = build(
      [event({ actorId: partner }, ['Team coffee', 'Lunch'])],
      { comments: 'Lunch' },
    );

    expect(await latest()).toEqual({
      edit: { at: at.toISOString(), by: 'member', name: 'Member Two' },
    });
    expect(memberRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: partner, workspaceId } }),
    );
    expect(transactionsService.findOne).toHaveBeenCalledWith('tx-1', workspaceId);
    expect(auditService.findEventsByEntity).toHaveBeenCalledWith(
      'transaction',
      'tx-1',
      workspaceId,
    );
  });

  it('drops the name of a member who left, and of one with only an e-mail', async () => {
    const edit = [event({ actorId: partner }, ['Team coffee', 'Lunch'])];

    expect((await build(edit, { comments: 'Lunch', member: null }).latest()).edit).toMatchObject({
      by: 'member',
      name: null,
    });
    const nameless = { user: { name: '  ', email: 'member-2@example.com' } };
    expect(
      (await build(edit, { comments: 'Lunch', member: nameless }).latest()).edit,
    ).toMatchObject({ by: 'member', name: null });
  });

  it('reads only the newest change of the comment, past later edits of other fields', async () => {
    const { latest } = build(
      [
        event({ actorId: viewer }),
        event({ actorId: partner }, ['Team coffee', 'Lunch']),
        event({ actorId: viewer }, [null, 'Team coffee']),
      ],
      { comments: 'Lunch' },
    );

    expect((await latest()).edit).toMatchObject({ by: 'member', name: 'Member Two' });
  });

  it('names a cleared comment too: the row holds nothing, as the edit left it', async () => {
    const { latest } = build([event({ actorId: partner }, ['Team coffee', null])]);

    expect((await latest()).edit).toMatchObject({ by: 'member', name: 'Member Two' });
  });

  it('shows nothing when the comment was never changed after the row came in', async () => {
    const created = event({
      action: AuditAction.CREATE,
      diff: { after: { comments: 'Imported' } },
    });

    expect(await build([event({}), created], { comments: 'Imported' }).latest()).toEqual({
      edit: null,
    });
    expect(await build([], { comments: 'Imported' }).latest()).toEqual({ edit: null });
  });

  it("shows nothing when a rule wrote over a person's comment, or the app did", async () => {
    const byPartner = event({ actorId: partner }, ['Team coffee', 'Lunch']);
    const byRule = event({ action: AuditAction.APPLY_RULE }, ['Lunch', 'Rule comment']);
    const bySystem = event({ actorType: ActorType.SYSTEM, actorId: null }, ['Lunch', 'Fixed']);

    expect(await build([byRule, byPartner], { comments: 'Rule comment' }).latest()).toEqual({
      edit: null,
    });
    expect(await build([bySystem, byPartner], { comments: 'Fixed' }).latest()).toEqual({
      edit: null,
    });
  });

  it('shows nothing once the comment moved on without a trail of it (a rule run, an old rollback, a split)', async () => {
    const byPartner = event({ actorId: partner }, [null, 'Lunch']);

    expect(await build([byPartner], { comments: 'Filled by a rule' }).latest()).toEqual({
      edit: null,
    });
    expect(await build([byPartner], { comments: null }).latest()).toEqual({ edit: null });
  });

  it('names whoever rolled a comment back, as an edit of their own', async () => {
    const byPartner = event({ actorId: partner }, ['Team coffee', 'Lunch']);
    const rolledBack = event({ action: AuditAction.ROLLBACK, actorId: viewer }, [
      'Lunch',
      'Team coffee',
    ]);

    expect(await build([rolledBack, byPartner], { comments: 'Team coffee' }).latest()).toEqual({
      edit: { at: at.toISOString(), by: 'you', name: null },
    });
  });

  it('credits the member behind an API key or the assistant', async () => {
    const throughKey = event(
      {
        actorType: ActorType.INTEGRATION,
        actorLabel: 'API key: Example key',
        meta: { onBehalfOfUserId: partner },
      },
      ['Team coffee', 'Lunch'],
    );

    expect((await build([throughKey], { comments: 'Lunch' }).latest()).edit).toMatchObject({
      by: 'member',
      name: 'Member Two',
    });
  });

  it("reveals nothing about another member's private row, not even reading its trail", async () => {
    const { latest, auditService, memberRepository } = build(
      [event({ actorId: partner }, ['Gift', 'Secret'])],
      { comments: 'Secret', isPrivate: true, ownerMemberId: 'member-partner' },
    );

    expect(await latest()).toEqual({ edit: null });
    expect(auditService.findEventsByEntity).not.toHaveBeenCalled();
    expect(memberRepository.findOne).not.toHaveBeenCalled();
  });

  it("reads the viewer's own private row", async () => {
    const { latest } = build([event({ actorId: partner }, ['Gift', 'Ring'])], {
      comments: 'Ring',
      isPrivate: true,
      ownerMemberId: viewerMemberId,
    });

    expect((await latest()).edit).toMatchObject({ by: 'member', name: 'Member Two' });
  });
});

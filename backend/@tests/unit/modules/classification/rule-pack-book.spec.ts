import { WorkspaceMember } from '@/entities/workspace-member.entity';
import { idsByName } from '@/modules/classification/helpers/rule-pack-book';

/** A pack names members by name: one two members share must find nobody. */
describe('idsByName for members', () => {
  const members = [
    { id: 'member-partner', user: { name: 'Same Name', email: 'member-1@example.com' } },
    { id: 'member-twin', user: { name: 'Same Name', email: 'member-2@example.com' } },
    { id: 'member-solo', user: { name: 'Member Three', email: 'member-3@example.com' } },
  ];
  const manager = {
    find: vi.fn(async (entity: unknown) => (entity === WorkspaceMember ? members : [])),
  };

  it('finds a member by a name only they carry, or by e-mail', async () => {
    const ids = await idsByName(manager as never, 'ws-1');
    expect(ids.member.get('member three')).toBe('member-solo');
    expect(ids.member.get('member-2@example.com')).toBe('member-twin');
  });

  it('finds nobody by a name two members share', async () => {
    const ids = await idsByName(manager as never, 'ws-1');
    expect(ids.member.has('same name')).toBe(false);
  });
});

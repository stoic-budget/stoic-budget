// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DrawerShell } from '@/app/components/ui/drawer-shell';
import { ModalShell } from '@/app/components/ui/modal-shell';
import { setDemoStatusForTests } from '@/app/hooks/useDemoStatus';

const NOTICE = 'Demo data: nothing here is saved';

vi.mock('@/app/i18n', () => ({
  useIntlayer: () => ({
    editNotice: NOTICE,
    closeDrawer: { value: 'Close' },
    closeModal: { value: 'Close' },
  }),
}));

const demo = () => act(() => setDemoStatusForTests({ enabled: true, account: null }));

describe('demo notice in drawers and dialogs', () => {
  afterEach(() => {
    act(() => setDemoStatusForTests(null));
  });

  it('heads every drawer and dialog on a demo server', () => {
    demo();
    render(
      <>
        <DrawerShell isOpen onClose={() => {}}>
          drawer body
        </DrawerShell>
        <ModalShell isOpen onClose={() => {}}>
          dialog body
        </ModalShell>
      </>,
    );
    // MUI hides the overlay underneath from assistive tech while another is open.
    expect(screen.getAllByRole('note', { hidden: true }).map(note => note.textContent)).toEqual([
      NOTICE,
      NOTICE,
    ]);
  });

  it('leaves out the ones that only show or pick', () => {
    demo();
    render(
      <>
        <DrawerShell isOpen onClose={() => {}} demoNotice={false}>
          filters
        </DrawerShell>
        <ModalShell isOpen onClose={() => {}} demoNotice={false}>
          shortcuts
        </ModalShell>
      </>,
    );
    expect(screen.getByText('filters')).toBeTruthy();
    expect(screen.queryByRole('note', { hidden: true })).toBeNull();
  });

  it('says nothing on an ordinary server', () => {
    render(
      <DrawerShell isOpen onClose={() => {}}>
        drawer body
      </DrawerShell>,
    );
    expect(screen.getByText('drawer body')).toBeTruthy();
    expect(screen.queryByRole('note')).toBeNull();
  });
});

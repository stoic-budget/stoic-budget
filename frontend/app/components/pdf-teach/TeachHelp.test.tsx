import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TeachHelp } from './TeachHelp';

describe('TeachHelp', () => {
  it('says what teaching does and where to teach again, without opening the row', async () => {
    const onRowClick = vi.fn();
    render(
      // biome-ignore lint/a11y/noStaticElementInteractions: a stand-in for the clickable row
      // biome-ignore lint/a11y/useKeyWithClickEvents: a stand-in for the clickable row
      <div onClick={onRowClick}>
        <TeachHelp />
      </div>,
    );
    const help = screen.getByTestId('teach-help');
    fireEvent.mouseOver(help);
    const tip = await screen.findByRole('tooltip');
    expect(tip.textContent).toContain('Teach');
    expect(tip.textContent).toContain('⋮');
    fireEvent.click(help);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('opens on a tap or a click, with no pointer resting on it', async () => {
    render(<TeachHelp />);
    fireEvent.click(screen.getByTestId('teach-help'));
    expect((await screen.findByRole('tooltip')).textContent).toContain('⋮');
  });
});

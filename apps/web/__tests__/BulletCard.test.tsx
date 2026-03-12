import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BulletCard from '../app/components/BulletCard';

const pendingBullet = {
  id: 'b1',
  original: 'Led the team',
  rewritten: 'Directed cross-functional team to ship features',
  approved: false,
  status: 'pending' as const,
};

const approvedBullet = {
  ...pendingBullet,
  status: 'approved' as const,
};

describe('BulletCard', () => {
  it('renders original text', () => {
    render(
      <BulletCard
        bullet={pendingBullet}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onEdit={vi.fn()}
        onRevert={vi.fn()}
      />,
    );
    expect(screen.getByText('Led the team')).toBeDefined();
  });

  it('renders rewritten text', () => {
    render(
      <BulletCard
        bullet={pendingBullet}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onEdit={vi.fn()}
        onRevert={vi.fn()}
      />,
    );
    expect(screen.getByText('Directed cross-functional team to ship features')).toBeDefined();
  });

  it('calls onAccept with bullet id when Accept is clicked', async () => {
    const onAccept = vi.fn();
    render(
      <BulletCard
        bullet={pendingBullet}
        onAccept={onAccept}
        onReject={vi.fn()}
        onEdit={vi.fn()}
        onRevert={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /accept/i }));
    expect(onAccept).toHaveBeenCalledWith('b1');
  });

  it('calls onReject with bullet id when Reject is clicked', async () => {
    const onReject = vi.fn();
    render(
      <BulletCard
        bullet={pendingBullet}
        onAccept={vi.fn()}
        onReject={onReject}
        onEdit={vi.fn()}
        onRevert={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /reject/i }));
    expect(onReject).toHaveBeenCalledWith('b1');
  });

  it('shows Revert button after a decision is made', () => {
    render(
      <BulletCard
        bullet={approvedBullet}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onEdit={vi.fn()}
        onRevert={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /revert/i })).toBeDefined();
  });

  it('calls onRevert with bullet id when Revert is clicked', async () => {
    const onRevert = vi.fn();
    render(
      <BulletCard
        bullet={approvedBullet}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onEdit={vi.fn()}
        onRevert={onRevert}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /revert/i }));
    expect(onRevert).toHaveBeenCalledWith('b1');
  });

  it('shows editable textarea when Edit is clicked', async () => {
    render(
      <BulletCard
        bullet={pendingBullet}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onEdit={vi.fn()}
        onRevert={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(screen.getByRole('textbox')).toBeDefined();
  });

  it('calls onEdit with bullet id and new text when Save is clicked', async () => {
    const onEdit = vi.fn();
    render(
      <BulletCard
        bullet={pendingBullet}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onEdit={onEdit}
        onRevert={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /edit/i }));
    const textarea = screen.getByRole('textbox');
    await userEvent.clear(textarea);
    await userEvent.type(textarea, 'My custom bullet text');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onEdit).toHaveBeenCalledWith('b1', 'My custom bullet text');
  });
});

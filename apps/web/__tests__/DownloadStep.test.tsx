import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DownloadStep from '../app/components/DownloadStep';

const baseProps = {
  score: 72,
  gaps: ['TypeScript', 'React'],
  generating: false,
  downloadReady: false,
  generationError: null as string | null,
  onRetry: vi.fn(),
};

describe('DownloadStep', () => {
  it('renders loading state when generating is true', () => {
    render(<DownloadStep {...baseProps} generating={true} />);
    expect(screen.getByText(/generating/i)).toBeDefined();
  });

  it('renders Download button when downloadReady is true', () => {
    render(<DownloadStep {...baseProps} downloadReady={true} />);
    expect(screen.getByRole('button', { name: /download/i })).toBeDefined();
  });

  it('renders error message and Retry button when generationError is set', () => {
    render(
      <DownloadStep
        {...baseProps}
        generationError="DOCX generation failed. Your edits are preserved — try again."
      />,
    );
    expect(screen.getByText(/preserved/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /retry/i })).toBeDefined();
  });

  it('calls onRetry when Retry button is clicked', async () => {
    const onRetry = vi.fn();
    render(
      <DownloadStep
        {...baseProps}
        generationError="DOCX generation failed."
        onRetry={onRetry}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('keeps score visible when generationError is set', () => {
    render(
      <DownloadStep
        {...baseProps}
        generationError="DOCX generation failed."
      />,
    );
    expect(screen.getByText('72')).toBeDefined();
  });

  it('keeps gaps visible when generationError is set', () => {
    render(
      <DownloadStep
        {...baseProps}
        generationError="DOCX generation failed."
      />,
    );
    expect(screen.getByText('TypeScript')).toBeDefined();
    expect(screen.getByText('React')).toBeDefined();
  });
});

import type { ReactElement } from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DebugLogger } from '../../src/components/DebugLogger';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import { addDebugLog, clearDebugLogs } from '../../src/lib/debug';

function BrokenComponent(): ReactElement {
  throw new Error('Falha simulada');
}

describe('DebugLogger', () => {
  beforeEach(() => {
    clearDebugLogs();
  });

  it('mostra logs ao expandir o painel', async () => {
    addDebugLog('info', 'Iniciando app');

    render(<DebugLogger />);

    fireEvent.click(screen.getByRole('button', { name: /Debug do app/i }));

    expect(await screen.findByText('Iniciando app')).toBeInTheDocument();
  });

  it('captura erro pelo ErrorBoundary e exibe no logger', async () => {
    render(
      <>
        <DebugLogger />
        <ErrorBoundary>
          <BrokenComponent />
        </ErrorBoundary>
      </>
    );

    fireEvent.click(screen.getByRole('button', { name: /Debug do app/i }));

    expect(await screen.findByText('ErrorBoundary capturou um erro')).toBeInTheDocument();
    const errorMessages = screen.getAllByText(/Falha simulada/i);
    expect(errorMessages[0]).toBeInTheDocument();
  });
});

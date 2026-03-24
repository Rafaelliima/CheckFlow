import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Dashboard, { normalizeImportedItem } from '../../src/pages/Dashboard';
import { pullData, queueMutation, retryFailedOperations } from '../../src/lib/sync';

vi.mock('../../src/lib/pdf', () => ({
  extractTextFromPDF: vi.fn(),
}));

vi.mock('../../src/lib/gemini', () => ({
  extractEquipmentFromText: vi.fn(),
}));

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } } }),
    },
  },
}));

let failedOpsCount = 0;
let syncStatus = { isProcessing: false, pendingCount: 0 };
vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn((fn: Function) => {
    if (fn.toString().includes('failed_operations.count')) return failedOpsCount;
    return [
      { id: '1', file_name: 'Análise 1', created_by_email: 'teste@email.com', created_at: '2026-03-21T10:00:00.000Z', analysis_items: [] },
    ];
  }),
}));

vi.mock('../../src/lib/sync', () => ({
  pullData: vi.fn().mockResolvedValue({
    loaded: 1,
    hasMore: false,
    nextBeforeCreatedAt: null,
  }),
  retryFailedOperations: vi.fn().mockResolvedValue(1),
  subscribeSyncStatus: vi.fn((listener: any) => {
    listener(syncStatus);
    return vi.fn();
  }),
  queueMutation: vi.fn(),
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    failedOpsCount = 0;
    syncStatus = { isProcessing: false, pendingCount: 0 };
    (pullData as any).mockResolvedValue({
      loaded: 1,
      hasMore: false,
      nextBeforeCreatedAt: null,
    });
  });

  it('lista análises do usuário com email do criador', async () => {
    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    expect(await screen.findByText('Análise 1')).toBeInTheDocument();
    expect(await screen.findByText('teste@email.com')).toBeInTheDocument();
    expect(screen.queryByText('Total Análises')).not.toBeInTheDocument();
    expect(screen.queryByText('Itens OK')).not.toBeInTheDocument();
  });

  it('navega para AnalysisPage ao clicar', async () => {
    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    const link = await screen.findByText('Análise 1');
    expect(link.closest('a')).toHaveAttribute('href', '/analysis/1');
  });

  it('permite apagar uma análise existente', async () => {
    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    const deleteButton = await screen.findByTitle('Apagar análise');
    fireEvent.click(deleteButton);
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar exclusão' }));

    await waitFor(() => {
      expect(queueMutation).toHaveBeenCalledWith('DELETE', 'analyses', '1', expect.any(Object));
    });
  });

  it('mostra aviso de alterações não sincronizadas e permite tentar novamente', async () => {
    failedOpsCount = 2;

    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    expect(await screen.findByText(/2 alteração\(ões\) não foram sincronizadas/i)).toBeInTheDocument();
    const retryButton = screen.getByRole('button', { name: 'Tentar novamente' });
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(retryFailedOperations).toHaveBeenCalled();
    });
  });

  it('mostra indicador de sincronização quando processQueue está em execução', async () => {
    syncStatus = { isProcessing: true, pendingCount: 3 };
    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    expect(await screen.findByTestId('syncing-indicator')).toHaveTextContent('Sincronizando 3 itens...');
  });
});


it('normaliza importação trocando patrimônio e número de série para o formato esperado', () => {
  expect(normalizeImportedItem({
    tag: 'T-01',
    descricao: 'Equipamento',
    modelo: 'M-01',
    patrimonio: 'NS-123',
    numero_serie: 'PAT-999',
  })).toEqual({
    tag: 'T-01',
    descricao: 'Equipamento',
    modelo: 'M-01',
    patrimonio: 'PAT-999',
    numero_serie: 'NS-123',
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import DivergentSearch from '../../src/pages/DivergentSearch';
import { queueMutation } from '../../src/lib/sync';

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { email: 'teste@email.com' } } } }),
      signOut: vi.fn(),
    },
  },
}));

vi.mock('../../src/lib/sync', () => ({
  queueMutation: vi.fn(),
  subscribeSyncStatus: vi.fn((listener: any) => {
    listener({ isProcessing: false, pendingCount: 0 });
    return vi.fn();
  }),
}));

let divergentItems: any[] = [];
vi.mock('../../src/hooks/useDivergentItems', () => ({
  useDivergentItems: () => divergentItems,
}));

const analysesList = [
  { id: 'ronda-1', file_name: 'Ronda 1 - Bloco A', created_at: '2026-03-21T10:00:00.000Z', updated_at: '2026-03-21T10:00:00.000Z' },
  { id: 'ronda-2', file_name: 'Ronda 2 - Bloco B', created_at: '2026-03-22T10:00:00.000Z', updated_at: '2026-03-22T10:00:00.000Z' },
];

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn(() => analysesList),
}));

describe('DivergentSearchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    divergentItems = [
      {
        id: 'item-1',
        analysis_id: 'ronda-1',
        analysis_file_name: 'Ronda 1 - Bloco A',
        tag: 'T-01',
        descricao: 'Monitor multiparâmetro',
        modelo: 'M-100',
        patrimonio: 'PAT-01',
        numero_serie: 'NS-001',
        status: 'Divergência',
        created_at: '2026-03-21T10:00:00.000Z',
        updated_at: '2026-03-21T10:00:00.000Z',
      },
      {
        id: 'item-2',
        analysis_id: 'ronda-2',
        analysis_file_name: 'Ronda 2 - Bloco B',
        tag: 'T-02',
        descricao: 'Bomba de infusão',
        modelo: 'M-200',
        patrimonio: 'PAT-02',
        numero_serie: 'NS-002',
        status: 'Divergência',
        created_at: '2026-03-22T10:00:00.000Z',
        updated_at: '2026-03-22T10:00:00.000Z',
      },
    ];
  });

  it('lista itens divergentes de rondas diferentes de forma global', async () => {
    render(
      <BrowserRouter>
        <DivergentSearch />
      </BrowserRouter>
    );

    expect((await screen.findAllByText('T-01')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('T-02').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Ronda 1 - Bloco A').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Ronda 2 - Bloco B').length).toBeGreaterThan(0);
  });

  it('filtra itens pela busca (tag, número de série ou ronda)', async () => {
    render(
      <BrowserRouter>
        <DivergentSearch />
      </BrowserRouter>
    );

    await screen.findAllByText('T-01');
    fireEvent.change(screen.getByPlaceholderText(/Buscar por tag/i), { target: { value: 'NS-002' } });

    expect(screen.queryByText('T-01')).not.toBeInTheDocument();
    expect(screen.getAllByText('T-02').length).toBeGreaterThan(0);
  });

  it('permite marcar uma divergência como resolvida', async () => {
    render(
      <BrowserRouter>
        <DivergentSearch />
      </BrowserRouter>
    );

    const resolveButtons = await screen.findAllByText('Marcar resolvida');
    fireEvent.click(resolveButtons[0]);

    const confirmButton = await screen.findByRole('button', { name: 'Confirmar' });
    fireEvent.click(confirmButton);

    // Items are sorted by updated_at desc, so item-2 (mais recente) resolve primeiro
    await waitFor(() => {
      expect(queueMutation).toHaveBeenCalledWith(
        'UPDATE',
        'analysis_items',
        'item-2',
        expect.objectContaining({
          found_in_analysis_id: 'ronda-2',
          found_in_analysis_name: 'Ronda 2 - Bloco B',
        })
      );
    });
  });
});

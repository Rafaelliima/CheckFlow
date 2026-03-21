import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import AnalysisDetail from '../../src/pages/AnalysisDetail';
import { queueMutation } from '../../src/lib/sync';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual as any,
    useParams: () => ({ id: '1' }),
  };
});

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnValue({
        on: vi.fn().mockReturnValue({
          subscribe: vi.fn(),
        }),
      }),
    }),
    removeChannel: vi.fn(),
  },
}));

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn((fn, deps) => {
    if (deps && deps[0] === '1' && fn.toString().includes('db.analyses.get')) {
      return { id: '1', file_name: 'Análise 1', notes: 'Notas iniciais', created_at: '2026-03-21T10:00:00.000Z' };
    }
    if (deps && deps[0] === '1' && fn.toString().includes('db.analysis_items')) {
      return [
        { id: 'i1', analysis_id: '1', tag: 'T-01', descricao: 'Desc', patrimonio: 'P1', numero_serie: 'S1', status: 'Pendente', created_at: '2026-03-21T10:00:00.000Z' }
      ];
    }
    return null;
  }),
}));

vi.mock('../../src/lib/sync', () => ({
  queueMutation: vi.fn(),
}));

// Mock PDFDownloadLink
vi.mock('@react-pdf/renderer', () => ({
  PDFDownloadLink: ({ children }: any) => <div>{children({ loading: false })}</div>,
  Document: () => <div />,
  Page: () => <div />,
  Text: () => <div />,
  View: () => <div />,
  StyleSheet: { create: () => ({}) },
}));

describe('AnalysisDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza tabela com itens', async () => {
    render(
      <BrowserRouter>
        <AnalysisDetail />
      </BrowserRouter>
    );

    expect(await screen.findByText('T-01')).toBeInTheDocument();
    expect(await screen.findByText('Desc')).toBeInTheDocument();
  });

  it('botão de editar status altera valor', async () => {
    render(
      <BrowserRouter>
        <AnalysisDetail />
      </BrowserRouter>
    );

    const okButton = await screen.findByRole('button', { name: 'OK' });
    fireEvent.click(okButton);

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(queueMutation).toHaveBeenCalledWith('UPDATE', 'analysis_items', 'i1', expect.objectContaining({ status: 'OK' }));
  });

  it('botão Exportar PDF está visível', async () => {
    render(
      <BrowserRouter>
        <AnalysisDetail />
      </BrowserRouter>
    );

    expect(await screen.findByText('Exportar PDF')).toBeInTheDocument();
  });

  it('campo notas gerais salva ao clicar no botão', async () => {
    render(
      <BrowserRouter>
        <AnalysisDetail />
      </BrowserRouter>
    );

    const textarea = await screen.findByPlaceholderText('Observações gerais sobre esta análise...');
    fireEvent.change(textarea, { target: { value: 'Novas notas' } });
    
    const saveBtn = await screen.findByText('Salvar Notas');
    fireEvent.click(saveBtn);

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(queueMutation).toHaveBeenCalledWith('UPDATE', 'analyses', '1', expect.objectContaining({ notes: 'Novas notas' }));
  });
});

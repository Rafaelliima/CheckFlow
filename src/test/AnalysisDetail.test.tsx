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

  it('renderiza tabela com itens e indicador de colaboração', async () => {
    render(
      <BrowserRouter>
        <AnalysisDetail />
      </BrowserRouter>
    );

    const elements = await screen.findAllByText('T-01');
    expect(elements[0]).toBeInTheDocument();
    
    const descElements = await screen.findAllByText('Desc');
    expect(descElements[0]).toBeInTheDocument();

    const collabIndicators = await screen.findAllByText(/Colaborativo/i);
    expect(collabIndicators[0]).toBeInTheDocument();
  });

  it('botão de editar status altera valor', async () => {
    render(
      <BrowserRouter>
        <AnalysisDetail />
      </BrowserRouter>
    );

    const okButtons = await screen.findAllByTitle('Marcar como OK');
    fireEvent.click(okButtons[0]);

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(queueMutation).toHaveBeenCalledWith('UPDATE', 'analysis_items', 'i1', expect.objectContaining({ status: 'OK' }));
  });

  it('botão Exportar PDF está visível', async () => {
    render(
      <BrowserRouter>
        <AnalysisDetail />
      </BrowserRouter>
    );

    const elements = await screen.findAllByText('Exportar PDF');
    expect(elements[0]).toBeInTheDocument();
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

  it('filtra itens na barra de pesquisa', async () => {
    render(
      <BrowserRouter>
        <AnalysisDetail />
      </BrowserRouter>
    );

    const searchInput = await screen.findByPlaceholderText(/Buscar por tag/i);
    fireEvent.change(searchInput, { target: { value: 'Inexistente' } });

    const notFoundElements = await screen.findAllByText('Nenhum item encontrado para a busca.');
    expect(notFoundElements[0]).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: 'T-01' } });
    const foundElements = await screen.findAllByText('T-01');
    expect(foundElements[0]).toBeInTheDocument();
  });

  it('abre e fecha o modal de adicionar item', async () => {
    render(
      <BrowserRouter>
        <AnalysisDetail />
      </BrowserRouter>
    );

    const fab = await screen.findByLabelText('Adicionar Item');
    fireEvent.click(fab);

    const modalTitle = await screen.findByText('Adicionar Novo Item');
    expect(modalTitle).toBeInTheDocument();

    const closeBtn = await screen.findByText('Cancelar');
    fireEvent.click(closeBtn);

    expect(screen.queryByText('Adicionar Novo Item')).not.toBeInTheDocument();
  });
});

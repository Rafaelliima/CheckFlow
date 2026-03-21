import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '../../src/pages/Dashboard';
import { queueMutation } from '../../src/lib/sync';

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

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn(() => [
    { id: '1', file_name: 'Análise 1', created_by_email: 'teste@email.com', created_at: '2026-03-21T10:00:00.000Z', analysis_items: [] },
  ]),
}));

vi.mock('../../src/lib/sync', () => ({
  pullData: vi.fn(),
  queueMutation: vi.fn(),
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('botão "Nova Análise" cria registro', async () => {
    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    const btns = await screen.findAllByText('Nova Análise');
    fireEvent.click(btns[0]);

    // Wait for the async operation
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(queueMutation).toHaveBeenCalledWith('INSERT', 'analyses', expect.any(String), expect.any(Object));
  });
});

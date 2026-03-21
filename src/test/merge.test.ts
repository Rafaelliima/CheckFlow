import { describe, it, expect } from 'vitest';
import { mergeDrafts } from '../../src/lib/merge';
import { AnalysisItem } from '../../src/types';

describe('mergeDrafts', () => {
  const baseItem: AnalysisItem = {
    id: '1',
    analysis_id: 'a1',
    tag: 'T-01',
    descricao: 'Base Description',
    modelo: 'M1',
    patrimonio: 'P1',
    numero_serie: 'S1',
    status: 'Pendente',
    created_at: '2026-03-21T10:00:00.000Z',
    updated_at: '2026-03-21T10:00:00.000Z',
  };

  it('item local mais recente vence sobre remoto (sem base)', () => {
    const local = { ...baseItem, status: 'OK', updated_at: '2026-03-21T10:05:00.000Z' };
    const remote = { ...baseItem, status: 'Divergência', updated_at: '2026-03-21T10:02:00.000Z' };

    const result = mergeDrafts(local, remote);
    expect(result.status).toBe('OK');
  });

  it('item remoto mais recente vence sobre local (sem base)', () => {
    const local = { ...baseItem, status: 'OK', updated_at: '2026-03-21T10:02:00.000Z' };
    const remote = { ...baseItem, status: 'Divergência', updated_at: '2026-03-21T10:05:00.000Z' };

    const result = mergeDrafts(local, remote);
    expect(result.status).toBe('Divergência');
  });

  it('campos independentes (status editado por um, descrição por outro)', () => {
    const local = { ...baseItem, status: 'OK', updated_at: '2026-03-21T10:05:00.000Z' };
    const remote = { ...baseItem, descricao: 'Nova Descrição', updated_at: '2026-03-21T10:02:00.000Z' };

    const result = mergeDrafts(local, remote, baseItem);
    expect(result.status).toBe('OK');
    expect(result.descricao).toBe('Nova Descrição');
  });

  it('notas gerais mantêm a mais recente', () => {
    const baseAnalysis = {
      id: 'a1',
      user_id: 'u1',
      file_name: 'test.pdf',
      notes: 'Base notes',
      created_at: '2026-03-21T10:00:00.000Z',
      updated_at: '2026-03-21T10:00:00.000Z',
    };

    const local = { ...baseAnalysis, notes: 'Local notes', updated_at: '2026-03-21T10:05:00.000Z' };
    const remote = { ...baseAnalysis, notes: 'Remote notes', updated_at: '2026-03-21T10:02:00.000Z' };

    const result = mergeDrafts(local, remote, baseAnalysis);
    expect(result.notes).toBe('Local notes');
  });
});

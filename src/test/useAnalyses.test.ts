import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAnalyses } from '../../src/hooks/useAnalyses';
import { db } from '../../src/lib/db';
import { queueMutation } from '../../src/lib/sync';

vi.mock('../../src/lib/sync', () => ({
  queueMutation: vi.fn(),
}));

describe('useAnalyses', () => {
  beforeEach(async () => {
    await db.analyses.clear();
    await db.analysis_items.clear();
    vi.clearAllMocks();
  });

  it('carregar lista de análises', async () => {
    await db.analyses.add({ id: '1', user_id: 'u1', file_name: 'Test', created_at: '2026-03-21T10:00:00.000Z', updated_at: '2026-03-21T10:00:00.000Z' });
    
    const { result } = renderHook(() => useAnalyses('u1'));
    
    await waitFor(() => {
      expect(result.current.analyses.length).toBe(1);
    });
    expect(result.current.analyses[0].file_name).toBe('Test');
  });

  it('criar nova análise', async () => {
    const { result } = renderHook(() => useAnalyses('u1'));
    
    const newAnalysis = await result.current.createAnalysis('New File');
    
    expect(newAnalysis).toBeDefined();
    expect(newAnalysis?.file_name).toBe('New File');
    expect(queueMutation).toHaveBeenCalledWith('INSERT', 'analyses', newAnalysis?.id, newAnalysis);
  });

  it('atualizar análise', async () => {
    await db.analyses.add({ id: '1', user_id: 'u1', file_name: 'Test', created_at: '2026-03-21T10:00:00.000Z', updated_at: '2026-03-21T10:00:00.000Z' });
    
    const { result } = renderHook(() => useAnalyses('u1'));
    
    await result.current.updateAnalysis('1', { file_name: 'Updated File' });
    
    expect(queueMutation).toHaveBeenCalledWith('UPDATE', 'analyses', '1', expect.objectContaining({ file_name: 'Updated File' }));
  });

  it('deletar análise', async () => {
    const { result } = renderHook(() => useAnalyses('u1'));
    
    await result.current.deleteAnalysis('1');
    
    expect(queueMutation).toHaveBeenCalledWith('DELETE', 'analyses', '1', { id: '1' });
  });
});

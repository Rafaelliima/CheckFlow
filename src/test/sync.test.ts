import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { queueMutation, processQueue, pullData } from '../../src/lib/sync';
import { db } from '../../src/lib/db';
import { supabase } from '../../src/lib/supabase';
import toast from 'react-hot-toast';

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
      delete: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
      select: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }), in: vi.fn().mockResolvedValue({ data: [], error: null }) })),
    })),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
  },
}));

describe('Offline Queue (sync.ts)', () => {
  beforeEach(async () => {
    await db.analyses.clear();
    await db.analysis_items.clear();
    await db.sync_queue.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('adicionar mutação na fila quando offline', async () => {
    // Mock offline
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    const payload = { id: '1', user_id: 'u1', file_name: 'Test', created_at: '2026-03-21T10:00:00.000Z', updated_at: '2026-03-21T10:00:00.000Z' };
    await queueMutation('INSERT', 'analyses', '1', payload);

    const queue = await db.sync_queue.toArray();
    expect(queue.length).toBe(1);
    expect(queue[0].action).toBe('INSERT');
    expect(queue[0].payload).toEqual(payload);
    expect(queue[0].retryCount).toBe(0);
  });

  it('não processar fila se estiver offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    
    const payload = { id: '1', user_id: 'u1', file_name: 'Test', created_at: '2026-03-21T10:00:00.000Z', updated_at: '2026-03-21T10:00:00.000Z' };
    await queueMutation('INSERT', 'analyses', '1', payload);
    await processQueue();

    const queue = await db.sync_queue.toArray();
    expect(queue.length).toBe(1); // Still in queue
  });

  it('processar fila quando volta online e remover mutação após sucesso (INSERT)', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    (supabase.from as any).mockReturnValue({ insert: insertMock });

    const payload = { id: '1', user_id: 'u1', file_name: 'Test', created_at: '2026-03-21T10:00:00.000Z', updated_at: '2026-03-21T10:00:00.000Z' };
    await queueMutation('INSERT', 'analyses', '1', payload);
    
    await new Promise(resolve => setTimeout(resolve, 50));

    const queue = await db.sync_queue.toArray();
    expect(queue.length).toBe(0); // Removed from queue
    expect(insertMock).toHaveBeenCalledWith(payload);
  });

  it('processar fila UPDATE e DELETE', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    
    const eqUpdateMock = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn().mockReturnValue({ eq: eqUpdateMock });
    
    const eqDeleteMock = vi.fn().mockResolvedValue({ error: null });
    const deleteMock = vi.fn().mockReturnValue({ eq: eqDeleteMock });

    (supabase.from as any).mockImplementation((table: string) => {
      return {
        update: updateMock,
        delete: deleteMock
      };
    });

    await queueMutation('UPDATE', 'analysis_items', '1', { id: '1', status: 'OK' });
    await queueMutation('DELETE', 'analyses', '2', null);
    
    await new Promise(resolve => setTimeout(resolve, 50));

    const queue = await db.sync_queue.toArray();
    expect(queue.length).toBe(0);
    expect(updateMock).toHaveBeenCalledWith({ id: '1', status: 'OK' });
    expect(eqUpdateMock).toHaveBeenCalledWith('id', '1');
    expect(deleteMock).toHaveBeenCalled();
    expect(eqDeleteMock).toHaveBeenCalledWith('id', '2');
  });

  it('ignorar erro de violação de unicidade (23505) no INSERT', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    
    const insertMock = vi.fn().mockResolvedValue({ error: { code: '23505' } });
    (supabase.from as any).mockReturnValue({ insert: insertMock });

    await queueMutation('INSERT', 'analyses', '1', { id: '1' });
    
    await new Promise(resolve => setTimeout(resolve, 50));

    const queue = await db.sync_queue.toArray();
    expect(queue.length).toBe(0); // Should be removed because error was ignored
  });

  it('parar processamento da fila em caso de erro', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    
    const insertMock = vi.fn().mockResolvedValue({ error: { code: '500', message: 'Server error' } });
    (supabase.from as any).mockReturnValue({ insert: insertMock });

    await queueMutation('INSERT', 'analyses', '1', { id: '1' });
    
    await new Promise(resolve => setTimeout(resolve, 50));

    const queue = await db.sync_queue.toArray();
    expect(queue.length).toBe(1); // Should remain in queue
    expect(queue[0].retryCount).toBe(1);
  });

  it('remove operação após 3 tentativas e mostra erro ao usuário', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    const insertMock = vi.fn().mockResolvedValue({ error: { code: '500', message: 'Server error' } });
    (supabase.from as any).mockReturnValue({ insert: insertMock });

    await db.sync_queue.add({
      action: 'INSERT',
      table: 'analyses',
      recordId: '1',
      payload: { id: '1' },
      timestamp: Date.now(),
      retryCount: 2,
    });

    await processQueue();

    const queue = await db.sync_queue.toArray();
    expect(queue.length).toBe(0);
    expect(toast.error).toHaveBeenCalledWith('Não foi possível sincronizar alterações. Verifique sua conexão e tente novamente.');
  });

  it('mostra erro ao usuário quando escrita local falha em queueMutation', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    vi.spyOn(db.analyses, 'put').mockRejectedValueOnce(new Error('dexie_write_fail'));

    await expect(queueMutation('INSERT', 'analyses', '1', { id: '1' })).rejects.toThrow('dexie_write_fail');

    const queue = await db.sync_queue.toArray();
    expect(queue.length).toBe(0);
    expect(toast.error).toHaveBeenCalledWith('Não foi possível salvar localmente. Tente novamente.');
  });

  it('pullData carrega dados do Supabase', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);

    const analysesData = [{ id: 'a1', user_id: 'u1', file_name: 'Test' }];
    const itemsData = [{ id: 'i1', analysis_id: 'a1', tag: 'T1' }];

    const limitMock = vi.fn().mockResolvedValue({ data: analysesData, error: null });
    const orderMock = vi.fn(() => ({ limit: limitMock }));
    const eqMock = vi.fn(() => ({ order: orderMock }));
    const selectMock = vi.fn(() => ({ eq: eqMock }));
    const inMock = vi.fn().mockResolvedValue({ data: itemsData, error: null });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'analyses') return { select: selectMock };
      if (table === 'analysis_items') return { select: () => ({ in: inMock }) };
      return {};
    });

    const result = await pullData('u1');

    const localAnalyses = await db.analyses.toArray();
    expect(localAnalyses.length).toBe(1);
    expect(localAnalyses[0].id).toBe('a1');
    expect(eqMock).toHaveBeenCalledWith('user_id', 'u1');
    expect(orderMock).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(limitMock).toHaveBeenCalledWith(50);

    const localItems = await db.analysis_items.toArray();
    expect(localItems.length).toBe(1);
    expect(localItems[0].id).toBe('i1');
    expect(result.hasMore).toBe(false);
    expect(result.nextBeforeCreatedAt).toBeUndefined();
  });

  it('pullData não faz nada se offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const result = await pullData('u1');
    const localAnalyses = await db.analyses.toArray();
    expect(localAnalyses.length).toBe(0);
    expect(result.loaded).toBe(0);
  });
});

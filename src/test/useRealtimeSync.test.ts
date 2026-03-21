import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRealtimeSync } from '../../src/hooks/useRealtimeSync';
import { supabase } from '../../src/lib/supabase';
import { db } from '../../src/lib/db';
import toast from 'react-hot-toast';

vi.mock('react-hot-toast', () => ({
  default: vi.fn(),
}));

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}));

describe('useRealtimeSync', () => {
  let mockOn: any;
  let mockSubscribe: any;

  beforeEach(async () => {
    await db.analyses.clear();
    await db.analysis_items.clear();
    vi.clearAllMocks();

    mockSubscribe = vi.fn().mockImplementation(function (this: any) { return this; });
    mockOn = vi.fn().mockReturnValue({
      on: vi.fn().mockReturnValue({
        subscribe: mockSubscribe,
      }),
    });

    (supabase.channel as any).mockReturnValue({
      on: mockOn,
      subscribe: mockSubscribe,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('não faz nada se analysisId for undefined', () => {
    renderHook(() => useRealtimeSync(undefined));
    expect(supabase.channel).not.toHaveBeenCalled();
  });

  it('não faz nada se estiver offline', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    renderHook(() => useRealtimeSync('1'));
    expect(supabase.channel).not.toHaveBeenCalled();
  });

  it('cria inscrição com analysisId correto', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    renderHook(() => useRealtimeSync('1'));

    expect(supabase.channel).toHaveBeenCalledWith('public:analysis_1');
    expect(mockOn).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        event: '*',
        schema: 'public',
        table: 'analysis_items',
        filter: 'analysis_id=eq.1',
      }),
      expect.any(Function)
    );
  });

  it('remove inscrição ao desmontar', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    const channelMock: any = {};
    channelMock.on = vi.fn().mockReturnValue(channelMock);
    channelMock.subscribe = vi.fn().mockReturnValue(channelMock);
    (supabase.channel as any).mockReturnValue(channelMock);

    const { unmount } = renderHook(() => useRealtimeSync('1'));
    unmount();

    expect(supabase.removeChannel).toHaveBeenCalledWith(channelMock);
  });

  it('atualiza estado local ao receber evento de UPDATE mais recente (analysis_items)', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    
    // Mock the callback logic
    let itemsCallback: any;
    mockOn.mockImplementation((event: string, config: any, callback: any) => {
      if (config.table === 'analysis_items') {
        itemsCallback = callback;
      }
      return {
        on: vi.fn().mockImplementation((e, c, cb) => {
          return { subscribe: mockSubscribe };
        })
      };
    });

    renderHook(() => useRealtimeSync('1'));

    // Add local record
    await db.analysis_items.add({
      id: 'i1',
      analysis_id: '1',
      tag: 'T1',
      descricao: 'Old',
      status: 'Pendente',
      modelo: 'M1',
      patrimonio: 'P1',
      numero_serie: 'S1',
      created_at: '2026-03-21T10:00:00.000Z',
      updated_at: '2026-03-21T10:00:00.000Z'
    });

    // Simulate realtime event
    const newRecord = {
      id: 'i1',
      analysis_id: '1',
      tag: 'T1',
      descricao: 'New',
      status: 'OK',
      created_at: '2026-03-21T10:00:00.000Z',
      updated_at: '2026-03-21T11:00:00.000Z' // Newer
    };

    await itemsCallback({
      eventType: 'UPDATE',
      new: newRecord
    });

    const updatedLocal = await db.analysis_items.get('i1');
    expect(updatedLocal?.descricao).toBe('New');
    expect(toast).toHaveBeenCalledWith('Item atualizado por outro usuário', { icon: '🔄' });
  });

  it('ignora evento de UPDATE se estado local for mais recente', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    
    let itemsCallback: any;
    mockOn.mockImplementation((event: string, config: any, callback: any) => {
      if (config.table === 'analysis_items') {
        itemsCallback = callback;
      }
      return {
        on: vi.fn().mockImplementation((e, c, cb) => {
          return { subscribe: mockSubscribe };
        })
      };
    });

    renderHook(() => useRealtimeSync('1'));

    // Add local record (newer)
    await db.analysis_items.add({
      id: 'i1',
      analysis_id: '1',
      tag: 'T1',
      descricao: 'New Local',
      status: 'Pendente',
      modelo: 'M1',
      patrimonio: 'P1',
      numero_serie: 'S1',
      created_at: '2026-03-21T10:00:00.000Z',
      updated_at: '2026-03-21T12:00:00.000Z' // Newer
    });

    // Simulate realtime event (older)
    const oldRecord = {
      id: 'i1',
      analysis_id: '1',
      tag: 'T1',
      descricao: 'Old Remote',
      status: 'OK',
      created_at: '2026-03-21T10:00:00.000Z',
      updated_at: '2026-03-21T11:00:00.000Z' // Older
    };

    await itemsCallback({
      eventType: 'UPDATE',
      new: oldRecord
    });

    const updatedLocal = await db.analysis_items.get('i1');
    expect(updatedLocal?.descricao).toBe('New Local');
    expect(toast).not.toHaveBeenCalled();
  });
});

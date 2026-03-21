import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
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
  let channelFactory: ReturnType<typeof vi.fn>;
  let statusesQueue: string[][];
  let itemsCallback: ((payload: any) => Promise<void>) | undefined;
  let analysisCallback: ((payload: any) => Promise<void>) | undefined;
  let createdChannels: any[];
  let onlineSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await db.analyses.clear();
    await db.analysis_items.clear();
    vi.clearAllMocks();
    statusesQueue = [['SUBSCRIBED']];
    createdChannels = [];
    itemsCallback = undefined;
    analysisCallback = undefined;

    onlineSpy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);

    channelFactory = vi.fn().mockImplementation((name: string) => {
      const channel: any = {
        name,
        on: vi.fn((event: string, config: any, callback: any) => {
          if (config.table === 'analysis_items') itemsCallback = callback;
          if (config.table === 'analyses') analysisCallback = callback;
          return channel;
        }),
        subscribe: vi.fn((callback?: (status: string) => void) => {
          const statuses = statusesQueue.shift() || ['SUBSCRIBED'];
          statuses.forEach((status) => callback?.(status));
          return channel;
        }),
      };

      createdChannels.push(channel);
      return channel;
    });

    (supabase.channel as any).mockImplementation(channelFactory);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('não faz nada se analysisId for undefined', () => {
    const { result } = renderHook(() => useRealtimeSync(undefined));

    expect(supabase.channel).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('entra em offline se montar sem conexão', () => {
    onlineSpy.mockReturnValue(false);

    const { result } = renderHook(() => useRealtimeSync('1'));

    expect(supabase.channel).not.toHaveBeenCalled();
    expect(result.current.status).toBe('offline');
  });

  it('cria inscrição com analysisId correto e marca conectado', async () => {
    const { result } = renderHook(() => useRealtimeSync('1'));

    expect(supabase.channel).toHaveBeenCalledWith('public:analysis_1');

    await waitFor(() => {
      expect(result.current.status).toBe('connected');
    });
  });

  it('remove inscrição ao desmontar', () => {
    const { unmount } = renderHook(() => useRealtimeSync('1'));

    const channel = createdChannels[0];
    unmount();

    expect(supabase.removeChannel).toHaveBeenCalledWith(channel);
  });

  it('atualiza estado local ao receber evento de UPDATE mais recente (analysis_items)', async () => {
    renderHook(() => useRealtimeSync('1'));

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

    await itemsCallback?.({
      eventType: 'UPDATE',
      new: {
        id: 'i1',
        analysis_id: '1',
        tag: 'T1',
        descricao: 'New',
        status: 'OK',
        modelo: 'M1',
        patrimonio: 'P1',
        numero_serie: 'S1',
        created_at: '2026-03-21T10:00:00.000Z',
        updated_at: '2026-03-21T11:00:00.000Z'
      }
    });

    const updatedLocal = await db.analysis_items.get('i1');
    expect(updatedLocal?.descricao).toBe('New');
    expect(toast).toHaveBeenCalledWith('Item atualizado por outro usuário', { icon: '🔄' });
  });

  it('ignora evento de UPDATE se estado local for mais recente', async () => {
    renderHook(() => useRealtimeSync('1'));

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
      updated_at: '2026-03-21T12:00:00.000Z'
    });

    await itemsCallback?.({
      eventType: 'UPDATE',
      new: {
        id: 'i1',
        analysis_id: '1',
        tag: 'T1',
        descricao: 'Old Remote',
        status: 'OK',
        modelo: 'M1',
        patrimonio: 'P1',
        numero_serie: 'S1',
        created_at: '2026-03-21T10:00:00.000Z',
        updated_at: '2026-03-21T11:00:00.000Z'
      }
    });

    const updatedLocal = await db.analysis_items.get('i1');
    expect(updatedLocal?.descricao).toBe('New Local');
    expect(toast).not.toHaveBeenCalled();
  });

  it('ignora payload duplicado para evitar reaplicação no Dexie', async () => {
    renderHook(() => useRealtimeSync('1'));

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

    const payload = {
      eventType: 'UPDATE',
      new: {
        id: 'i1',
        analysis_id: '1',
        tag: 'T1',
        descricao: 'Novo remoto',
        status: 'OK',
        modelo: 'M1',
        patrimonio: 'P1',
        numero_serie: 'S1',
        created_at: '2026-03-21T10:00:00.000Z',
        updated_at: '2026-03-21T11:00:00.000Z'
      }
    };

    await itemsCallback?.(payload);
    await itemsCallback?.(payload);

    const updatedLocal = await db.analysis_items.get('i1');
    expect(updatedLocal?.descricao).toBe('Novo remoto');
    expect(toast).toHaveBeenCalledTimes(1);
  });

  it('agenda reconexão automática quando a assinatura falha e conecta na tentativa seguinte', async () => {
    vi.useFakeTimers();
    statusesQueue = [['CHANNEL_ERROR'], ['SUBSCRIBED']];

    const { result } = renderHook(() => useRealtimeSync('1'));

    expect(result.current.status).toBe('reconnecting');
    expect(result.current.retryCount).toBe(1);

    expect(supabase.channel).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(supabase.channel).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe('connected');
    expect(result.current.retryCount).toBe(0);
  });

  it('pausa reconexão quando fica offline e reconecta ao voltar a internet', async () => {
    vi.useFakeTimers();
    statusesQueue = [['CHANNEL_ERROR'], ['SUBSCRIBED']];

    const { result } = renderHook(() => useRealtimeSync('1'));

    expect(result.current.status).toBe('reconnecting');

    onlineSpy.mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current.status).toBe('offline');

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(supabase.channel).toHaveBeenCalledTimes(1);

    onlineSpy.mockReturnValue(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(supabase.channel).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe('connected');
  });

  it('remove canal antigo ao trocar de analysisId', async () => {
    const { rerender } = renderHook(({ analysisId }) => useRealtimeSync(analysisId), {
      initialProps: { analysisId: '1' },
    });

    const firstChannel = createdChannels[0];

    rerender({ analysisId: '2' });

    await waitFor(() => {
      expect(supabase.channel).toHaveBeenCalledWith('public:analysis_2');
    });

    expect(supabase.removeChannel).toHaveBeenCalledWith(firstChannel);
  });

});

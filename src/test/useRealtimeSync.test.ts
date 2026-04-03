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
    from: vi.fn(),
  },
}));

const HEARTBEAT_INTERVAL_MS = 15000;
const HEARTBEAT_TIMEOUT_MS = 3000;

describe('useRealtimeSync', () => {
  let statusesQueue: string[][];
  let itemsCallback: ((payload: any) => Promise<void>) | undefined;
  let analysisCallback: ((payload: any) => Promise<void>) | undefined;
  let createdChannels: any[];
  let onlineSpy: ReturnType<typeof vi.spyOn>;
  let heartbeatQuery: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    await db.analyses.clear();
    await db.analysis_items.clear();
    vi.clearAllMocks();
    statusesQueue = [['SUBSCRIBED']];
    createdChannels = [];
    itemsCallback = undefined;
    analysisCallback = undefined;

    onlineSpy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);

    (supabase.channel as any).mockImplementation((name: string) => {
      const channel: any = {
        name,
        on: vi.fn((_: string, config: any, callback: any) => {
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

    heartbeatQuery = vi.fn().mockResolvedValue({ data: null, error: null, count: 0 });
    (supabase.from as any).mockReturnValue({
      select: vi.fn(() => ({
        limit: heartbeatQuery,
      })),
    });
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

  it('cria inscrição com analysisId correto e entra em online após o primeiro heartbeat bem-sucedido', async () => {
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
      updated_at: '2026-03-21T10:00:00.000Z',
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
        updated_at: '2026-03-21T11:00:00.000Z',
      },
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
      updated_at: '2026-03-21T12:00:00.000Z',
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
        updated_at: '2026-03-21T11:00:00.000Z',
      },
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
      updated_at: '2026-03-21T10:00:00.000Z',
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
        updated_at: '2026-03-21T11:00:00.000Z',
      },
    };

    await itemsCallback?.(payload);
    await itemsCallback?.(payload);

    const updatedLocal = await db.analysis_items.get('i1');
    expect(updatedLocal?.descricao).toBe('Novo remoto');
    expect(toast).toHaveBeenCalledTimes(1);
  });

  it('entra em conexão ruim quando o heartbeat fica lento e volta para online no primeiro heartbeat saudável', async () => {
    vi.useFakeTimers();
    heartbeatQuery
      .mockImplementationOnce(() => new Promise((resolve) => setTimeout(() => resolve({ data: null, error: null, count: 0 }), 2000)))
      .mockResolvedValue({ data: null, error: null, count: 0 });

    const { result } = renderHook(() => useRealtimeSync('1'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(result.current.status).toBe('degraded');

    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await Promise.resolve();
    });

    expect(result.current.status).toBe('connected');
  });

  it('entra em offline após falhas consecutivas de heartbeat e volta ao online depois de sucessos', async () => {
    vi.useFakeTimers();
    heartbeatQuery.mockRejectedValue(new Error('network_fail'));

    const { result } = renderHook(() => useRealtimeSync('1'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS * 3 + HEARTBEAT_TIMEOUT_MS * 3);
    });

    expect(result.current.status).toBe('offline');

    heartbeatQuery.mockResolvedValue({ data: null, error: null, count: 0 });
    onlineSpy.mockReturnValue(true);

    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await Promise.resolve();
    });

    expect(result.current.status).toBe('connected');
  });

  it('não remove canal dentro do callback de subscribe para evitar recursão e remove de forma adiada antes de reconectar', async () => {
    vi.useFakeTimers();
    statusesQueue = [['CHANNEL_ERROR'], ['SUBSCRIBED']];

    renderHook(() => useRealtimeSync('1'));

    expect(supabase.removeChannel).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(supabase.removeChannel).toHaveBeenCalledTimes(1);
    expect(supabase.channel).toHaveBeenCalledTimes(2);
  });

  it('aplica debounce mínimo entre reconexões consecutivas', async () => {
    vi.useFakeTimers();
    statusesQueue = [['CHANNEL_ERROR'], ['CHANNEL_ERROR'], ['SUBSCRIBED']];

    renderHook(() => useRealtimeSync('1'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(supabase.channel).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(supabase.channel).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(supabase.channel).toHaveBeenCalledTimes(3);
  });

  it('ativa circuit breaker por 10s após 5 falhas em janela curta', async () => {
    vi.useFakeTimers();
    statusesQueue = [
      ['CHANNEL_ERROR'],
      ['CHANNEL_ERROR'],
      ['CHANNEL_ERROR'],
      ['CHANNEL_ERROR'],
      ['CHANNEL_ERROR'],
      ['SUBSCRIBED'],
    ];

    renderHook(() => useRealtimeSync('1'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(supabase.channel).toHaveBeenCalledTimes(5);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(9000);
    });
    expect(supabase.channel).toHaveBeenCalledTimes(5);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(supabase.channel).toHaveBeenCalledTimes(6);
  });
});

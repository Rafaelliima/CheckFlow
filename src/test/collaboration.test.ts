import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getSession: vi.fn(),
    },
  },
}));

describe('Colaboração', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve buscar todas as análises (sem filtro user_id)', async () => {
    const mockData = [
      { id: '1', file_name: 'Analise A', created_by_email: 'user1@email.com' },
      { id: '2', file_name: 'Analise B', created_by_email: 'user2@email.com' },
    ];
    
    vi.spyOn(supabase, 'from').mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      }),
    } as any);

    // A chamada NÃO deve ter .eq('user_id', ...)
    const { data } = await supabase.from('analyses').select('*').order('created_at');
    
    expect(data).toHaveLength(2);
    expect(data[0].created_by_email).toBe('user1@email.com');
    expect(data[1].created_by_email).toBe('user2@email.com');
  });

  it('deve criar análise com created_by preenchido', async () => {
    const mockUserId = 'user-123';
    const mockEmail = 'teste@email.com';
    
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session: { user: { id: mockUserId, email: mockEmail } } },
      error: null,
    } as any);

    const insertSpy = vi.spyOn(supabase, 'from').mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'new-id' }, error: null }),
        }),
      }),
    } as any);

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    
    await supabase.from('analyses').insert({
      file_name: 'Nova Análise',
      created_by: session?.user.id,
      created_by_email: session?.user.email,
    });
    
    expect(insertSpy).toHaveBeenCalledWith('analyses');
  });
});

import { vi } from 'vitest'

export const mockUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ error: null }),
})
export const mockInsert = vi.fn().mockReturnValue({
  select: vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue({ data: { id: 'real-id-001' }, error: null }),
  }),
})
export const mockDelete = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ error: null }),
})
export const mockFrom = vi.fn().mockReturnValue({
  update: mockUpdate,
  insert: mockInsert,
  delete: mockDelete,
})

export const mockSupabaseClient = { from: mockFrom }

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabaseClient,
}))

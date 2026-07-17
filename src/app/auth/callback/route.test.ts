import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  getUser: vi.fn(),
  serverFrom: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: async () => ({ getAll: () => [], set: vi.fn() }),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      verifyOtp: mocks.verifyOtp,
      getUser: mocks.getUser,
    },
    from: mocks.serverFrom,
  }),
}))

import { GET } from './route'

const makeReq = (params: Record<string, string>) => {
  const url = new URL('http://localhost:3000/auth/callback')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new Request(url.toString()) as unknown as NextRequest
}

const isRedirect = (res: Response) =>
  res.status >= 300 && res.status < 400

describe('GET /auth/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('token_hashがない場合は/loginにリダイレクト', async () => {
    const res = await GET(makeReq({ type: 'invite' }))
    expect(isRedirect(res)).toBe(true)
    expect(res.headers.get('location')).toContain('/login')
  })

  it('typeがない場合は/loginにリダイレクト', async () => {
    const res = await GET(makeReq({ token_hash: 'abc123' }))
    expect(isRedirect(res)).toBe(true)
    expect(res.headers.get('location')).toContain('/login')
  })

  it('verifyOtpが失敗した場合は/loginにリダイレクト', async () => {
    mocks.verifyOtp.mockResolvedValue({ error: { message: 'Token has expired or is invalid' } })
    const res = await GET(makeReq({ token_hash: 'bad-token', type: 'invite' }))
    expect(isRedirect(res)).toBe(true)
    expect(res.headers.get('location')).toContain('/login')
  })

  it('getUser失敗時は/loginにリダイレクト', async () => {
    mocks.verifyOtp.mockResolvedValue({ error: null })
    mocks.getUser.mockResolvedValue({ data: { user: null } })
    const res = await GET(makeReq({ token_hash: 'valid-token', type: 'invite' }))
    expect(isRedirect(res)).toBe(true)
    expect(res.headers.get('location')).toContain('/login')
  })

  it('新規ユーザーはkoujitei_usersを作成して/auth/set-passwordにリダイレクト', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    const mockPendingDeleteEq = vi.fn().mockResolvedValue({ error: null })

    mocks.verifyOtp.mockResolvedValue({ error: null })
    mocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'new-user-1',
          email: 'new@example.com',
          user_metadata: { name: '田中太郎', role: 'member', color: '#4a7fff' },
        },
      },
    })
    mocks.serverFrom.mockImplementation((table: string) => {
      if (table === 'koujitei_users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null }), // 未登録
            }),
          }),
          insert: mockInsert,
        }
      }
      // koujitei_pending_users
      return {
        delete: vi.fn().mockReturnValue({ eq: mockPendingDeleteEq }),
      }
    })

    const res = await GET(makeReq({ token_hash: 'valid-token', type: 'invite' }))
    expect(isRedirect(res)).toBe(true)
    expect(res.headers.get('location')).toContain('/auth/set-password')
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'new-user-1', name: '田中太郎', role: 'member' }),
    )
  })

  it('新規ユーザー登録後にkoujitei_pending_usersから削除する', async () => {
    const mockPendingDeleteEq = vi.fn().mockResolvedValue({ error: null })
    const mockPendingDelete = vi.fn().mockReturnValue({ eq: mockPendingDeleteEq })

    mocks.verifyOtp.mockResolvedValue({ error: null })
    mocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'new-user-1',
          email: 'new@example.com',
          user_metadata: { name: '田中太郎', role: 'member', color: '#4a7fff' },
        },
      },
    })
    mocks.serverFrom.mockImplementation((table: string) => {
      if (table === 'koujitei_users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null }),
            }),
          }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        }
      }
      return { delete: mockPendingDelete }
    })

    await GET(makeReq({ token_hash: 'valid-token', type: 'invite' }))
    expect(mockPendingDeleteEq).toHaveBeenCalledWith('email', 'new@example.com')
  })

  it('既存adminユーザーは/adminにリダイレクト', async () => {
    mocks.verifyOtp.mockResolvedValue({ error: null })
    mocks.getUser.mockResolvedValue({
      data: {
        user: { id: 'existing-1', email: 'admin@example.com', user_metadata: {} },
      },
    })
    mocks.serverFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'existing-1', role: 'admin' } }),
        }),
      }),
    })

    const res = await GET(makeReq({ token_hash: 'valid-token', type: 'recovery' }))
    expect(isRedirect(res)).toBe(true)
    expect(res.headers.get('location')).toContain('/admin')
  })

  it('既存memberユーザーは/memberにリダイレクト', async () => {
    mocks.verifyOtp.mockResolvedValue({ error: null })
    mocks.getUser.mockResolvedValue({
      data: {
        user: { id: 'existing-2', email: 'member@example.com', user_metadata: {} },
      },
    })
    mocks.serverFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'existing-2', role: 'member' } }),
        }),
      }),
    })

    const res = await GET(makeReq({ token_hash: 'valid-token', type: 'recovery' }))
    expect(isRedirect(res)).toBe(true)
    expect(res.headers.get('location')).toContain('/member')
  })
})

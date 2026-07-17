import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  serverFrom: vi.fn(),
  inviteUserByEmail: vi.fn(),
  adminFrom: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: async () => ({ getAll: () => [], set: vi.fn() }),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.serverFrom,
  }),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { admin: { inviteUserByEmail: mocks.inviteUserByEmail } },
    from: mocks.adminFrom,
  }),
}))

import { POST } from './route'

const makeReq = (body: object) =>
  new Request('http://localhost:3000/api/admin/invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest

function setupAdminAuth() {
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'admin-1' } } })
  mocks.serverFrom.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { role: 'admin' } }),
      }),
    }),
  })
}

describe('POST /api/admin/invite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupAdminAuth()
    mocks.inviteUserByEmail.mockResolvedValue({ error: null })
    mocks.adminFrom.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    })
  })

  it('未認証ユーザーは401を返す', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } })
    const res = await POST(makeReq({ email: 'test@example.com', name: '太郎' }))
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ error: '未認証' })
  })

  it('管理者以外は403を返す', async () => {
    mocks.serverFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { role: 'member' } }),
        }),
      }),
    })
    const res = await POST(makeReq({ email: 'test@example.com', name: '太郎' }))
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ error: '権限がありません' })
  })

  it('メールが未入力の場合は400を返す', async () => {
    const res = await POST(makeReq({ email: '', name: '太郎' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'メールと氏名は必須です' })
  })

  it('氏名が未入力の場合は400を返す', async () => {
    const res = await POST(makeReq({ email: 'test@example.com', name: '' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'メールと氏名は必須です' })
  })

  it('既存ユーザーへの招待は日本語エラーを返す', async () => {
    mocks.inviteUserByEmail.mockResolvedValue({
      error: { message: 'User already registered' },
    })
    const res = await POST(makeReq({ email: 'exist@example.com', name: '太郎' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({
      error: 'このメールアドレスはすでに招待済みまたは登録済みです',
    })
  })

  it('"already invited" エラーも日本語メッセージを返す', async () => {
    mocks.inviteUserByEmail.mockResolvedValue({
      error: { message: 'A user with this email address has already been invited' },
    })
    const res = await POST(makeReq({ email: 'invited@example.com', name: '花子' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({
      error: 'このメールアドレスはすでに招待済みまたは登録済みです',
    })
  })

  it('正常招待でok:trueを返す', async () => {
    const res = await POST(makeReq({
      email: 'new@example.com',
      name: '田中',
      role: 'member',
      color: '#4a7fff',
    }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true })
    expect(mocks.inviteUserByEmail).toHaveBeenCalledWith(
      'new@example.com',
      expect.objectContaining({
        data: expect.objectContaining({ name: '田中', role: 'member' }),
      }),
    )
  })

  it('コールバックURLに/auth/callbackが含まれる', async () => {
    await POST(makeReq({ email: 'new@example.com', name: '田中', role: 'member', color: '#4a7fff' }))
    expect(mocks.inviteUserByEmail).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ redirectTo: expect.stringContaining('/auth/callback') }),
    )
  })
})

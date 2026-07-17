import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  serverFrom: vi.fn(),
  listUsers: vi.fn(),
  deleteUser: vi.fn(),
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
    auth: {
      admin: {
        listUsers: mocks.listUsers,
        deleteUser: mocks.deleteUser,
      },
    },
    from: mocks.adminFrom,
  }),
}))

import { DELETE } from './route'

const makeReq = (body: object) =>
  new Request('http://localhost:3000/api/admin/delete-pending', {
    method: 'DELETE',
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

function setupAdminFromForDelete(email = 'invited@example.com') {
  mocks.adminFrom.mockImplementation((table: string) => {
    if (table === 'koujitei_pending_users') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { email } }),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }
    }
    return {}
  })
}

describe('DELETE /api/admin/delete-pending', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupAdminAuth()
    setupAdminFromForDelete()
    mocks.listUsers.mockResolvedValue({
      data: { users: [{ id: 'auth-user-1', email: 'invited@example.com' }] },
    })
    mocks.deleteUser.mockResolvedValue({ error: null })
  })

  it('未認証ユーザーは401を返す', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } })
    const res = await DELETE(makeReq({ id: 'pending-1' }))
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
    const res = await DELETE(makeReq({ id: 'pending-1' }))
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ error: '権限がありません' })
  })

  it('IDが未指定の場合は400を返す', async () => {
    const res = await DELETE(makeReq({}))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'id が必要です' })
  })

  it('正常削除でok:trueを返す', async () => {
    const res = await DELETE(makeReq({ id: 'pending-1' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true })
  })

  it('auth.usersのレコードも削除する', async () => {
    await DELETE(makeReq({ id: 'pending-1' }))
    expect(mocks.deleteUser).toHaveBeenCalledWith('auth-user-1')
  })

  it('auth.usersに対象メールがなくてもpending_usersは削除する', async () => {
    mocks.listUsers.mockResolvedValue({ data: { users: [] } })
    const res = await DELETE(makeReq({ id: 'pending-1' }))
    expect(res.status).toBe(200)
    expect(mocks.deleteUser).not.toHaveBeenCalled()
  })
})

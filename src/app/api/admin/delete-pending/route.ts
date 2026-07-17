import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function DELETE(req: NextRequest) {
  // 呼び出し元が管理者かチェック
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(c) { c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未認証' }, { status: 401 })

  const { data: kUser } = await supabase.from('koujitei_users').select('role').eq('id', user.id).single()
  if (kUser?.role !== 'admin') return NextResponse.json({ error: '権限がありません' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id が必要です' }, { status: 400 })

  const adminClient = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // pending_users からメールアドレスを取得
  const { data: pending } = await adminClient
    .from('koujitei_pending_users')
    .select('email')
    .eq('id', id)
    .single()

  // auth.users のレコードも削除（招待リンクを無効化）
  if (pending?.email) {
    const { data: { users } } = await adminClient.auth.admin.listUsers()
    const authUser = users.find(u => u.email === pending.email)
    if (authUser) {
      await adminClient.auth.admin.deleteUser(authUser.id)
    }
  }

  // pending_users から削除
  const { error: dbErr } = await adminClient
    .from('koujitei_pending_users')
    .delete()
    .eq('id', id)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

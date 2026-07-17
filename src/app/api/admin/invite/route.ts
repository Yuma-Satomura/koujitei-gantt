import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
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

  const { email, name, role, color } = await req.json()
  if (!email || !name) return NextResponse.json({ error: 'メールと氏名は必須です' }, { status: 400 })

  const origin = new URL(req.url).origin

  // サービスロールで招待メール送信
  const adminClient = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { name, role, color },
    redirectTo: `${origin}/auth/callback`,
  })

  if (inviteError) {
    const msg = /already|registered|invited/i.test(inviteError.message)
      ? 'このメールアドレスはすでに招待済みまたは登録済みです'
      : inviteError.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  // 管理画面の招待済みリスト表示用に pending_users へも登録
  const { error: dbErr } = await adminClient
    .from('koujitei_pending_users')
    .insert({ email, name, role, color })
  if (dbErr && dbErr.code !== '23505') {
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

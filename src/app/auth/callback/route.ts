import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')

  if (!token_hash || !type) {
    return NextResponse.redirect(new URL('/login', origin))
  }

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

  const { error } = await supabase.auth.verifyOtp({
    token_hash,
    type: type as 'invite' | 'recovery' | 'email' | 'signup' | 'magiclink',
  })

  if (error) {
    return NextResponse.redirect(new URL('/login', origin))
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', origin))

  const meta = user.user_metadata ?? {}

  // koujitei_users が未作成なら招待情報から作成
  const { data: existing } = await supabase
    .from('koujitei_users')
    .select('id, role')
    .eq('id', user.id)
    .single()

  if (!existing) {
    await supabase.from('koujitei_users').insert({
      id: user.id,
      name: meta.name ?? 'ユーザー',
      role: meta.role ?? 'member',
      color: meta.color ?? '#4a7fff',
    })
    if (user.email) {
      await supabase.from('koujitei_pending_users').delete().eq('email', user.email)
    }
    // 初回はパスワード設定ページへ
    return NextResponse.redirect(new URL('/auth/set-password', origin))
  }

  // 既存ユーザー（パスワードリセットなど）はそのままロールページへ
  const role = existing.role ?? meta.role ?? 'member'
  return NextResponse.redirect(new URL(role === 'admin' ? '/admin' : '/member', origin))
}

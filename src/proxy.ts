import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  // 環境変数未設定時はパス
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // セッションのリフレッシュ（Supabase SSR必須）
  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // 未認証ユーザーをログインへ（/auth/* は招待コールバック用に除外）
  if (!user && pathname !== '/login' && !pathname.startsWith('/auth/')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 認証済みユーザーをログイン・トップから適切なページへ
  if (user && (pathname === '/login' || pathname === '/')) {
    const { data: kUser } = await supabase
      .from('koujitei_users')
      .select('role')
      .eq('id', user.id)
      .single()
    const role = kUser?.role ?? 'member'
    return NextResponse.redirect(new URL(role === 'admin' ? '/admin' : '/member', request.url))
  }

  // /admin・/member 内のナビゲーションはレイアウトがロール確認するためここでは不要

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}

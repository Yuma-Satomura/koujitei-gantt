import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
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

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  if (!user && pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && (pathname === '/login' || pathname === '/')) {
    const { data: kUser } = await supabase
      .from('koujitei_users')
      .select('role')
      .eq('id', user.id)
      .single()
    const role = kUser?.role ?? 'member'
    return NextResponse.redirect(new URL(role === 'admin' ? '/admin' : '/member', request.url))
  }

  if (user && (pathname.startsWith('/admin') || pathname.startsWith('/member'))) {
    const { data: kUser } = await supabase
      .from('koujitei_users')
      .select('role')
      .eq('id', user.id)
      .single()
    const role = kUser?.role ?? 'member'
    if (pathname.startsWith('/admin') && role !== 'admin') {
      return NextResponse.redirect(new URL('/member', request.url))
    }
    if (pathname === '/member' && role === 'admin') {
      return NextResponse.redirect(new URL('/admin', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}

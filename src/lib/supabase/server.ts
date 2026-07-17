import { cache } from 'react'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const createClient = cache(async () => {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
})

export const getUser = cache(async () => {
  const supabase = await createClient()
  // middlewareがgetUser()でセッション検証済みのため、server componentではgetSession()でOK
  // getSession()はローカルでJWT署名を検証するだけで認証サーバーへの通信なし
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user ?? null
})

export const getKoujiteiUser = cache(async () => {
  const user = await getUser()
  if (!user) return null
  const supabase = await createClient()
  const { data } = await supabase.from('koujitei_users').select('*').eq('id', user.id).single()
  return data
})

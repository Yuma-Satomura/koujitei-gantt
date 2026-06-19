'use server'

interface PendingResult {
  found: boolean
  name?: string
  role?: string
  color?: string
}

// Supabase REST API を直接呼び出す（サービスロールキーで RLS バイパス）
// スキーマキャッシュ不要・クライアント初期化不要で最も確実
export async function checkPendingUser(email: string): Promise<PendingResult> {
  if (!email || !email.includes('@')) return { found: false }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.log('[CPU] env missing:', { hasUrl: !!supabaseUrl, hasKey: !!serviceKey })
    return { found: false }
  }

  const normalized = email.toLowerCase().trim()
  const url = `${supabaseUrl}/rest/v1/koujitei_pending_users?email=eq.${encodeURIComponent(normalized)}&select=name,role,color`

  const res = await fetch(url, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    cache: 'no-store',
  })

  console.log('[CPU] status:', res.status, 'email:', normalized)

  if (!res.ok) {
    console.log('[CPU] error body:', await res.text())
    return { found: false }
  }

  const data = await res.json()
  console.log('[CPU] data:', JSON.stringify(data))

  if (!Array.isArray(data) || data.length === 0) return { found: false }
  return { found: true, name: data[0].name, role: data[0].role, color: data[0].color }
}

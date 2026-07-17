'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import GanttChart from '@/components/GanttChart'
import type { GanttGroup, KoujiteiUser } from '@/lib/types'

interface Props {
  groups: GanttGroup[]
  fiscalYear: number
  currentUser: KoujiteiUser
}

export default function MemberProjectsClient({ groups, fiscalYear, currentUser }: Props) {
  const router = useRouter()
  const refresh = useCallback(() => router.refresh(), [router])

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center gap-3 py-2.5 shrink-0"
        style={{ background: '#ffffff', borderBottom: '1px solid #dde1e7', paddingLeft: 56, paddingRight: 16 }}
      >
        <h2 className="text-sm font-bold" style={{ color: '#1a1d23' }}>マイ案件</h2>
        <div className="text-xs ml-2" style={{ color: '#9ca3af' }}>
          空セルをクリック→もう1度クリックで工程を登録 ／ バーをクリック→もう1度クリックで削除 ／ 出来高はクリックで編集
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {groups.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-3xl mb-3">📋</div>
              <div className="text-sm" style={{ color: '#9ca3af' }}>アサインされた案件はありません</div>
              <div className="text-xs mt-1" style={{ color: '#dde1e7' }}>管理者が案件を割り当てると表示されます</div>
            </div>
          </div>
        ) : (
          <GanttChart
            groups={groups}
            fiscalYear={fiscalYear}
            isAdmin={false}
            onDataChange={refresh}
          />
        )}
      </div>
    </div>
  )
}

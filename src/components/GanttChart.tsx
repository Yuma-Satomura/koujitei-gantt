'use client'

import { useMemo, useState, useCallback, useEffect } from 'react'
import type { GanttGroup, Period, GanttRow } from '@/lib/types'
import {
  dateToWeekIndex,
  weekIndexToDate,
  weekIndexToEndDate,
  toISODate,
  formatAmount,
  formatDate,
  MONTH_HEADERS,
} from '@/lib/gantt'
import { createClient } from '@/lib/supabase/client'

const WEEK_LABELS = ['①', '②', '③', '④']

interface GanttChartProps {
  groups: GanttGroup[]
  fiscalYear: number
  isAdmin?: boolean
  onDataChange?: () => void
  printRef?: React.RefObject<HTMLDivElement | null>
  halfYear?: 'first' | 'second'
  monthIndex?: number
  weekRangeOverride?: { start: number; end: number } // 印刷用：任意の週範囲
}

// 週インデックス範囲
function getWeekRange(half?: 'first' | 'second', monthIndex?: number, weekRangeOverride?: { start: number; end: number }) {
  if (weekRangeOverride) return weekRangeOverride
  if (monthIndex !== undefined) return { start: monthIndex * 4, end: monthIndex * 4 + 3 }
  if (half === 'first') return { start: 0, end: 23 }
  if (half === 'second') return { start: 24, end: 47 }
  return { start: 0, end: 47 }
}

export default function GanttChart({
  groups,
  fiscalYear,
  isAdmin = false,
  onDataChange,
  printRef,
  halfYear,
  monthIndex,
  weekRangeOverride,
}: GanttChartProps) {
  const supabase = createClient()
  const weekRange = getWeekRange(halfYear, monthIndex, weekRangeOverride)
  const weeks = Array.from({ length: weekRange.end - weekRange.start + 1 }, (_, i) => i + weekRange.start)

  // 楽観的UI用ローカルstate（サーバーrefresh前に即時反映）
  const [localGroups, setLocalGroups] = useState(groups)
  useEffect(() => { setLocalGroups(groups) }, [groups])

  // クリック入力ステート (担当者のみ)
  const [selecting, setSelecting] = useState<{
    assignmentId: string
    startWeek: number
    mode: 'create' | 'delete'
  } | null>(null)
  const [hoverWeek, setHoverWeek] = useState<number | null>(null)

  // 詳細モーダル
  const [detailRow, setDetailRow] = useState<GanttRow | null>(null)

  // 進捗編集
  const [editingProgress, setEditingProgress] = useState<{
    assignmentId: string
    value: string
  } | null>(null)

  const monthHeaders = useMemo(() => {
    return MONTH_HEADERS.filter(m => {
      const mEnd = m.start + m.span - 1
      return mEnd >= weekRange.start && m.start <= weekRange.end
    }).map(m => ({
      ...m,
      start: Math.max(m.start, weekRange.start) - weekRange.start,
      span: Math.min(m.start + m.span - 1, weekRange.end) - Math.max(m.start, weekRange.start) + 1,
    }))
  }, [weekRange])

  // セルクリック (担当者用) — 楽観的UI更新でラグなし
  const handleCellClick = useCallback((assignmentId: string, weekIdx: number, hasPeriod: boolean) => {
    if (isAdmin) return

    if (!selecting || selecting.assignmentId !== assignmentId) {
      setSelecting({ assignmentId, startWeek: weekIdx, mode: hasPeriod ? 'delete' : 'create' })
      return
    }

    const start = Math.min(selecting.startWeek, weekIdx)
    const end = Math.max(selecting.startWeek, weekIdx)
    const mode = selecting.mode

    // UI を即時更新（ラグなし）
    setSelecting(null)
    setHoverWeek(null)

    if (mode === 'delete') {
      setLocalGroups(prev => {
        const deleteIds = new Set<string>()
        const updateOps: { id: string; start_date?: string; end_date?: string }[] = []
        const insertOps: Omit<Period, 'id' | 'created_at'>[] = []
        const trimmedPeriods: Period[] = []

        prev.forEach(g => g.rows.forEach(r => {
          if (r.assignment.id !== assignmentId) return
          r.periods.forEach(p => {
            const ps = dateToWeekIndex(p.start_date, fiscalYear)
            const pe = dateToWeekIndex(p.end_date, fiscalYear)
            if (ps > end || pe < start) return // 重なりなし
            const keepBefore = ps < start
            const keepAfter  = pe > end
            if (!keepBefore && !keepAfter) {
              // 完全に範囲内 → 削除
              deleteIds.add(p.id)
            } else if (keepBefore && !keepAfter) {
              // 前にはみ出し → 終端をトリム
              const newEnd = toISODate(weekIndexToEndDate(start - 1, fiscalYear))
              updateOps.push({ id: p.id, end_date: newEnd })
              trimmedPeriods.push({ ...p, end_date: newEnd })
            } else if (!keepBefore && keepAfter) {
              // 後ろにはみ出し → 開始をトリム
              const newStart = toISODate(weekIndexToDate(end + 1, fiscalYear))
              updateOps.push({ id: p.id, start_date: newStart })
              trimmedPeriods.push({ ...p, start_date: newStart })
            } else {
              // 両側にはみ出し → 分割
              const newEnd   = toISODate(weekIndexToEndDate(start - 1, fiscalYear))
              const newStart = toISODate(weekIndexToDate(end + 1, fiscalYear))
              updateOps.push({ id: p.id, end_date: newEnd })
              insertOps.push({ assignment_id: p.assignment_id, start_date: newStart, end_date: p.end_date, sort_order: p.sort_order })
              trimmedPeriods.push({ ...p, end_date: newEnd })
              trimmedPeriods.push({ id: 'tmp-' + Date.now(), assignment_id: p.assignment_id, start_date: newStart, end_date: p.end_date, sort_order: p.sort_order, created_at: '' })
            }
          })
        }))

        if (deleteIds.size === 0 && updateOps.length === 0) return prev

        // UPDATE ポリシーがないため DELETE + INSERT で代替
        const allDeleteIds = new Set([...deleteIds, ...updateOps.map(op => op.id)])
        const allInserts = [
          ...updateOps.map(op => {
            const orig = prev.flatMap(g => g.rows.flatMap(r => r.periods)).find(p => p.id === op.id)!
            return { assignment_id: orig.assignment_id, start_date: op.start_date ?? orig.start_date, end_date: op.end_date ?? orig.end_date, sort_order: orig.sort_order }
          }),
          ...insertOps,
        ]

        // バックグラウンドでDB操作（削除してから再挿入）
        Promise.all([...allDeleteIds].map(id => supabase.from('koujitei_periods').delete().eq('id', id)))
          .then(() => Promise.all(allInserts.map(op => supabase.from('koujitei_periods').insert(op))))
          .then(() => onDataChange?.())

        // 楽観的ローカル更新
        return prev.map(g => ({
          ...g,
          rows: g.rows.map(r => {
            if (r.assignment.id !== assignmentId) return r
            const untouched = r.periods.filter(p => {
              const ps = dateToWeekIndex(p.start_date, fiscalYear)
              const pe = dateToWeekIndex(p.end_date, fiscalYear)
              return ps > end || pe < start
            })
            return { ...r, periods: [...untouched, ...trimmedPeriods] }
          }),
        }))
      })
    } else {
      const startDate = toISODate(weekIndexToDate(start, fiscalYear))
      const endDate = toISODate(weekIndexToEndDate(end, fiscalYear))
      const tempId = 'tmp-' + Date.now()
      // バーを即表示
      setLocalGroups(prev => prev.map(g => ({
        ...g,
        rows: g.rows.map(r => r.assignment.id === assignmentId
          ? { ...r, periods: [...r.periods, { id: tempId, assignment_id: assignmentId, start_date: startDate, end_date: endDate, sort_order: 1, created_at: '' }] }
          : r
        ),
      })))
      // バックグラウンドでDB保存（成否に関わらずrefreshでローカル状態を同期）
      supabase.from('koujitei_periods').insert({
        assignment_id: assignmentId,
        start_date: startDate,
        end_date: endDate,
        sort_order: 1,
      }).then(() => onDataChange?.())
    }
  }, [selecting, isAdmin, fiscalYear, supabase, onDataChange])

  const handleProgressBlur = useCallback((assignmentId: string, value: string) => {
    const num = Math.max(0, Math.min(100, parseFloat(value) || 0))
    // 即時反映
    setLocalGroups(prev => prev.map(g => ({
      ...g,
      rows: g.rows.map(r => r.assignment.id === assignmentId
        ? { ...r, assignment: { ...r.assignment, progress: num } }
        : r
      ),
    })))
    setEditingProgress(null)
    // バックグラウンドでDB保存
    supabase.from('koujitei_assignments').update({ progress: num }).eq('id', assignmentId)
      .then(() => onDataChange?.())
  }, [supabase, onDataChange])

  const handleCompleteToggle = useCallback((assignmentId: string, current: boolean) => {
    const next = !current
    setLocalGroups(prev => prev.map(g => ({
      ...g,
      rows: g.rows.map(r => r.assignment.id === assignmentId
        ? { ...r, assignment: { ...r.assignment, is_complete_this_month: next } }
        : r
      ),
    })))
    supabase.from('koujitei_assignments').update({ is_complete_this_month: next }).eq('id', assignmentId)
      .then(() => onDataChange?.())
  }, [supabase, onDataChange])

  return (
    <div ref={printRef} className="overflow-x-auto" style={{ background: '#f4f6f9' }}>
      <table
        style={{
          borderCollapse: 'collapse',
          fontSize: '11px',
          whiteSpace: 'nowrap',
          width: '100%',
        }}
      >
        {/* ヘッダー */}
        <thead>
          <tr>
            {/* 固定列ヘッダー */}
            {['担当', '設計', '営業', '外注管理', '工番', '納入先', '件名', '出来高', '今月完了', '納期', '請負額(K)', '施工地'].map(h => (
              <th
                key={h}
                rowSpan={2}
                style={{
                  padding: '4px 4px',
                  background: '#f8f9fa',
                  color: '#6b7280',
                  fontWeight: 600,
                  fontSize: '10px',
                  borderBottom: '1px solid #dde1e7',
                  borderRight: '1px solid #dde1e7',
                  position: 'sticky',
                  top: 0,
                  zIndex: 20,
                  textAlign: 'left',
                  minWidth: h === '件名' ? 88 : h === '担当' ? 36 : h === '納入先' ? 52 : h === '請負額(K)' ? 44 : h === '出来高' ? 34 : h === '今月完了' ? 34 : 30,
                }}
              >
                {h}
              </th>
            ))}
            {/* 月ヘッダー */}
            {monthHeaders.map(m => (
              <th
                key={m.label}
                colSpan={m.span}
                style={{
                  padding: '4px 0',
                  background: '#f8f9fa',
                  color: '#1a1d23',
                  fontWeight: 700,
                  fontSize: '10px',
                  textAlign: 'center',
                  border: '1px solid #dde1e7',
                  position: 'sticky',
                  top: 0,
                  zIndex: 20,
                }}
              >
                {m.label}
              </th>
            ))}
          </tr>
          <tr>
            {weeks.map(w => (
              <th
                key={w}
                style={{
                  padding: '3px 0',
                  background: '#ffffff',
                  color: '#9ca3af',
                  fontSize: '9px',
                  textAlign: 'center',
                  border: '1px solid #dde1e7',
                  minWidth: 24,
                  width: 24,
                  position: 'sticky',
                  top: 24,
                  zIndex: 20,
                }}
              >
                {WEEK_LABELS[w % 4]}
              </th>
            ))}
          </tr>
        </thead>

        {/* ボディ */}
        <tbody>
          {localGroups.map((group, gi) => (
            group.rows.map((row, ri) => {
              const isFirstInGroup = ri === 0
              const isLastInGroup = ri === group.rows.length - 1

              return (
                <tr
                  key={row.assignment.id}
                  style={{
                    borderTop: isFirstInGroup ? '2px solid #dde1e7' : '1px solid #f8f9fa',
                  }}
                >
                  {/* 担当列 (グループの最初の行のみ表示) */}
                  {isFirstInGroup ? (
                    <td
                      rowSpan={group.rows.length}
                      style={{
                        padding: '4px 5px',
                        background: '#ffffff',
                        color: '#1a1d23',
                        fontWeight: 700,
                        borderRight: '1px solid #dde1e7',
                        verticalAlign: 'middle',
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-block',
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: group.member.color,
                          marginRight: 5,
                        }}
                      />
                      {group.member.name}
                    </td>
                  ) : null}

                  {/* 固定列 */}
                  <FixedCell>{row.project.sekkei}</FixedCell>
                  <FixedCell>{row.project.eigyo}</FixedCell>
                  <FixedCell>{row.project.gaichuu}</FixedCell>
                  <FixedCell>{row.project.kouban}</FixedCell>
                  <FixedCell style={{ maxWidth: 52, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {row.project.client_name}
                  </FixedCell>

                  {/* 件名：クリックで詳細 */}
                  <td
                    onClick={() => setDetailRow(row)}
                    style={{
                      padding: '4px 5px',
                      background: '#ffffff',
                      color: '#1a1d23',
                      borderRight: '1px solid #dde1e7',
                      maxWidth: 88,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      cursor: 'pointer',
                    }}
                    title={row.project.project_name}
                  >
                    {row.project.project_name}
                  </td>

                  {/* 出来高 */}
                  <td
                    style={{
                      padding: '4px 2px',
                      background: '#ffffff',
                      color: '#1a1d23',
                      borderRight: '1px solid #dde1e7',
                      textAlign: 'center',
                      minWidth: 34,
                    }}
                    onClick={() => !isAdmin && setEditingProgress({ assignmentId: row.assignment.id, value: String(row.assignment.progress) })}
                  >
                    {editingProgress?.assignmentId === row.assignment.id ? (
                      <input
                        autoFocus
                        type="number"
                        min={0}
                        max={100}
                        value={editingProgress.value}
                        onChange={e => setEditingProgress({ ...editingProgress, value: e.target.value })}
                        onBlur={e => handleProgressBlur(row.assignment.id, e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleProgressBlur(row.assignment.id, editingProgress.value)}
                        style={{
                          width: 36,
                          background: '#f8f9fa',
                          border: '1px solid #4a7fff',
                          color: '#1a1d23',
                          borderRadius: 4,
                          padding: '1px 2px',
                          fontSize: 11,
                          textAlign: 'center',
                        }}
                      />
                    ) : (
                      <span style={{ color: row.assignment.progress > 0 ? '#4a7fff' : '#9ca3af' }}>
                        {row.assignment.progress}%
                      </span>
                    )}
                  </td>

                  {/* 今月完了 */}
                  <td
                    style={{
                      padding: '4px 2px',
                      background: '#ffffff',
                      borderRight: '1px solid #dde1e7',
                      textAlign: 'center',
                      cursor: isAdmin ? 'default' : 'pointer',
                    }}
                    onClick={() => !isAdmin && handleCompleteToggle(row.assignment.id, row.assignment.is_complete_this_month)}
                    title={isAdmin ? '' : 'クリックで切り替え'}
                  >
                    {row.assignment.is_complete_this_month ? (
                      <span style={{ color: '#2ecc71', fontWeight: 700 }}>✓</span>
                    ) : (
                      <span style={{ color: '#dde1e7' }}>—</span>
                    )}
                  </td>

                  {/* 納期 */}
                  <FixedCell style={{ fontSize: 10 }}>{formatDate(row.project.deadline)}</FixedCell>

                  {/* 請負額 */}
                  <FixedCell style={{ textAlign: 'right', fontSize: 10 }}>
                    {formatAmount(row.project.contract_amount)}
                  </FixedCell>

                  {/* 施工地 */}
                  <FixedCell style={{ fontSize: 10, maxWidth: 44, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {row.project.location}
                  </FixedCell>

                  {/* 週セル */}
                  {weeks.map(w => {
                    const coveredPeriods = row.periods.filter(p => {
                      const s = dateToWeekIndex(p.start_date, fiscalYear)
                      const e = dateToWeekIndex(p.end_date, fiscalYear)
                      return w >= s && w <= e
                    })
                    const isSelecting = selecting?.assignmentId === row.assignment.id
                    const isDeleteMode = isSelecting && selecting!.mode === 'delete'
                    const isHovered = isSelecting && hoverWeek !== null && w >= Math.min(selecting!.startWeek, hoverWeek) && w <= Math.max(selecting!.startWeek, hoverWeek)
                    const isStart = selecting?.assignmentId === row.assignment.id && selecting.startWeek === w

                    return (
                      <td
                        key={w}
                        className="gantt-cell"
                        onMouseEnter={() => isSelecting && setHoverWeek(w)}
                        onMouseLeave={() => isSelecting && setHoverWeek(null)}
                        onClick={() => !isAdmin && handleCellClick(row.assignment.id, w, coveredPeriods.length > 0)}
                        style={{
                          cursor: isAdmin ? 'default' : (isDeleteMode ? 'crosshair' : 'pointer'),
                          border: isDeleteMode && isHovered ? '1px solid rgba(231,76,60,0.4)' : '1px solid #f8f9fa',
                          background: isStart
                            ? (isDeleteMode ? 'rgba(231,76,60,0.12)' : 'rgba(74,127,255,0.15)')
                            : undefined,
                          position: 'relative',
                        }}
                      >
                        {/* 既存工程バー */}
                        {coveredPeriods.map(p => {
                          const s = dateToWeekIndex(p.start_date, fiscalYear)
                          const e = dateToWeekIndex(p.end_date, fiscalYear)
                          const isBarStart = w === s
                          const isBarEnd = w === e
                          // 削除モード：選択済みセルとホバー範囲を赤く表示
                          const showDeleteColor = isDeleteMode && (isStart || isHovered)
                          return (
                            <div
                              key={p.id}
                              className="gantt-bar"
                              style={{
                                left: isBarStart ? 2 : 0,
                                right: isBarEnd ? 2 : 0,
                                background: showDeleteColor ? '#e74c3c' : group.member.color,
                                opacity: showDeleteColor ? 0.75 : 0.85,
                                borderRadius: `${isBarStart ? 3 : 0}px ${isBarEnd ? 3 : 0}px ${isBarEnd ? 3 : 0}px ${isBarStart ? 3 : 0}px`,
                              }}
                              title={`${p.start_date} 〜 ${p.end_date}`}
                            />
                          )
                        })}

                        {/* 選択プレビューバー（作成モードのみ、空セル） */}
                        {isHovered && !isDeleteMode && coveredPeriods.length === 0 && (
                          <div
                            className="gantt-bar"
                            style={{
                              left: 0, right: 0,
                              background: group.member.color,
                              opacity: 0.4,
                              borderRadius: 3,
                            }}
                          />
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })
          ))}
        </tbody>
      </table>

      {/* 詳細モーダル */}
      {detailRow && (
        <DetailModal row={detailRow} onClose={() => setDetailRow(null)} />
      )}
    </div>
  )
}

function FixedCell({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <td
      style={{
        padding: '4px 5px',
        background: '#ffffff',
        color: '#1a1d23',
        borderRight: '1px solid #dde1e7',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children ?? ''}
    </td>
  )
}

function DetailModal({ row, onClose }: { row: GanttRow; onClose: () => void }) {
  const fields: [string, string | number | null][] = [
    ['工番', row.project.kouban],
    ['納入先', row.project.client_name],
    ['件名', row.project.project_name],
    ['設計担当', row.project.sekkei],
    ['営業担当', row.project.eigyo],
    ['外注管理', row.project.gaichuu],
    ['施工地', row.project.location],
    ['請負額', row.project.contract_amount ? `${row.project.contract_amount.toLocaleString()}K円` : null],
    ['納期', row.project.deadline],
    ['出来高', `${row.assignment.progress}%`],
    ['今月完了', row.assignment.is_complete_this_month ? '✓ 完了' : '未完了'],
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <div
        className="rounded-xl p-6 w-full max-w-md"
        style={{ background: '#ffffff', border: '1px solid #dde1e7' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-sm" style={{ color: '#1a1d23' }}>案件詳細</h3>
          <button onClick={onClose} style={{ color: '#9ca3af', fontSize: 18 }}>×</button>
        </div>
        <div className="space-y-2">
          {fields.map(([label, value]) => value != null && value !== '' && (
            <div key={label} className="flex gap-3 text-sm">
              <span className="w-20 shrink-0 text-xs" style={{ color: '#6b7280' }}>{label}</span>
              <span style={{ color: '#1a1d23' }}>{value}</span>
            </div>
          ))}
        </div>
        {row.periods.length > 0 && (
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid #dde1e7' }}>
            <div className="text-xs font-medium mb-2" style={{ color: '#6b7280' }}>工程</div>
            {row.periods.map(p => (
              <div key={p.id} className="text-xs py-1" style={{ color: '#1a1d23' }}>
                {p.start_date} 〜 {p.end_date}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

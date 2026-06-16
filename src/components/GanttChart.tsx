'use client'

import { useMemo, useState, useCallback, useRef } from 'react'
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
}

// 週インデックス範囲：前半(0-23) / 後半(24-47)
function getWeekRange(half?: 'first' | 'second') {
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
}: GanttChartProps) {
  const supabase = createClient()
  const weekRange = getWeekRange(halfYear)
  const weeks = Array.from({ length: weekRange.end - weekRange.start + 1 }, (_, i) => i + weekRange.start)

  // クリック入力ステート (担当者のみ)
  const [selecting, setSelecting] = useState<{
    assignmentId: string
    startWeek: number
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

  // セルクリック (担当者用)
  const handleCellClick = useCallback(async (assignmentId: string, weekIdx: number) => {
    if (isAdmin) return

    if (!selecting || selecting.assignmentId !== assignmentId) {
      setSelecting({ assignmentId, startWeek: weekIdx })
      return
    }

    const start = Math.min(selecting.startWeek, weekIdx)
    const end = Math.max(selecting.startWeek, weekIdx)
    const startDate = toISODate(weekIndexToDate(start, fiscalYear))
    const endDate = toISODate(weekIndexToEndDate(end, fiscalYear))

    const { error } = await supabase.from('koujitei_periods').insert({
      assignment_id: assignmentId,
      start_date: startDate,
      end_date: endDate,
      sort_order: 1,
    })

    if (!error) onDataChange?.()
    setSelecting(null)
    setHoverWeek(null)
  }, [selecting, isAdmin, fiscalYear, supabase, onDataChange])

  const handleDeletePeriod = useCallback(async (periodId: string) => {
    await supabase.from('koujitei_periods').delete().eq('id', periodId)
    onDataChange?.()
  }, [supabase, onDataChange])

  const handleProgressBlur = useCallback(async (assignmentId: string, value: string) => {
    const num = Math.max(0, Math.min(100, parseFloat(value) || 0))
    await supabase
      .from('koujitei_assignments')
      .update({ progress: num })
      .eq('id', assignmentId)
    setEditingProgress(null)
    onDataChange?.()
  }, [supabase, onDataChange])

  const handleCompleteToggle = useCallback(async (assignmentId: string, current: boolean) => {
    await supabase
      .from('koujitei_assignments')
      .update({ is_complete_this_month: !current })
      .eq('id', assignmentId)
    onDataChange?.()
  }, [supabase, onDataChange])

  return (
    <div ref={printRef} className="overflow-x-auto" style={{ background: '#0f0f0f' }}>
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
                  padding: '6px 8px',
                  background: '#1e1e1e',
                  color: '#888',
                  fontWeight: 600,
                  fontSize: '10px',
                  borderBottom: '1px solid #333',
                  borderRight: '1px solid #2a2a2a',
                  position: 'sticky',
                  top: 0,
                  zIndex: 20,
                  textAlign: 'left',
                  minWidth: h === '件名' ? 120 : h === '担当' ? 48 : h === '納入先' ? 64 : h === '請負額(K)' ? 56 : 40,
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
                  background: '#1e1e1e',
                  color: '#e8e6e0',
                  fontWeight: 700,
                  fontSize: '10px',
                  textAlign: 'center',
                  border: '1px solid #2a2a2a',
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
                  background: '#161616',
                  color: '#555',
                  fontSize: '9px',
                  textAlign: 'center',
                  border: '1px solid #2a2a2a',
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
          {groups.map((group, gi) => (
            group.rows.map((row, ri) => {
              const isFirstInGroup = ri === 0
              const isLastInGroup = ri === group.rows.length - 1

              return (
                <tr
                  key={row.assignment.id}
                  style={{
                    borderTop: isFirstInGroup ? '2px solid #2a2a2a' : '1px solid #1e1e1e',
                  }}
                >
                  {/* 担当列 (グループの最初の行のみ表示) */}
                  {isFirstInGroup ? (
                    <td
                      rowSpan={group.rows.length}
                      style={{
                        padding: '5px 8px',
                        background: '#161616',
                        color: '#e8e6e0',
                        fontWeight: 700,
                        borderRight: '1px solid #2a2a2a',
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
                  <FixedCell style={{ maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {row.project.client_name}
                  </FixedCell>

                  {/* 件名：クリックで詳細 */}
                  <td
                    onClick={() => setDetailRow(row)}
                    style={{
                      padding: '5px 8px',
                      background: '#161616',
                      color: '#e8e6e0',
                      borderRight: '1px solid #2a2a2a',
                      maxWidth: 120,
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
                      padding: '5px 4px',
                      background: '#161616',
                      color: '#e8e6e0',
                      borderRight: '1px solid #2a2a2a',
                      textAlign: 'center',
                      minWidth: 40,
                    }}
                    onDoubleClick={() => !isAdmin && setEditingProgress({ assignmentId: row.assignment.id, value: String(row.assignment.progress) })}
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
                          background: '#1e1e1e',
                          border: '1px solid #4a7fff',
                          color: '#e8e6e0',
                          borderRadius: 4,
                          padding: '1px 2px',
                          fontSize: 11,
                          textAlign: 'center',
                        }}
                      />
                    ) : (
                      <span style={{ color: row.assignment.progress > 0 ? '#4a7fff' : '#555' }}>
                        {row.assignment.progress}%
                      </span>
                    )}
                  </td>

                  {/* 今月完了 */}
                  <td
                    style={{
                      padding: '5px 4px',
                      background: '#161616',
                      borderRight: '1px solid #2a2a2a',
                      textAlign: 'center',
                      cursor: isAdmin ? 'default' : 'pointer',
                    }}
                    onClick={() => !isAdmin && handleCompleteToggle(row.assignment.id, row.assignment.is_complete_this_month)}
                    title={isAdmin ? '' : 'クリックで切り替え'}
                  >
                    {row.assignment.is_complete_this_month ? (
                      <span style={{ color: '#2ecc71', fontWeight: 700 }}>✓</span>
                    ) : (
                      <span style={{ color: '#333' }}>—</span>
                    )}
                  </td>

                  {/* 納期 */}
                  <FixedCell style={{ fontSize: 10 }}>{formatDate(row.project.deadline)}</FixedCell>

                  {/* 請負額 */}
                  <FixedCell style={{ textAlign: 'right', fontSize: 10 }}>
                    {formatAmount(row.project.contract_amount)}
                  </FixedCell>

                  {/* 施工地 */}
                  <FixedCell style={{ fontSize: 10, maxWidth: 56, overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
                    const isHovered = isSelecting && hoverWeek !== null && w >= Math.min(selecting!.startWeek, hoverWeek) && w <= Math.max(selecting!.startWeek, hoverWeek)
                    const isStart = selecting?.assignmentId === row.assignment.id && selecting.startWeek === w

                    return (
                      <td
                        key={w}
                        className="gantt-cell"
                        onMouseEnter={() => isSelecting && setHoverWeek(w)}
                        onMouseLeave={() => isSelecting && setHoverWeek(null)}
                        onClick={() => !isAdmin && handleCellClick(row.assignment.id, w)}
                        style={{
                          cursor: isAdmin ? 'default' : 'pointer',
                          border: '1px solid #1e1e1e',
                          background: isStart ? 'rgba(74,127,255,0.15)' : undefined,
                          position: 'relative',
                        }}
                      >
                        {/* 既存工程バー */}
                        {coveredPeriods.map(p => {
                          const s = dateToWeekIndex(p.start_date, fiscalYear)
                          const e = dateToWeekIndex(p.end_date, fiscalYear)
                          const isBarStart = w === s
                          const isBarEnd = w === e
                          return (
                            <div
                              key={p.id}
                              className="gantt-bar"
                              style={{
                                left: isBarStart ? 2 : 0,
                                right: isBarEnd ? 2 : 0,
                                background: group.member.color,
                                borderRadius: `${isBarStart ? 3 : 0}px ${isBarEnd ? 3 : 0}px ${isBarEnd ? 3 : 0}px ${isBarStart ? 3 : 0}px`,
                              }}
                              title={`${p.start_date} 〜 ${p.end_date}`}
                              onDoubleClick={e => {
                                e.stopPropagation()
                                if (!isAdmin) handleDeletePeriod(p.id)
                              }}
                            />
                          )
                        })}

                        {/* 選択プレビューバー */}
                        {isHovered && coveredPeriods.length === 0 && (
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
        padding: '5px 8px',
        background: '#161616',
        color: '#e8e6e0',
        borderRight: '1px solid #2a2a2a',
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
        style={{ background: '#161616', border: '1px solid #2a2a2a' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-sm" style={{ color: '#e8e6e0' }}>案件詳細</h3>
          <button onClick={onClose} style={{ color: '#555', fontSize: 18 }}>×</button>
        </div>
        <div className="space-y-2">
          {fields.map(([label, value]) => value != null && value !== '' && (
            <div key={label} className="flex gap-3 text-sm">
              <span className="w-20 shrink-0 text-xs" style={{ color: '#888' }}>{label}</span>
              <span style={{ color: '#e8e6e0' }}>{value}</span>
            </div>
          ))}
        </div>
        {row.periods.length > 0 && (
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid #2a2a2a' }}>
            <div className="text-xs font-medium mb-2" style={{ color: '#888' }}>工程</div>
            {row.periods.map(p => (
              <div key={p.id} className="text-xs py-1" style={{ color: '#e8e6e0' }}>
                {p.start_date} 〜 {p.end_date}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

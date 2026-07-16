import { describe, it, expect } from 'vitest'
import { mergeGroupsWithOverrides } from './gantt-merge'
import type { GanttGroup, Period } from './types'

const makePeriod = (overrides: Partial<Period> = {}): Period => ({
  id: 'p1',
  assignment_id: 'a1',
  start_date: '2026-04-01',
  end_date: '2026-04-07',
  sort_order: 1,
  memo: null,
  created_at: '',
  ...overrides,
})

const makeGroup = (assignmentId: string, periods: Period[]): GanttGroup => ({
  member: { id: 'u1', name: '田中', role: 'member', color: '#4a7fff', created_at: '' },
  rows: [{
    assignment: { id: assignmentId, project_id: 'proj1', user_id: 'u1', progress: 0, is_complete_this_month: false, created_at: '' },
    project: { id: 'proj1', kouban: null, client_name: 'A社', project_name: '工事', sekkei: null, eigyo: null, gaichuu: null, location: null, contract_amount: null, deadline: null, fiscal_year: 2026, created_at: '' },
    member: { id: 'u1', name: '田中', role: 'member', color: '#4a7fff', created_at: '' },
    periods,
  }],
})

describe('mergeGroupsWithOverrides', () => {
  describe('変更なし（dirtyもpendingもない）', () => {
    it('serverGroupsをそのまま返す', () => {
      const server = [makeGroup('a1', [makePeriod()])]
      const result = mergeGroupsWithOverrides(server, new Map(), server)
      expect(result).toBe(server) // 参照同一（shallow equal）
    })
  })

  describe('dirtyMemos の適用', () => {
    it('dirty対象のperiodにメモが上書きされる', () => {
      const period = makePeriod({ id: 'p1', memo: null })
      const server = [makeGroup('a1', [period])]
      const dirty = new Map([['p1', '準備工事']])
      const result = mergeGroupsWithOverrides(server, dirty, server)
      expect(result[0].rows[0].periods[0].memo).toBe('準備工事')
    })

    it('dirty対象外のperiodは変更されない', () => {
      const p1 = makePeriod({ id: 'p1', memo: null })
      const p2 = makePeriod({ id: 'p2', memo: '既存メモ' })
      const server = [makeGroup('a1', [p1, p2])]
      const dirty = new Map([['p1', '新しいメモ']])
      const result = mergeGroupsWithOverrides(server, dirty, server)
      expect(result[0].rows[0].periods[1].memo).toBe('既存メモ')
    })

    it('nullメモ（削除）も正しく適用される', () => {
      const period = makePeriod({ id: 'p1', memo: '削除予定' })
      const server = [makeGroup('a1', [period])]
      const dirty = new Map<string, string | null>([['p1', null]])
      const result = mergeGroupsWithOverrides(server, dirty, server)
      expect(result[0].rows[0].periods[0].memo).toBeNull()
    })
  })

  describe('pendingバーの保持', () => {
    it('prevGroupsのpendingバーがserverGroupsに追加される', () => {
      const realPeriod = makePeriod({ id: 'p1' })
      const pendingPeriod = makePeriod({ id: 'tmp-123', pending: true })
      const server = [makeGroup('a1', [realPeriod])]
      const prev = [makeGroup('a1', [realPeriod, pendingPeriod])]
      const result = mergeGroupsWithOverrides(server, new Map(), prev)
      const periods = result[0].rows[0].periods
      expect(periods).toHaveLength(2)
      expect(periods.some(p => p.id === 'tmp-123' && p.pending)).toBe(true)
    })

    it('pendingでないバーはprevから引き継がれない', () => {
      const realPeriod = makePeriod({ id: 'p1' })
      const server = [makeGroup('a1', [realPeriod])]
      const prev = [makeGroup('a1', [realPeriod, makePeriod({ id: 'p2', pending: false })])]
      const result = mergeGroupsWithOverrides(server, new Map(), prev)
      expect(result[0].rows[0].periods).toHaveLength(1)
    })

    it('router.refresh()がINSERT完了前に終わってもpendingバーが消えない', () => {
      const pendingPeriod = makePeriod({ id: 'tmp-456', pending: true })
      // serverGroupsはDBの最新（pendingバーなし）
      const server = [makeGroup('a1', [])]
      // prevGroupsはpendingバーを持つ
      const prev = [makeGroup('a1', [pendingPeriod])]
      const result = mergeGroupsWithOverrides(server, new Map(), prev)
      expect(result[0].rows[0].periods).toHaveLength(1)
      expect(result[0].rows[0].periods[0].id).toBe('tmp-456')
    })
  })

  describe('dirtyMemos と pendingバーの組み合わせ', () => {
    it('両方が同時に適用される', () => {
      const realPeriod = makePeriod({ id: 'p1', memo: null })
      const pendingPeriod = makePeriod({ id: 'tmp-789', pending: true })
      const server = [makeGroup('a1', [realPeriod])]
      const prev = [makeGroup('a1', [realPeriod, pendingPeriod])]
      const dirty = new Map([['p1', '試運転調整']])
      const result = mergeGroupsWithOverrides(server, dirty, prev)
      const periods = result[0].rows[0].periods
      expect(periods).toHaveLength(2)
      expect(periods.find(p => p.id === 'p1')?.memo).toBe('試運転調整')
      expect(periods.find(p => p.id === 'tmp-789')?.pending).toBe(true)
    })
  })

  describe('複数グループ', () => {
    it('異なるassignment_idのpendingバーが正しく振り分けられる', () => {
      const pending1 = makePeriod({ id: 'tmp-1', assignment_id: 'a1', pending: true })
      const pending2 = makePeriod({ id: 'tmp-2', assignment_id: 'a2', pending: true })
      const server = [makeGroup('a1', []), makeGroup('a2', [])]
      const prev = [makeGroup('a1', [pending1]), makeGroup('a2', [pending2])]
      const result = mergeGroupsWithOverrides(server, new Map(), prev)
      expect(result[0].rows[0].periods[0].id).toBe('tmp-1')
      expect(result[1].rows[0].periods[0].id).toBe('tmp-2')
    })
  })
})

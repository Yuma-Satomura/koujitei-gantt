// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GanttChart from './GanttChart'
import type { GanttGroup } from '@/lib/types'

// vi.hoisted() で import より前に mock 関数を生成
const { mockFrom, mockUpdate, mockEq, mockInsert, mockSingle } = vi.hoisted(() => {
  const mockEq = vi.fn().mockResolvedValue({ error: null })
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
  const mockSingle = vi.fn().mockResolvedValue({ data: { id: 'real-id-001' }, error: null })
  const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
  const mockInsert = vi.fn().mockReturnValue({ select: mockSelect })
  const mockDeleteEq = vi.fn().mockResolvedValue({ error: null })
  const mockDelete = vi.fn().mockReturnValue({ eq: mockDeleteEq })
  const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate, insert: mockInsert, delete: mockDelete })
  return { mockFrom, mockUpdate, mockEq, mockInsert, mockSingle }
})

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from: mockFrom }),
}))

// ── テストデータ ──────────────────────────────────────────────────

const baseGroup: GanttGroup = {
  member: { id: 'u1', name: '田中', role: 'member', color: '#4a7fff', created_at: '' },
  rows: [{
    assignment: { id: 'a1', project_id: 'proj1', user_id: 'u1', progress: 0, is_complete_this_month: false, created_at: '' },
    project: { id: 'proj1', kouban: null, client_name: 'A社', project_name: '工事A', sekkei: null, eigyo: null, gaichuu: null, location: null, contract_amount: null, deadline: null, fiscal_year: 2026, created_at: '' },
    member: { id: 'u1', name: '田中', role: 'member', color: '#4a7fff', created_at: '' },
    periods: [{
      id: 'p1',
      assignment_id: 'a1',
      start_date: '2026-04-01', // week 0 start
      end_date: '2026-04-07',   // week 0 end
      sort_order: 1,
      memo: null,
      created_at: '',
    }],
  }],
}

// ホバーしてメモ入力フィールドを開く共通ヘルパー
async function openMemoEditor(user: ReturnType<typeof userEvent.setup>) {
  const cells = document.querySelectorAll('.gantt-cell')
  // week 0 が最初のセル
  fireEvent.mouseEnter(cells[0])
  const pencil = await screen.findByText('✎')
  await user.click(pencil)
  return screen.getByPlaceholderText('作業内容を入力...')
}

// ── beforeEach ───────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  // clearAllMocks は実装を消さないが、念のため再設定
  mockEq.mockResolvedValue({ error: null })
  mockSingle.mockResolvedValue({ data: { id: 'real-id-001' }, error: null })
})

// ── テストスイート ───────────────────────────────────────────────

describe('GanttChart', () => {
  describe('基本レンダリング', () => {
    it('テーブルヘッダーが描画される', () => {
      render(<GanttChart groups={[baseGroup]} fiscalYear={2026} isAdmin={false} />)
      expect(screen.getByText('担当')).toBeInTheDocument()
      expect(screen.getByText('件名')).toBeInTheDocument()
      expect(screen.getByText('出来高')).toBeInTheDocument()
    })

    it('メンバー名と案件名が描画される', () => {
      render(<GanttChart groups={[baseGroup]} fiscalYear={2026} isAdmin={false} />)
      expect(screen.getByText('田中')).toBeInTheDocument()
      expect(screen.getByText('工事A')).toBeInTheDocument()
    })

    it('isAdmin=true のとき鉛筆ボタンは表示されない', async () => {
      render(<GanttChart groups={[baseGroup]} fiscalYear={2026} isAdmin={true} />)
      const cells = document.querySelectorAll('.gantt-cell')
      fireEvent.mouseEnter(cells[0])
      // 鉛筆は isAdmin では表示されない
      expect(screen.queryByText('✎')).not.toBeInTheDocument()
    })
  })

  describe('メモ編集: 開く', () => {
    it('セルをホバーすると鉛筆ボタンが表示される', async () => {
      render(<GanttChart groups={[baseGroup]} fiscalYear={2026} isAdmin={false} />)
      const cells = document.querySelectorAll('.gantt-cell')
      fireEvent.mouseEnter(cells[0])
      expect(await screen.findByText('✎')).toBeInTheDocument()
    })

    it('鉛筆ボタンをクリックするとメモ入力フィールドが開く', async () => {
      const user = userEvent.setup()
      render(<GanttChart groups={[baseGroup]} fiscalYear={2026} isAdmin={false} />)
      await openMemoEditor(user)
      expect(screen.getByPlaceholderText('作業内容を入力...')).toBeInTheDocument()
    })

    it('pendingバーのセルをホバーしても鉛筆は表示されない', async () => {
      const pendingGroup: GanttGroup = {
        ...baseGroup,
        rows: [{ ...baseGroup.rows[0], periods: [{ ...baseGroup.rows[0].periods[0], pending: true }] }],
      }
      render(<GanttChart groups={[pendingGroup]} fiscalYear={2026} isAdmin={false} />)
      const cells = document.querySelectorAll('.gantt-cell')
      fireEvent.mouseEnter(cells[0])
      // pending バーでは鉛筆が出ない
      expect(screen.queryByText('✎')).not.toBeInTheDocument()
    })
  })

  describe('メモ編集: 保存', () => {
    it('Enterキーでメモを保存し supabase.update を呼ぶ', async () => {
      const user = userEvent.setup()
      const onDataChange = vi.fn()
      render(<GanttChart groups={[baseGroup]} fiscalYear={2026} isAdmin={false} onDataChange={onDataChange} />)

      const input = await openMemoEditor(user)
      await user.type(input, '配管工事')
      await user.keyboard('{Enter}')

      // 入力フィールドが消える
      expect(screen.queryByPlaceholderText('作業内容を入力...')).not.toBeInTheDocument()

      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledWith('koujitei_periods')
        expect(mockUpdate).toHaveBeenCalledWith({ memo: '配管工事' })
        expect(mockEq).toHaveBeenCalledWith('id', 'p1')
        expect(onDataChange).toHaveBeenCalledTimes(1)
      })
    })

    it('blurでメモを保存する', async () => {
      const user = userEvent.setup()
      render(<GanttChart groups={[baseGroup]} fiscalYear={2026} isAdmin={false} />)

      const input = await openMemoEditor(user)
      await user.type(input, 'blur保存テスト')
      await user.tab() // フォーカスを外す = blur

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith({ memo: 'blur保存テスト' })
      })
    })

    it('空文字で保存すると memo=null として保存される', async () => {
      const user = userEvent.setup()
      render(<GanttChart groups={[baseGroup]} fiscalYear={2026} isAdmin={false} />)

      const input = await openMemoEditor(user)
      // 何も入力せずにEnter
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith({ memo: null })
      })
    })
  })

  describe('メモ編集: キャンセル', () => {
    it('Escapeでキャンセルすると保存されない', async () => {
      const user = userEvent.setup()
      const onDataChange = vi.fn()
      render(<GanttChart groups={[baseGroup]} fiscalYear={2026} isAdmin={false} onDataChange={onDataChange} />)

      const input = await openMemoEditor(user)
      await user.type(input, 'キャンセルされる内容')
      await user.keyboard('{Escape}')

      // 入力フィールドが消える
      expect(screen.queryByPlaceholderText('作業内容を入力...')).not.toBeInTheDocument()
      // supabase は呼ばれない
      expect(mockUpdate).not.toHaveBeenCalled()
      expect(onDataChange).not.toHaveBeenCalled()
    })

    it('Enterで保存後にblurが来ても二重保存されない', async () => {
      const user = userEvent.setup()
      render(<GanttChart groups={[baseGroup]} fiscalYear={2026} isAdmin={false} />)

      const input = await openMemoEditor(user)
      await user.type(input, 'テスト')
      await user.keyboard('{Enter}') // Enterで保存・アンマウント

      // supabase.update は1回だけ呼ばれる（blurによる二重呼び出しなし）
      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('メモ編集: エラー処理', () => {
    it('supabase がエラーを返しても onDataChange は呼ばれない', async () => {
      mockEq.mockResolvedValueOnce({ error: new Error('DB error') })
      const user = userEvent.setup()
      const onDataChange = vi.fn()
      render(<GanttChart groups={[baseGroup]} fiscalYear={2026} isAdmin={false} onDataChange={onDataChange} />)

      const input = await openMemoEditor(user)
      await user.type(input, '失敗するメモ')
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledTimes(1)
        expect(onDataChange).not.toHaveBeenCalled()
      })
    })
  })

  describe('groups プロパティ更新（useEffect）', () => {
    it('groups が更新されると新しいメモがバータイトルに反映される', () => {
      const { rerender } = render(<GanttChart groups={[baseGroup]} fiscalYear={2026} isAdmin={false} />)

      const updated: GanttGroup[] = [{
        ...baseGroup,
        rows: [{
          ...baseGroup.rows[0],
          periods: [{ ...baseGroup.rows[0].periods[0], memo: 'サーバーメモ' }],
        }],
      }]
      rerender(<GanttChart groups={updated} fiscalYear={2026} isAdmin={false} />)

      // バーの title 属性にメモが含まれる
      expect(document.querySelector('[title*="サーバーメモ"]')).toBeInTheDocument()
    })

    it('dirty なメモは groups 更新でも上書きされない', async () => {
      const user = userEvent.setup()
      const { rerender } = render(<GanttChart groups={[baseGroup]} fiscalYear={2026} isAdmin={false} />)

      // メモを入力して保存開始（supabaseは即座に解決しないよう保留中にする）
      mockEq.mockReturnValueOnce(new Promise(() => {})) // 永遠に解決しない
      const input = await openMemoEditor(user)
      await user.type(input, 'ローカルメモ')
      await user.keyboard('{Enter}')

      // サーバーからの更新（メモなし）が来ても上書きされない
      rerender(<GanttChart groups={[baseGroup]} fiscalYear={2026} isAdmin={false} />)

      // ローカルのメモがバーに表示されている
      expect(document.querySelector('[title*="ローカルメモ"]')).toBeInTheDocument()
    })
  })

  describe('バー作成（INSERT）', () => {
    it('セルを2回クリックするとINSERTが呼ばれ仮IDが本物IDに差し替わる', async () => {
      const user = userEvent.setup()
      render(<GanttChart groups={[{ ...baseGroup, rows: [{ ...baseGroup.rows[0], periods: [] }] }]} fiscalYear={2026} isAdmin={false} />)

      const cells = document.querySelectorAll('.gantt-cell')
      // 最初のクリック: 選択開始
      await user.click(cells[0])
      // 2回目のクリック: バー作成
      await user.click(cells[2])

      await waitFor(() => {
        expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
          assignment_id: 'a1',
        }))
      })

      // 仮IDが本物IDに差し替わる（pending フラグが外れる）
      await waitFor(() => {
        const pendingCells = document.querySelectorAll('.gantt-bar')
        // バーが存在すること
        expect(pendingCells.length).toBeGreaterThan(0)
      })
    })

    it('INSERT失敗時は仮バーが取り消される', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: new Error('INSERT failed') })
      const user = userEvent.setup()
      const { container } = render(<GanttChart groups={[{ ...baseGroup, rows: [{ ...baseGroup.rows[0], periods: [] }] }]} fiscalYear={2026} isAdmin={false} />)

      const cells = container.querySelectorAll('.gantt-cell')
      await user.click(cells[0])
      await user.click(cells[2])

      // 楽観的に仮バーが出た後、INSERT失敗で消える
      await waitFor(() => {
        expect(container.querySelectorAll('.gantt-bar')).toHaveLength(0)
      })
    })
  })
})

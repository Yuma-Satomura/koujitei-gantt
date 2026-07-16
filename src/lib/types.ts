export type Role = 'admin' | 'member'

export interface KoujiteiUser {
  id: string
  name: string
  role: Role
  color: string
  created_at: string
}

export interface Project {
  id: string
  kouban: string | null
  client_name: string
  project_name: string
  sekkei: string | null
  eigyo: string | null
  gaichuu: string | null
  location: string | null
  contract_amount: number | null
  deadline: string | null
  fiscal_year: number
  created_at: string
}

export interface Assignment {
  id: string
  project_id: string
  user_id: string
  progress: number
  is_complete_this_month: boolean
  created_at: string
}

export interface Period {
  id: string
  assignment_id: string
  start_date: string
  end_date: string
  sort_order: number
  memo: string | null
  created_at: string
  pending?: boolean // DBに未保存の楽観的バー（メモ編集・INSERT完了まで保護）
}

// 表示用の結合データ
export interface GanttRow {
  assignment: Assignment
  project: Project
  member: KoujiteiUser
  periods: Period[]
}

export interface GanttGroup {
  member: KoujiteiUser
  rows: GanttRow[]
}

export type SortKey = 'member' | 'sekkei' | 'eigyo' | 'kouban'

// 年度開始月 = 4月
export function getFiscalYear(date: Date = new Date()): number {
  return date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1
}

export function getFiscalStart(fiscalYear: number): Date {
  return new Date(Date.UTC(fiscalYear, 3, 1)) // April 1 UTC
}

// 週インデックス (0〜47) への変換
export function dateToWeekIndex(date: Date | string, fiscalYear: number): number {
  const d = typeof date === 'string' ? new Date(date) : date
  const start = getFiscalStart(fiscalYear)
  const diffDays = (d.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  return Math.max(0, Math.min(47, Math.floor(diffDays / 7)))
}

// 週インデックス → 週の開始日 (Date)
export function weekIndexToDate(weekIdx: number, fiscalYear: number): Date {
  const start = getFiscalStart(fiscalYear)
  return new Date(start.getTime() + weekIdx * 7 * 24 * 60 * 60 * 1000)
}

// 週インデックス → 週の終了日 (Date)
export function weekIndexToEndDate(weekIdx: number, fiscalYear: number): Date {
  const start = weekIndexToDate(weekIdx, fiscalYear)
  return new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000)
}

const MONTHS = ['4月','5月','6月','7月','8月','9月','10月','11月','12月','1月','2月','3月']
const WEEK_LABELS = ['①','②','③','④']

export function weekIndexToLabel(idx: number): string {
  return MONTHS[Math.floor(idx / 4)] + WEEK_LABELS[idx % 4]
}

export function getMonthLabel(idx: number): string {
  return MONTHS[Math.floor(idx / 4)]
}

// 月ヘッダー用：各月が何週目から始まるか
export const MONTH_HEADERS: { label: string; start: number; span: number }[] = MONTHS.map(
  (label, i) => ({ label, start: i * 4, span: 4 })
)

// ISO date string (YYYY-MM-DD)
export function toISODate(date: Date): string {
  return date.toISOString().split('T')[0]
}

// 金額フォーマット (K単位)
export function formatAmount(amount: number | null): string {
  if (amount == null) return ''
  return amount.toLocaleString() + 'K'
}

// 日付フォーマット
export function formatDate(date: string | null): string {
  if (!date) return ''
  const d = new Date(date)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

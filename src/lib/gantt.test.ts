import { describe, it, expect } from 'vitest'
import {
  getFiscalYear,
  getFiscalStart,
  dateToWeekIndex,
  weekIndexToDate,
  weekIndexToEndDate,
  weekIndexToLabel,
  toISODate,
  formatAmount,
  formatDate,
} from './gantt'

const FY = 2026 // 2026年度 = 2026-04-01 〜 2027-03-31

describe('getFiscalYear', () => {
  it('4月はその年の年度', () => {
    expect(getFiscalYear(new Date('2026-04-01'))).toBe(2026)
  })
  it('3月は前年度', () => {
    expect(getFiscalYear(new Date('2027-03-31'))).toBe(2026)
  })
  it('1月は前年度', () => {
    expect(getFiscalYear(new Date('2027-01-01'))).toBe(2026)
  })
})

describe('getFiscalStart', () => {
  it('2026年度の開始は2026-04-01', () => {
    expect(toISODate(getFiscalStart(2026))).toBe('2026-04-01')
  })
})

describe('dateToWeekIndex', () => {
  it('年度の最初の日 → 週0', () => {
    expect(dateToWeekIndex('2026-04-01', FY)).toBe(0)
  })
  it('年度1週目の最終日 → 週0', () => {
    expect(dateToWeekIndex('2026-04-07', FY)).toBe(0)
  })
  it('年度2週目の最初の日 → 週1', () => {
    expect(dateToWeekIndex('2026-04-08', FY)).toBe(1)
  })
  it('年度最終週 → 週47', () => {
    expect(dateToWeekIndex('2027-03-25', FY)).toBe(47)
  })
  it('年度開始より前はクランプして0', () => {
    expect(dateToWeekIndex('2025-12-31', FY)).toBe(0)
  })
  it('年度終了より後はクランプして47', () => {
    expect(dateToWeekIndex('2027-12-31', FY)).toBe(47)
  })
  it('Dateオブジェクトも受け付ける', () => {
    expect(dateToWeekIndex(new Date('2026-04-01'), FY)).toBe(0)
  })
})

describe('weekIndexToDate / weekIndexToEndDate', () => {
  it('週0の開始日 = 年度開始', () => {
    expect(toISODate(weekIndexToDate(0, FY))).toBe('2026-04-01')
  })
  it('週0の終了日 = 年度開始+6日', () => {
    expect(toISODate(weekIndexToEndDate(0, FY))).toBe('2026-04-07')
  })
  it('週1の開始日', () => {
    expect(toISODate(weekIndexToDate(1, FY))).toBe('2026-04-08')
  })
  it('週47の開始日', () => {
    // 2026-04-01 + 47*7日 = 2027-02-24
    expect(toISODate(weekIndexToDate(47, FY))).toBe('2027-02-24')
  })
  it('weekIndexToDate → dateToWeekIndex のラウンドトリップ', () => {
    for (let w = 0; w <= 47; w++) {
      expect(dateToWeekIndex(weekIndexToDate(w, FY), FY)).toBe(w)
    }
  })
})

describe('weekIndexToLabel', () => {
  it('週0 = 4月①', () => {
    expect(weekIndexToLabel(0)).toBe('4月①')
  })
  it('週3 = 4月④', () => {
    expect(weekIndexToLabel(3)).toBe('4月④')
  })
  it('週4 = 5月①', () => {
    expect(weekIndexToLabel(4)).toBe('5月①')
  })
  it('週47 = 3月④', () => {
    expect(weekIndexToLabel(47)).toBe('3月④')
  })
})

describe('toISODate', () => {
  it('UTC日付を YYYY-MM-DD に変換', () => {
    expect(toISODate(new Date('2026-04-01T00:00:00Z'))).toBe('2026-04-01')
  })
})

describe('formatAmount', () => {
  it('nullは空文字', () => {
    expect(formatAmount(null)).toBe('')
  })
  it('0はそのまま', () => {
    expect(formatAmount(0)).toBe('0K')
  })
  it('1000は1,000K', () => {
    expect(formatAmount(1000)).toBe('1,000K')
  })
})

describe('formatDate', () => {
  it('nullは空文字', () => {
    expect(formatDate(null)).toBe('')
  })
  it('空文字は空文字', () => {
    expect(formatDate('')).toBe('')
  })
  it('2026-04-01 → 4/1', () => {
    expect(formatDate('2026-04-01')).toBe('4/1')
  })
  it('2026-12-25 → 12/25', () => {
    expect(formatDate('2026-12-25')).toBe('12/25')
  })
})

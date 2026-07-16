import type { GanttGroup, Period } from './types'

/**
 * サーバーから取得した groups に対して、
 * - 保存中のメモ（dirtyMemos）
 * - DB未確定のpendingバー（prevGroups から引き継ぐ）
 * をマージして localGroups を返す。
 * router.refresh() 中でも楽観的UIを失わないよう保護する。
 */
export function mergeGroupsWithOverrides(
  serverGroups: GanttGroup[],
  dirtyMemos: Map<string, string | null>,
  prevGroups: GanttGroup[]
): GanttGroup[] {
  const pendingByAssignment = new Map<string, Period[]>()
  prevGroups.forEach(g =>
    g.rows.forEach(r => {
      const pending = r.periods.filter(p => p.pending)
      if (pending.length > 0) pendingByAssignment.set(r.assignment.id, pending)
    })
  )

  const hasDirty = dirtyMemos.size > 0
  const hasPending = pendingByAssignment.size > 0
  if (!hasDirty && !hasPending) return serverGroups

  return serverGroups.map(g => ({
    ...g,
    rows: g.rows.map(r => {
      const pendingPeriods = pendingByAssignment.get(r.assignment.id) ?? []
      return {
        ...r,
        periods: [
          ...r.periods.map(p =>
            dirtyMemos.has(p.id) ? { ...p, memo: dirtyMemos.get(p.id) as string | null } : p
          ),
          ...pendingPeriods,
        ],
      }
    }),
  }))
}

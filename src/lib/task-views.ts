// How the tasks board is organised.
//
// Two ideas live here because the board needs both at once, and both are the
// kind of thing that rots when each component spells it out for itself.
//
// 1. Which lists are permanent. The Done column used to be found by comparing
//    its title to the string "done" — in three places, two of which trimmed and
//    one of which did not. Both ends of a card's life are now a column on the
//    row (`lists.kind`): Done is where finished work goes,
//    New is where a card with no list of its own belongs. isDoneList and
//    isNewList are the only things that read it.
//
// 2. The three ways of looking at the same cards. A view never moves a task
//    between lists. `list_id`, the urgent/important pair, and the derived stage
//    are three orthogonal facts about one card; switching view only changes
//    which of them the board groups by. That is exactly why the matrix and stage
//    columns are constants in this file rather than rows in `lists`: they have
//    no identity to protect, they cannot collide with a list someone makes, and
//    a list can never shadow them.
//
// Nothing here renders. Column keys, labels, the column a card belongs in, and
// the sort order within a column all live here so no component repeats any of
// it. `import type` for the row shapes is load-bearing — lib/supabase.ts creates
// a Supabase client at module scope, and a value import would drag that into
// every consumer, lib/prefs.ts included.

import type { List, Task } from './supabase'

// ─── System lists ────────────────────────────────────────────────────────────

/** `lists.kind` for the board's permanent archive column. */
export const DONE_KIND = 'done'

/** `lists.kind` for the inbox — where a card with no list of its own belongs. */
export const NEW_KIND = 'new'

/**
 * Every value `lists.kind` may hold; '' is an ordinary, user-owned list. The
 * other half of this enum is the `lists_kind_check` constraint in the database
 * — adding a kind means editing both.
 */
export const LIST_KINDS = ['', DONE_KIND, NEW_KIND] as const
export type ListKind = (typeof LIST_KINDS)[number]

/**
 * The archive. The database guarantees at most one row answers true — a partial
 * unique index — and that it can be neither renamed nor deleted, so callers may
 * treat the first match as *the* Done list rather than one of several.
 *
 * Rows read before 011 ran carry no `kind` at all and every one of them answers
 * false, which is why 011 has to run before this code ships.
 */
export function isDoneList(list: Pick<List, 'kind'>): boolean {
  return list.kind === DONE_KIND
}

/**
 * Finished work, however it came to be finished. The `done` flag and membership
 * of the Done list are kept in sync when a card is dragged, but they drifted
 * before that was true, so both are checked.
 */
export function isFinished(
  task: Pick<Task, 'done' | 'list_id'>,
  doneListId: string | null
): boolean {
  return task.done || (doneListId !== null && task.list_id === doneListId)
}

/**
 * The inbox. It carries the same guarantees Done does: one row, no
 * rename, no delete — the guard trigger protects every non-empty kind, so this
 * came for free with the tagging.
 */
export function isNewList(list: Pick<List, 'kind'>): boolean {
  return list.kind === NEW_KIND
}

/**
 * The list a card joins when it is created somewhere that has no list of its own
 * — a matrix quadrant, a stage column.
 *
 * The database says the same thing in `tasks_home_list`: a card
 * with no list is not a state, it is the inbox. This is the client agreeing, so
 * the optimistic card lands in the right column before the insert comes back.
 *
 * The fallbacks are for a board that has not run 013 yet, where there is no
 * inbox to find.
 */
export function defaultListFor(lists: List[]): List | null {
  const open = lists.filter((l) => !isDoneList(l))
  return open.find(isNewList) ?? open[0] ?? null
}

// ─── Views ───────────────────────────────────────────────────────────────────

export const BOARD_VIEWS = ['lists', 'matrix', 'stages'] as const
export type BoardView = (typeof BOARD_VIEWS)[number]

export const DEFAULT_BOARD_VIEW: BoardView = 'lists'

export const BOARD_VIEW_LABELS: Record<BoardView, string> = {
  lists: 'Lists',
  matrix: 'Matrix',
  stages: 'Stages',
}

/** The one-line case for each view; used as the switcher's tooltip. */
export const BOARD_VIEW_HINTS: Record<BoardView, string> = {
  lists: 'Your own columns, in the order you put them',
  matrix: 'Urgent against important',
  stages: 'How far along: new, assigned, scheduled',
}

/** Narrows an untrusted string — a cookie — to a view id. */
export function decodeBoardView(raw: string | undefined | null): BoardView {
  return (BOARD_VIEWS as readonly string[]).includes(raw ?? '')
    ? (raw as BoardView)
    : DEFAULT_BOARD_VIEW
}

// ─── Columns ─────────────────────────────────────────────────────────────────

/**
 * One column, whatever the view. The lists view builds these from `lists` rows;
 * the other two take them from the constants below. The board groups and renders
 * from this shape alone and never asks which view it is in — which is what keeps
 * the column component from growing three branches.
 */
export type ViewColumn = {
  /** Grouping key: a list id in the lists view, a constant in the other two. */
  key: string
  title: string
  /** Shown under the title where the column's meaning is not its name. */
  hint?: string
  /** Mirrors `lists.kind`; always '' for a derived column. */
  kind: ListKind
  /**
   * Cards here keep a hand-picked order. True only in the lists view:
   * `tasks.position` is scoped to `list_id`, so the members of a derived column
   * are not siblings and have no order to preserve. False turns off the up/down
   * arrows, the insert-here indicator, and drag-to-reorder within the column.
   */
  manualOrder: boolean
}

/** A `lists` row as a column. The only place `List.kind` is narrowed. */
export function listColumn(list: List): ViewColumn {
  const kind = (LIST_KINDS as readonly string[]).includes(list.kind) ? list.kind : ''
  return { key: list.id, title: list.title, kind: kind as ListKind, manualOrder: true }
}

/** Finished work: struck through, muted, collapsible to a spine. */
export function isArchiveColumn(column: ViewColumn): boolean {
  return column.kind === DONE_KIND
}

/**
 * Whether this column may be renamed and deleted. False for the Done list, whose
 * name is protected by a trigger, and false for every derived column, which is a
 * constant in this file and has nothing to rename. One predicate, both reasons —
 * the board passes onRename/onDelete only when it answers true.
 */
export function isEditableColumn(column: ViewColumn): boolean {
  return column.manualOrder && column.kind === ''
}

// ─── Matrix ──────────────────────────────────────────────────────────────────
//
// `tasks.urgent` and `tasks.important` are two nullable
// booleans, independent of `priority`. Null on either side means nobody has
// decided yet.

export const QUADRANTS = [
  'urgent-important',
  'noturgent-important',
  'urgent-notimportant',
  'noturgent-notimportant',
] as const
export type Quadrant = (typeof QUADRANTS)[number]

/** Cards nobody has placed. A column, not a silent default. */
export const UNTRIAGED = 'untriaged'

export type MatrixColumnKey = Quadrant | typeof UNTRIAGED

/** What dropping into a quadrant writes — and what the bulk bar applies. */
export const QUADRANT_FLAGS: Record<Quadrant, { urgent: boolean; important: boolean }> = {
  'urgent-important': { urgent: true, important: true },
  'noturgent-important': { urgent: false, important: true },
  'urgent-notimportant': { urgent: true, important: false },
  'noturgent-notimportant': { urgent: false, important: false },
}

/** Dropping into Untriaged is the un-decide: both flags go back to null. */
export const UNTRIAGED_FLAGS: { urgent: null; important: null } = {
  urgent: null,
  important: null,
}

/** The write for any matrix column, quadrant or not. */
export function flagsForMatrixColumn(key: MatrixColumnKey) {
  return key === UNTRIAGED ? UNTRIAGED_FLAGS : QUADRANT_FLAGS[key]
}

/**
 * `== null` and not `=== null`, deliberately: it also catches rows fetched
 * before those columns existed, which arrive with the fields absent.
 * Those read as untriaged, which is precisely what they are.
 */
export function quadrantKey(task: Pick<Task, 'urgent' | 'important'>): MatrixColumnKey {
  if (task.urgent == null || task.important == null) return UNTRIAGED
  if (task.urgent) return task.important ? 'urgent-important' : 'urgent-notimportant'
  return task.important ? 'noturgent-important' : 'noturgent-notimportant'
}

export const MATRIX_COLUMNS: readonly ViewColumn[] = [
  { key: 'urgent-important',       title: 'Urgent & important',    hint: 'Do it now',           kind: '', manualOrder: false },
  { key: 'noturgent-important',    title: 'Important, not urgent', hint: 'Decide when',         kind: '', manualOrder: false },
  { key: 'urgent-notimportant',    title: 'Urgent, not important', hint: 'Delegate or batch',   kind: '', manualOrder: false },
  { key: 'noturgent-notimportant', title: 'Neither',               hint: 'Drop it, or park it', kind: '', manualOrder: false },
  { key: UNTRIAGED,                title: 'Untriaged',             hint: 'Not placed yet',      kind: '', manualOrder: false },
]

// ─── Stages ──────────────────────────────────────────────────────────────────
//
// Derived, with no column of its own: a stage is a reading of two fields the
// task already carries. A stored stage would be a third copy of the same fact
// and would start disagreeing with them the first time a due date was cleared
// from the card modal — which is a thing the modal can already do.

export const STAGES = ['new', 'assigned', 'scheduled'] as const
export type Stage = (typeof STAGES)[number]

/**
 * A date outranks an owner. Once a task is on a day, "when" is the further-along
 * answer, so a scheduled task stays scheduled whether or not it also has an
 * assignee. Assigned therefore means "has an owner and no date".
 */
export function deriveStage(task: Pick<Task, 'due_date' | 'assignee_id'>): Stage {
  if (task.due_date) return 'scheduled'
  if (task.assignee_id) return 'assigned'
  return 'new'
}

/**
 * The fields a drop into `new` writes — both together, because clearing only one
 * would leave the card in the other column.
 *
 * `assigned` and `scheduled` have no entry here: each needs a value only the
 * user can supply, so the board opens a picker and builds the write from the
 * answer. See the note on AssignPopover in KanbanBoard for why `assigned` must
 * also clear the due date.
 */
export const STAGE_FIELDS: Record<'new', Pick<Task, 'assignee_id' | 'due_date'>> = {
  new: { assignee_id: null, due_date: null },
}

export const STAGE_COLUMNS: readonly ViewColumn[] = [
  { key: 'new',       title: 'New',       hint: 'No owner, no date', kind: '', manualOrder: false },
  { key: 'assigned',  title: 'Assigned',  hint: 'Has an owner',      kind: '', manualOrder: false },
  { key: 'scheduled', title: 'Scheduled', hint: 'On a day',          kind: '', manualOrder: false },
]

// ─── Grouping ────────────────────────────────────────────────────────────────

export function columnsForView(view: BoardView, lists: List[]): ViewColumn[] {
  if (view === 'matrix') return [...MATRIX_COLUMNS]
  if (view === 'stages') return [...STAGE_COLUMNS]
  return lists.map(listColumn)
}

/**
 * Which column a card belongs in. Null means "nowhere in this view", which only
 * the lists view can say — for a task whose list was deleted, since `list_id` is
 * `on delete set null`. Those orphans are invisible on the board today and turn
 * up again in the derived views, which have an answer for every card. That is a
 * feature: nothing is silently lost.
 */
export function columnKeyFor(view: BoardView, task: Task): string | null {
  if (view === 'matrix') return quadrantKey(task)
  if (view === 'stages') return deriveStage(task)
  return task.list_id
}

// ─── Sorting ─────────────────────────────────────────────────────────────────

export const PRIORITIES = ['none', 'low', 'medium', 'high'] as const

/** A sort key, so highest first — not the priority's own order. */
export const PRIORITY_RANK: Record<Task['priority'], number> = {
  high: 0,
  medium: 1,
  low: 2,
  none: 3,
}

/** The archive is a log: it stays in the order things were finished. */
export function compareByPosition(a: Task, b: Task): number {
  return a.position - b.position
}

/** An ordinary list. Priority is a planning tool, so it floats to the top. */
export function compareByPriority(a: Task, b: Task): number {
  const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
  return p !== 0 ? p : a.position - b.position
}

/**
 * A derived column, which has no hand-picked order to preserve. Priority, then
 * the nearer due date, then position purely as a stable tie-break so two equal
 * cards never swap places between renders. Due dates are `YYYY-MM-DD`, so a
 * string comparison is already chronological; undated sorts last, because a card
 * with a date is the one with a deadline attached.
 */
export function compareDerived(a: Task, b: Task): number {
  const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
  if (p !== 0) return p
  const ad = a.due_date
  const bd = b.due_date
  if (!ad !== !bd) return ad ? -1 : 1
  if (ad && bd && ad !== bd) return ad < bd ? -1 : 1
  return a.position - b.position
}

/**
 * The one place the three orderings are chosen between. The lists view keeps
 * exactly the two comparators it has always used — the derived ordering is not
 * applied to it, so no existing column changes shape.
 */
export function comparatorFor(column: ViewColumn): (a: Task, b: Task) => number {
  if (!column.manualOrder) return compareDerived
  return isArchiveColumn(column) ? compareByPosition : compareByPriority
}

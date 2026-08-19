-- The Done column becomes a permanent part of the board.
--
-- Run AFTER 010_lead_activity.sql, as its own query. Safe to re-run.
--
-- Until now "the Done list" meant "a row in `lists` whose title happens to be
-- the word done". Three places asked that question and they did not agree: the
-- board compared `title.toLowerCase()`, the home page compared
-- `title.trim().toLowerCase()`, and supabase-done-backfill.sql used
-- `lower(title)`. Rename the column to "Done ✅" and the archive quietly stopped
-- being the archive — cards kept their strikethrough, but the `done` flag
-- stopped being written on drop and the home page's open-task count began
-- disagreeing with the board it links to. Deleting it was worse: `tasks.list_id`
-- is `on delete set null`, and a task with no list is invisible to the board.
--
-- Identity moves onto the row. `lists.kind` says what a list is for, a partial
-- unique index says there is at most one of each kind, and a trigger refuses to
-- rename or delete one.
--
-- The guard is in the database and not only in the application because `lists`
-- carries a permissive "Allow all" RLS policy: anything holding the anon key can
-- issue the DELETE. The check in lib/actions.ts is a courtesy that produces a
-- readable message; this is the rule.
--
-- `position` is deliberately left alone. The Done column may still be dragged
-- anywhere on the board. What it may not do is stop being the Done column.

-- ─── Wrong-database guard ────────────────────────────────────────────────────

do $$
begin
  if to_regclass('public.ongoing_activities') is null then
    raise exception
      'Wrong database: this migration is for the dashboard project (figvcskjslkvomoxubuq), which has an ongoing_activities table. Check which project the SQL editor is pointed at.';
  end if;
end $$;

-- ─── Prerequisite ────────────────────────────────────────────────────────────

do $$
begin
  if to_regclass('public.lists') is null then
    raise exception
      'No lists table. Run supabase-kanban-schema.sql first — this migration only adds identity to a board that already exists.';
  end if;
end $$;

-- ─── lists.kind ──────────────────────────────────────────────────────────────
--
-- '' rather than NULL for an ordinary list, matching tasks.color and
-- projects.color: the app already spells "unset" as the empty string, and it
-- keeps every comparison in this file a plain `<>` with no null handling.

alter table lists add column if not exists kind text not null default '';

-- `add constraint if not exists` does not exist for CHECK constraints, hence the
-- block. Adding a kind means editing this list *and* LIST_KINDS in
-- src/lib/task-views.ts — they are two halves of one enum.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'lists_kind_check') then
    alter table lists add constraint lists_kind_check check (kind in ('', 'done'));
  end if;
end $$;

-- At most one list of each system kind. This is what lets the application write
-- `lists.find(isDoneList)` and treat the answer as *the* Done list rather than
-- as one of possibly several.
create unique index if not exists lists_one_per_kind
  on lists (kind)
  where kind <> '';

-- ─── Tag the existing Done list ──────────────────────────────────────────────

do $$
declare
  v_done_id  uuid;
  v_next_pos int;
begin
  -- Already tagged. This early return is what makes the migration re-runnable,
  -- and is also why a board that has been repaired by hand is left alone.
  if exists (select 1 from lists where kind = 'done') then
    return;
  end if;

  -- More than one list can be called "Done" — nothing ever stopped that, and the
  -- old `lists.find()` silently used whichever came first in position order.
  -- Keep exactly that choice so the archive does not move under anyone: lowest
  -- position, oldest when positions tie, then id purely so the answer is never
  -- arbitrary. `btrim(lower(...))` matches the more forgiving of the two
  -- comparisons the application used.
  select id into v_done_id
  from lists
  where btrim(lower(title)) = 'done'
  order by position, created_at, id
  limit 1;

  -- Any others stay exactly as they are: ordinary lists that happen to be called
  -- Done. They keep their cards, they can still be renamed and deleted, and
  -- nothing about them is special any more. Deliberately not merged — merging
  -- would move cards, and a migration that moves someone's cards is a migration
  -- they cannot undo.

  if v_done_id is null then
    -- No Done list at all: deleted at some point, or a fresh board. Make one
    -- where a new list would go.
    select coalesce(max(position), -1) + 1 into v_next_pos from lists;
    insert into lists (title, position, kind) values ('Done', v_next_pos, 'done');
  else
    update lists set kind = 'done' where id = v_done_id;
  end if;
end $$;

-- ─── The guard ───────────────────────────────────────────────────────────────
--
-- Each refusal carries its own SQLSTATE, the way the guards in 002 do, so a
-- caller can branch on a code instead of matching prose:
--
--   KB001  delete of a system list
--   KB002  rename of a system list
--   KB003  a system list trying to stop being one

create or replace function lists_guard_system()
returns trigger as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'The "%" list is part of the board and cannot be deleted', old.title
      using errcode = 'KB001',
            hint    = 'Empty it instead — its cards can be dragged anywhere.';
  end if;

  if new.title is distinct from old.title then
    raise exception 'The "%" list is part of the board and cannot be renamed', old.title
      using errcode = 'KB002',
            hint    = 'Its name is shown, but nothing reads it — the board finds it by lists.kind.';
  end if;

  if new.kind is distinct from old.kind then
    raise exception 'The "%" list cannot stop being the % list', old.title, old.kind
      using errcode = 'KB003';
  end if;

  -- Everything else passes, `position` above all: the column can be dragged
  -- wherever you like, and reorderLists() updates nothing but position.
  return new;
end;
$$ language plpgsql;

-- Two triggers rather than one `before update or delete`, so each can carry a
-- WHEN clause: a WHEN on a DELETE trigger may not mention NEW, and both of these
-- need to read only OLD. Ordinary lists never enter the function at all.
--
-- Note what the WHEN does *not* cover: an UPDATE moving an ordinary list from
-- '' to 'done' has old.kind = '' and skips the guard entirely. That is on
-- purpose — it is the one repair hatch if a board is ever mis-tagged, and
-- lists_one_per_kind bounds it to a single winner.

drop trigger if exists lists_system_guard_update on lists;
create trigger lists_system_guard_update
  before update on lists
  for each row
  when (old.kind <> '')
  execute function lists_guard_system();

drop trigger if exists lists_system_guard_delete on lists;
create trigger lists_system_guard_delete
  before delete on lists
  for each row
  when (old.kind <> '')
  execute function lists_guard_system();

-- ─── Check ───────────────────────────────────────────────────────────────────

do $$
declare
  v_count int;
begin
  select count(*) into v_count from lists where kind = 'done';
  if v_count <> 1 then
    raise exception 'expected exactly one Done list, found %', v_count;
  end if;
  raise notice 'the Done list is now permanent';
end $$;

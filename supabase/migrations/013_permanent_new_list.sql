-- The New list becomes the board's inbox, and permanent.
--
-- Run AFTER 011_permanent_done_list.sql, as its own query. Safe to re-run.
--
-- Done answers "where does finished work go". New answers the other end of the
-- same question: where does a card go when nobody has said where it goes. Until
-- now the answer was nowhere — `tasks.list_id` is nullable, the FK is `on delete
-- set null`, and a task with no list is invisible in the Lists view. Delete a
-- column and its cards did not move, they stopped existing as far as the board
-- was concerned.
--
-- So `list_id is null` stops being a state a task can rest in. Two triggers keep
-- it that way: one fills the list in on insert, one re-homes a deleted list's
-- cards instead of orphaning them. Both route finished work to Done and
-- everything else to New, so a card's `done` flag still decides where it lands.
--
-- The permanence machinery is entirely inherited. 011's lists_guard_system
-- trigger already refuses to rename or delete any row with a non-empty `kind`,
-- and lists_one_per_kind already bounds each kind to a single row — so tagging
-- this list is all it takes. Only the CHECK constraint has to widen.

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
  if to_regclass('public.lists') is null
     or not exists (
       select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'lists' and column_name = 'kind'
     ) then
    raise exception
      'Run 011_permanent_done_list.sql first — this migration adds a second kind to lists.kind, which that one creates.';
  end if;
end $$;

-- ─── Take both locks up front ────────────────────────────────────────────────
--
-- This is the only migration in the set that touches `lists` and `tasks` both,
-- and it touches them in that order: the constraint below locks `lists`, the
-- trigger further down locks `tasks`. The running app reads them the other way
-- round (the tasks page fetches getLists() and getTasks() in one Promise.all),
-- and a reader that gets `tasks` between those two statements deadlocks against
-- this — which is exactly the 40P01 you get if you run it against a live app.
--
-- Claiming both locks in one statement makes that impossible: either the whole
-- migration gets in, or it waits outside. lock_timeout turns "waits outside"
-- into a clear error after five seconds instead of a hang.
--
-- Still worth stopping the dev server first. This makes the migration safe to
-- run, not fast.

set lock_timeout = '5s';
lock table lists, tasks in access exclusive mode;

-- ─── Widen the kind enum ─────────────────────────────────────────────────────
--
-- The other half of this list is LIST_KINDS in src/lib/task-views.ts.

alter table lists drop constraint if exists lists_kind_check;
alter table lists add constraint lists_kind_check check (kind in ('', 'done', 'new'));

-- ─── Tag the New list ────────────────────────────────────────────────────────

do $$
declare
  v_new_id uuid;
  v_next_pos int;
begin
  if exists (select 1 from lists where kind = 'new') then
    return;
  end if;

  -- Same winner-picking as 011: an existing list called "New" is adopted rather
  -- than duplicated, lowest position first so the board does not rearrange
  -- itself. Any others called New stay ordinary lists.
  select id into v_new_id
  from lists
  where btrim(lower(title)) = 'new'
    and kind = ''
  order by position, created_at, id
  limit 1;

  if v_new_id is null then
    -- An inbox belongs at the front, where work arrives.
    select coalesce(min(position), 1) - 1 into v_next_pos from lists;
    insert into lists (title, position, kind) values ('New', v_next_pos, 'new');
  else
    update lists set kind = 'new' where id = v_new_id;
  end if;
end $$;

-- ─── Adopt the tasks that never had a list ───────────────────────────────────
--
-- Cards orphaned by a list deleted before this migration existed. They have been
-- invisible on the board, but they are still in the table, still counted by
-- nothing, still real. Finished ones go to the archive, the rest to the inbox.

update tasks
set list_id = case
  when done then (select id from lists where kind = 'done')
  else (select id from lists where kind = 'new')
end
where list_id is null;

-- ─── Where a card goes when nobody says ──────────────────────────────────────

create or replace function tasks_home_list()
returns trigger as $$
begin
  new.list_id := (
    select id from lists where kind = case when new.done then 'done' else 'new' end
  );
  return new;
end;
$$ language plpgsql;

-- The WHEN clause is what keeps this off the hot path: an insert that already
-- names a list never enters the function at all.
drop trigger if exists tasks_home_list_insert on tasks;
create trigger tasks_home_list_insert
  before insert on tasks
  for each row
  when (new.list_id is null)
  execute function tasks_home_list();

-- ─── Deleting a list re-homes its cards ──────────────────────────────────────
--
-- The FK is `on delete set null`, which is what produced the orphans backfilled
-- above. This runs first and empties the list, so by the time the FK fires there
-- is nothing left for it to null out.
--
-- Named to sort *after* lists_system_guard_delete: Postgres fires BEFORE
-- triggers in name order, so the guard gets to refuse a system list before any
-- cards are moved. Belt and braces — a refusal aborts the transaction and would
-- roll this back regardless.

create or replace function lists_rehome_tasks()
returns trigger as $$
declare
  v_new_id  uuid;
  v_done_id uuid;
begin
  select id into v_new_id  from lists where kind = 'new';
  select id into v_done_id from lists where kind = 'done';

  -- Deleting either system list is impossible (011 refuses), so neither of these
  -- can be the row being deleted. Null only on a half-migrated board, where
  -- falling through to the FK's `set null` is the old behaviour and no worse.
  update tasks
  set list_id = case when done then v_done_id else v_new_id end
  where list_id = old.id
    and case when done then v_done_id else v_new_id end is not null;

  return old;
end;
$$ language plpgsql;

drop trigger if exists lists_tasks_rehome_delete on lists;
create trigger lists_tasks_rehome_delete
  before delete on lists
  for each row
  execute function lists_rehome_tasks();

-- ─── Check ───────────────────────────────────────────────────────────────────

do $$
declare
  v_kinds   int;
  v_orphans int;
begin
  select count(*) into v_kinds from lists where kind in ('done', 'new');
  if v_kinds <> 2 then
    raise exception 'expected one Done list and one New list, found % system list(s)', v_kinds;
  end if;

  select count(*) into v_orphans from tasks where list_id is null;
  if v_orphans > 0 then
    raise exception '% task(s) still have no list', v_orphans;
  end if;

  raise notice 'the New list is now the inbox, and permanent';
end $$;

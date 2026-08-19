-- Urgent and important, as two facts about a task.
--
-- Run AFTER 011_permanent_done_list.sql, as its own query. Safe to re-run.
--
-- These drive the board's matrix view, and they are deliberately not the
-- existing `priority` column. Priority is one axis with four steps and answers
-- "how loudly is this shouting". Urgency and importance are two independent
-- axes and answer "is it shouting because it matters, or only because it is
-- soon". A task can be high priority and not important; that combination is the
-- whole point of the matrix, and one column cannot express it.
--
-- Nullable, with no default, because null is not false. It means nobody has
-- placed this card yet — a real and very common state on a board with a long
-- tail of old cards. The view gives it its own Untriaged column rather than
-- quietly filing every untouched task under "not urgent, not important", which
-- would be a judgement the board invented on the user's behalf.
--
-- No index, on purpose. Every read of `tasks` in this application is
-- `select * from tasks order by position` — the whole table, grouped in the
-- browser — so an index on either column would never be chosen by any query
-- that exists. A boolean with three states is poor index material besides; if a
-- filtered read ever moves server-side, the useful shape would be a partial
-- index over the untriaged tail (`where urgent is null`), not a plain btree.

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
  if to_regclass('public.tasks') is null then
    raise exception
      'No tasks table. Run supabase-tasks-schema.sql and supabase-kanban-schema.sql first.';
  end if;
end $$;

-- ─── The two axes ────────────────────────────────────────────────────────────

alter table tasks add column if not exists urgent    boolean;
alter table tasks add column if not exists important boolean;

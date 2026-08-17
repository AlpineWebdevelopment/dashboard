  -- Add the new lead statuses.
  --
  -- RUN THIS ON ITS OWN, then run 009_rework_early_pipeline.sql as a separate
  -- query. They cannot be combined.
  --
  -- Postgres allows ALTER TYPE ... ADD VALUE inside a transaction, but the new
  -- value cannot be *used* until that transaction commits. The Supabase SQL
  -- editor runs each query as one transaction, so adding the value and inserting
  -- transitions that reference it in the same run fails with
  -- "unsafe use of new value of enum type". Hence two files.

  -- ─── Wrong-database guard ────────────────────────────────────────────────────

  do $$
  begin
    if to_regclass('public.ongoing_activities') is null then
      raise exception
        'Wrong database: this migration is for the dashboard project (figvcskjslkvomoxubuq), which has an ongoing_activities table. Check which project the SQL editor is pointed at.';
    end if;
  end $$;

  -- ─── The new values ──────────────────────────────────────────────────────────
  --
  -- Unreachable-retry: they did not pick up, and you intend to ring again. Live
  -- work — it carries a follow-up date and stays in the worklist.
  -- Unreachable (existing): you have stopped trying. Needs a reason, and leaves
  -- the worklist, but can be started again.

  alter type lead_status add value if not exists 'UNREACHABLE_RETRY';

  -- An extra meeting, sitting alongside the demo rather than replacing it: some
  -- deals need another conversation before anyone is ready to demo or to sign.
  --
  -- Split the same way every other meeting in this pipeline is — one state for
  -- "it is in the diary", one for "we agreed to meet again but have not fixed a
  -- time" — because those are two different pieces of work, and only the second
  -- one needs chasing.

  alter type lead_status add value if not exists 'EXTRA_MEETING_BOOKED';
  alter type lead_status add value if not exists 'EXTRA_MEETING_CALL';

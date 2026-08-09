-- One-off repair: the board now keeps the `done` flag in sync when cards move
-- in and out of the "Done" list, but cards that were already sitting there
-- predate that fix. Mark them done so open-task counts are honest.
update tasks
set done = true
where done = false
  and list_id in (select id from lists where lower(title) = 'done');

-- Optional: uncomment to also clear the flag on tasks that were checked off in
-- the old list view but currently sit outside the Done column.
-- update tasks
-- set done = false
-- where done = true
--   and (list_id is null or list_id not in (select id from lists where lower(title) = 'done'));

-- Per-person colour, used by the "assigned to" chip on Kanban cards.
-- Set from the person modal (person button, top right of the tasks page).
-- Empty string = fall back to a tint picked from the person's position.
alter table people add column if not exists color text not null default '';

-- Per-card colour, used by the accent strip (and the frosted tint) on Kanban cards.
-- Set from the swatch picker on a card or the bulk edit bar, and inherited from
-- the task's project when it joins one.
-- Empty string = no colour, the card keeps its plain priority styling.
alter table tasks add column if not exists color text not null default '';

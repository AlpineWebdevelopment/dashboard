-- Kanban lists (columns on the board)
create table if not exists lists (
  id uuid default gen_random_uuid() primary key,
  title text not null default 'New List',
  position int not null default 0,
  created_at timestamp with time zone default now() not null
);

alter table lists enable row level security;
create policy "Allow all" on lists for all using (true) with check (true);

-- Add kanban fields to tasks
alter table tasks add column if not exists list_id uuid references lists(id) on delete set null;
alter table tasks add column if not exists position float not null default 0;
alter table tasks add column if not exists description text not null default '';

-- Create default lists and migrate existing tasks
do $$
declare
  todo_id uuid;
  done_id uuid;
begin
  if not exists (select 1 from lists limit 1) then
    insert into lists (title, position) values ('To Do', 0) returning id into todo_id;
    insert into lists (title, position) values ('In Progress', 1);
    insert into lists (title, position) values ('Done', 2) returning id into done_id;

    -- Assign existing undone tasks to To Do
    update tasks
    set list_id = todo_id,
        position = extract(epoch from created_at)
    where list_id is null and done = false;

    -- Assign existing done tasks to Done
    update tasks
    set list_id = done_id,
        position = extract(epoch from created_at)
    where list_id is null and done = true;
  end if;
end $$;

create table if not exists tasks (
  id uuid default gen_random_uuid() primary key,
  title text not null default '',
  done boolean not null default false,
  priority text not null default 'none' check (priority in ('none', 'low', 'medium', 'high')),
  due_date date,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create or replace function update_tasks_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger tasks_updated_at
  before update on tasks
  for each row execute procedure update_tasks_updated_at();

alter table tasks enable row level security;
create policy "Allow all" on tasks for all using (true) with check (true);

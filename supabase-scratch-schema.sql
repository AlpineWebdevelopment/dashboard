create table if not exists scratch_pad (
  id int primary key default 1,
  content text not null default '',
  updated_at timestamp with time zone default now() not null,
  constraint scratch_single_row check (id = 1)
);

insert into scratch_pad (id, content) values (1, '') on conflict do nothing;

alter table scratch_pad enable row level security;
create policy "Allow all" on scratch_pad for all using (true) with check (true);

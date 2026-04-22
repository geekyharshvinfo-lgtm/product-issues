-- Run this in: Supabase Dashboard → SQL Editor → New query

create table if not exists issues (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  url             text not null,
  page_title      text,
  comment         text not null,
  status          text default 'new' check (status in ('new','discussed','in_progress','done','wont_fix')),
  screenshot_path text,
  x               integer,
  y               integer,
  width           integer,
  height          integer,
  reporter_name   text not null
);

-- Open RLS policies (no auth for now)
alter table issues enable row level security;

create policy "public read"   on issues for select using (true);
create policy "public insert" on issues for insert with check (true);
create policy "public update" on issues for update using (true);
create policy "public delete" on issues for delete using (true);

-- Create the screenshots storage bucket
insert into storage.buckets (id, name, public)
values ('screenshots', 'screenshots', true)
on conflict (id) do nothing;

create policy "public upload screenshots"
  on storage.objects for insert
  with check (bucket_id = 'screenshots');

create policy "public read screenshots"
  on storage.objects for select
  using (bucket_id = 'screenshots');

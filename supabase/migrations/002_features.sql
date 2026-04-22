-- ============================================================
-- Migration 002: All 25 features schema
-- Run in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1. Add new columns to issues
ALTER TABLE issues ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS priority text default 'medium' check (priority in ('critical','high','medium','low'));
ALTER TABLE issues ADD COLUMN IF NOT EXISTS assignee text;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS tags text[] default '{}';
ALTER TABLE issues ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS template_id uuid;

-- 2. Team members (for assignee dropdown)
CREATE TABLE IF NOT EXISTS team_members (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  created_at  timestamptz default now()
);
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all team_members" ON team_members USING (true) WITH CHECK (true);

-- 3. Issue links (duplicate / blocks / related)
CREATE TABLE IF NOT EXISTS issue_links (
  id               uuid primary key default gen_random_uuid(),
  issue_id         uuid references issues(id) on delete cascade,
  linked_issue_id  uuid references issues(id) on delete cascade,
  link_type        text check (link_type in ('duplicate','blocks','blocked_by','related')),
  created_at       timestamptz default now()
);
ALTER TABLE issue_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all issue_links" ON issue_links USING (true) WITH CHECK (true);

-- 4. Comments thread
CREATE TABLE IF NOT EXISTS issue_comments (
  id           uuid primary key default gen_random_uuid(),
  issue_id     uuid references issues(id) on delete cascade,
  author_name  text not null,
  body         text not null,
  created_at   timestamptz default now()
);
ALTER TABLE issue_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all issue_comments" ON issue_comments USING (true) WITH CHECK (true);

-- 5. Activity log
CREATE TABLE IF NOT EXISTS activity_log (
  id          uuid primary key default gen_random_uuid(),
  issue_id    uuid references issues(id) on delete cascade,
  actor_name  text not null,
  action      text not null,
  old_value   text,
  new_value   text,
  field       text,
  created_at  timestamptz default now()
);
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all activity_log" ON activity_log USING (true) WITH CHECK (true);

-- 6. Issue watchers
CREATE TABLE IF NOT EXISTS issue_watchers (
  id            uuid primary key default gen_random_uuid(),
  issue_id      uuid references issues(id) on delete cascade,
  watcher_name  text not null,
  created_at    timestamptz default now(),
  UNIQUE(issue_id, watcher_name)
);
ALTER TABLE issue_watchers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all issue_watchers" ON issue_watchers USING (true) WITH CHECK (true);

-- 7. Projects / sprints
CREATE TABLE IF NOT EXISTS projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  created_at  timestamptz default now()
);
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all projects" ON projects USING (true) WITH CHECK (true);

-- 8. Saved filter presets
CREATE TABLE IF NOT EXISTS saved_filters (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  filter_json  jsonb not null,
  created_by   text not null,
  created_at   timestamptz default now()
);
ALTER TABLE saved_filters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all saved_filters" ON saved_filters USING (true) WITH CHECK (true);

-- 9. Issue templates
CREATE TABLE IF NOT EXISTS issue_templates (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  title_template   text,
  comment_template text,
  default_priority text default 'medium',
  default_tags     text[] default '{}',
  created_at       timestamptz default now()
);
ALTER TABLE issue_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all issue_templates" ON issue_templates USING (true) WITH CHECK (true);

-- 10. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_issues_status    ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_priority  ON issues(priority);
CREATE INDEX IF NOT EXISTS idx_issues_assignee  ON issues(assignee);
CREATE INDEX IF NOT EXISTS idx_issues_project   ON issues(project_id);
CREATE INDEX IF NOT EXISTS idx_issues_due_date  ON issues(due_date);
CREATE INDEX IF NOT EXISTS idx_comments_issue   ON issue_comments(issue_id);
CREATE INDEX IF NOT EXISTS idx_activity_issue   ON activity_log(issue_id);

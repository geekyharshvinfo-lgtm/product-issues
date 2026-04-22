import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://txkxhrhoiqjvlqplshme.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4a3hocmhvaXFqdmxxcGxzaG1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NDUyODAsImV4cCI6MjA5MjQyMTI4MH0.7olAB83F-tCGZeNt96_0tLaWV7CZtcO0SQYUrNeMfTo'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export type IssueStatus   = 'new' | 'discussed' | 'in_progress' | 'done' | 'wont_fix'
export type IssuePriority = 'critical' | 'high' | 'medium' | 'low'
export type LinkType      = 'duplicate' | 'blocks' | 'blocked_by' | 'related'

export interface Issue {
  id: string
  created_at: string
  url: string
  page_title: string | null
  title: string | null
  comment: string
  status: IssueStatus
  priority: IssuePriority
  assignee: string | null
  due_date: string | null
  project_id: string | null
  screenshot_path: string | null
  x: number | null
  y: number | null
  width: number | null
  height: number | null
  reporter_name: string
}

export interface IssueComment {
  id: string
  issue_id: string
  author_name: string
  body: string
  created_at: string
}

export interface ActivityLog {
  id: string
  issue_id: string
  actor_name: string
  action: string
  old_value: string | null
  new_value: string | null
  field: string | null
  created_at: string
}

export interface TeamMember {
  id: string
  name: string
  created_at: string
}

export interface Project {
  id: string
  name: string
  description: string | null
  created_at: string
}

export interface SavedFilter {
  id: string
  name: string
  filter_json: Record<string, unknown>
  created_by: string
  created_at: string
}

export interface IssueTemplate {
  id: string
  name: string
  title_template: string | null
  comment_template: string | null
  default_priority: IssuePriority
  default_tags: string[]
  created_at: string
}

export interface IssueLink {
  id: string
  issue_id: string
  linked_issue_id: string
  link_type: LinkType
  created_at: string
  linked_issue?: Issue
}

export function getScreenshotUrl(path: string): string {
  const { data } = supabase.storage.from('screenshots').getPublicUrl(path)
  return data.publicUrl
}

export async function updateIssueField(id: string, field: Partial<Issue>) {
  return supabase.from('issues').update(field).eq('id', id)
}

export async function deleteIssue(id: string) {
  return supabase.from('issues').delete().eq('id', id)
}

export async function logActivity(
  issueId: string,
  actorName: string,
  action: string,
  field?: string,
  oldValue?: string,
  newValue?: string
) {
  return supabase.from('activity_log').insert({
    issue_id: issueId,
    actor_name: actorName,
    action,
    field: field ?? null,
    old_value: oldValue ?? null,
    new_value: newValue ?? null,
  })
}

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://txkxhrhoiqjvlqplshme.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4a3hocmhvaXFqdmxxcGxzaG1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NDUyODAsImV4cCI6MjA5MjQyMTI4MH0.7olAB83F-tCGZeNt96_0tLaWV7CZtcO0SQYUrNeMfTo'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export type IssueStatus = 'new' | 'discussed' | 'in_progress' | 'done' | 'wont_fix'

export interface Issue {
  id: string
  created_at: string
  url: string
  page_title: string | null
  comment: string
  status: IssueStatus
  screenshot_path: string | null
  x: number | null
  y: number | null
  width: number | null
  height: number | null
  reporter_name: string
}

export function getScreenshotUrl(path: string): string {
  const { data } = supabase.storage.from('screenshots').getPublicUrl(path)
  return data.publicUrl
}

export async function updateStatus(id: string, status: IssueStatus) {
  return supabase.from('issues').update({ status }).eq('id', id)
}

export async function deleteIssue(id: string) {
  return supabase.from('issues').delete().eq('id', id)
}

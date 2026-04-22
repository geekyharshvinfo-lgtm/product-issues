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

export async function saveIssue(data: {
  url: string
  page_title: string
  comment: string
  status: IssueStatus
  reporter_name: string
  x: number
  y: number
  width: number
  height: number
  screenshotBlob: Blob | null
}): Promise<{ data: Issue | null; error: Error | null }> {
  let screenshot_path: string | null = null

  if (data.screenshotBlob) {
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.png`
    const { error: uploadError } = await supabase.storage
      .from('screenshots')
      .upload(filename, data.screenshotBlob, { contentType: 'image/png' })

    if (!uploadError) {
      screenshot_path = filename
    }
  }

  const { data: issue, error } = await supabase
    .from('issues')
    .insert({
      url: data.url,
      page_title: data.page_title,
      comment: data.comment,
      status: data.status,
      reporter_name: data.reporter_name,
      x: data.x,
      y: data.y,
      width: data.width,
      height: data.height,
      screenshot_path,
    })
    .select()
    .single()

  return { data: issue, error: error as Error | null }
}

export function getScreenshotUrl(path: string): string {
  const { data } = supabase.storage.from('screenshots').getPublicUrl(path)
  return data.publicUrl
}

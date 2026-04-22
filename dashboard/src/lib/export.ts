import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import { Issue, getScreenshotUrl } from './supabase'

export function exportExcel(issues: Issue[]) {
  const rows = issues.map(i => ({
    'ID':           i.id,
    'Title':        i.title ?? '',
    'Comment':      i.comment,
    'Status':       i.status,
    'Priority':     i.priority,
    'Assignee':     i.assignee ?? '',
    'Reporter':     i.reporter_name,
    'URL':          i.url,
    'Page Title':   i.page_title ?? '',
    'Tags':         (i.tags ?? []).join(', '),
    'Due Date':     i.due_date ?? '',
    'Created At':   new Date(i.created_at).toLocaleString(),
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()

  // Column widths
  ws['!cols'] = [
    { wch: 36 }, { wch: 30 }, { wch: 50 }, { wch: 14 }, { wch: 10 },
    { wch: 16 }, { wch: 16 }, { wch: 50 }, { wch: 30 }, { wch: 20 },
    { wch: 12 }, { wch: 20 },
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Issues')
  XLSX.writeFile(wb, `product-issues-${new Date().toISOString().slice(0,10)}.xlsx`)
}

export function exportCSV(issues: Issue[]) {
  const header = 'ID,Title,Comment,Status,Priority,Assignee,Reporter,URL,Page Title,Tags,Due Date,Created At\n'
  const rows = issues.map(i =>
    [i.id, i.title ?? '', i.comment, i.status, i.priority, i.assignee ?? '', i.reporter_name,
     i.url, i.page_title ?? '', (i.tags ?? []).join(';'), i.due_date ?? '', i.created_at]
      .map(v => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  ).join('\n')
  const blob = new Blob([header + rows], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `product-issues-${new Date().toISOString().slice(0,10)}.csv`; a.click()
  URL.revokeObjectURL(url)
}

export function exportPDF(issues: Issue[]) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  let y = 15

  doc.setFontSize(16)
  doc.setTextColor(99, 102, 241)
  doc.text('Product Issues Report', 15, y)
  y += 6

  doc.setFontSize(9)
  doc.setTextColor(120, 120, 120)
  doc.text(`Generated ${new Date().toLocaleString()} · ${issues.length} issues`, 15, y)
  y += 10

  issues.forEach((issue, idx) => {
    if (y > 265) { doc.addPage(); y = 15 }

    doc.setFontSize(11)
    doc.setTextColor(230, 230, 230)
    const title = issue.title || `Issue #${idx + 1}`
    doc.text(title.slice(0, 80), 15, y)
    y += 5

    doc.setFontSize(8)
    doc.setTextColor(160, 160, 160)
    const meta = `${issue.status} · ${issue.priority} · ${issue.reporter_name} · ${new Date(issue.created_at).toLocaleDateString()}`
    doc.text(meta, 15, y)
    y += 4

    doc.setTextColor(200, 200, 200)
    const lines = doc.splitTextToSize(issue.comment, pageW - 30)
    lines.slice(0, 3).forEach((line: string) => { doc.text(line, 15, y); y += 4 })

    doc.setTextColor(99, 102, 241)
    doc.text(issue.url.slice(0, 80), 15, y)
    y += 3

    doc.setDrawColor(50, 50, 50)
    doc.line(15, y, pageW - 15, y)
    y += 6
  })

  doc.save(`product-issues-${new Date().toISOString().slice(0,10)}.pdf`)
}

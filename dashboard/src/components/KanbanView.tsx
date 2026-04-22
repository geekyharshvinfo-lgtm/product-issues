import React from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { Issue, IssueStatus, updateIssueField, logActivity } from '../lib/supabase'
import PriorityBadge from './PriorityBadge'

interface Props {
  issues: Issue[]
  reporterName: string
  onUpdate: (updated: Issue) => void
  onSelect: (issue: Issue) => void
}

const COLUMNS: { key: IssueStatus; label: string; accent: string }[] = [
  { key: 'new',         label: 'New',         accent: '#94a3b8' },
  { key: 'discussed',   label: 'Discussed',   accent: '#60a5fa' },
  { key: 'in_progress', label: 'In Progress', accent: '#fbbf24' },
  { key: 'done',        label: 'Done',        accent: '#34d399' },
  { key: 'wont_fix',    label: "Won't Fix",   accent: '#f87171' },
]

export default function KanbanView({ issues, reporterName, onUpdate, onSelect }: Props) {
  async function onDragEnd(result: DropResult) {
    if (!result.destination) return
    const newStatus = result.destination.droppableId as IssueStatus
    const issue = issues.find(i => i.id === result.draggableId)
    if (!issue || issue.status === newStatus) return
    await updateIssueField(issue.id, { status: newStatus })
    await logActivity(issue.id, reporterName, 'changed status', 'status', issue.status, newStatus)
    onUpdate({ ...issue, status: newStatus })
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-3 p-5 overflow-x-auto h-full" style={{ minHeight: 'calc(100vh - 220px)' }}>
        {COLUMNS.map(col => {
          const colIssues = issues.filter(i => i.status === col.key)
          return (
            <div key={col.key} className="flex-shrink-0 w-60 flex flex-col">
              <div className="flex items-center gap-2 mb-3 px-1">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: col.accent }} />
                <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>{col.label}</span>
                <span className="text-xs ml-auto tabular-nums" style={{ color: 'rgba(255,255,255,0.2)' }}>{colIssues.length}</span>
              </div>
              <Droppable droppableId={col.key}>
                {(provided, snapshot) => (
                  <div ref={provided.innerRef} {...provided.droppableProps}
                    className="flex-1 space-y-2 rounded-xl p-2 min-h-[100px] transition-colors"
                    style={{ background: snapshot.isDraggingOver ? 'rgba(99,102,241,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${snapshot.isDraggingOver ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)'}` }}>
                    {colIssues.map((issue, index) => (
                      <Draggable key={issue.id} draggableId={issue.id} index={index}>
                        {(provided, snapshot) => (
                          <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}
                            onClick={() => onSelect(issue)}
                            className="rounded-xl p-3 cursor-pointer transition-all"
                            style={{
                              background: snapshot.isDragging ? '#1e1e22' : '#16161a',
                              border: `1px solid ${snapshot.isDragging ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.07)'}`,
                              boxShadow: snapshot.isDragging ? '0 8px 24px rgba(0,0,0,0.4)' : 'none',
                              transform: snapshot.isDragging ? 'rotate(1.5deg)' : 'none',
                            }}>
                            {issue.title && (
                              <p className="text-xs font-semibold text-white/80 mb-1 truncate">{issue.title}</p>
                            )}
                            <p className="text-xs line-clamp-2 mb-2.5" style={{ color: 'rgba(255,255,255,0.4)', lineHeight: '1.5' }}>{issue.comment}</p>
                            <div className="flex items-center justify-between">
                              <PriorityBadge priority={issue.priority} />
                              {issue.assignee && (
                                <span className="text-xs truncate max-w-[70px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{issue.assignee}</span>
                              )}
                            </div>
                            {issue.due_date && (
                              <p className="text-xs mt-1.5 font-medium"
                                style={{ color: new Date(issue.due_date) < new Date() ? '#f87171' : 'rgba(255,255,255,0.25)' }}>
                                {new Date(issue.due_date).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          )
        })}
      </div>
    </DragDropContext>
  )
}

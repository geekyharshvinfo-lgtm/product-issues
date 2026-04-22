import React, { useState } from 'react'
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
  { key: 'new',         label: 'New',           accent: '#94a3b8' },
  { key: 'discussed',   label: 'Discussed',     accent: '#60a5fa' },
  { key: 'in_progress', label: 'In Progress',   accent: '#fbbf24' },
  { key: 'done',        label: 'Done',          accent: '#34d399' },
  { key: 'wont_fix',    label: 'Not an Issue',  accent: '#f87171' },
]

export default function KanbanView({ issues, reporterName, onUpdate, onSelect }: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null)

  async function onDragEnd(result: DropResult) {
    setDraggingId(null)
    if (!result.destination) return
    const newStatus = result.destination.droppableId as IssueStatus
    const issue = issues.find(i => i.id === result.draggableId)
    if (!issue || issue.status === newStatus) return
    onUpdate({ ...issue, status: newStatus })
    await updateIssueField(issue.id, { status: newStatus })
    await logActivity(issue.id, reporterName, 'changed status', 'status', issue.status, newStatus)
  }

  return (
    <DragDropContext
      onDragStart={start => setDraggingId(start.draggableId)}
      onDragEnd={onDragEnd}
    >
      <div
        style={{
          display: 'flex',
          gap: '12px',
          padding: '20px',
          overflowX: 'auto',
          overflowY: 'visible',
          height: '100%',
          alignItems: 'flex-start',
          boxSizing: 'border-box',
        }}
      >
        {COLUMNS.map(col => {
          const colIssues = issues.filter(i => i.status === col.key)
          return (
            <div
              key={col.key}
              style={{
                flexShrink: 0,
                width: '220px',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Column header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', padding: '0 2px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: col.accent, flexShrink: 0 }} />
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>{col.label}</span>
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.2)', marginLeft: 'auto' }}>{colIssues.length}</span>
              </div>

              {/* Droppable column */}
              <Droppable droppableId={col.key}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    style={{
                      minHeight: '120px',
                      borderRadius: '12px',
                      padding: '8px',
                      transition: 'background 0.15s',
                      background: snapshot.isDraggingOver
                        ? 'rgba(99,102,241,0.08)'
                        : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${snapshot.isDraggingOver
                        ? 'rgba(99,102,241,0.25)'
                        : 'rgba(255,255,255,0.05)'}`,
                    }}
                  >
                    {colIssues.map((issue, index) => (
                      <Draggable key={issue.id} draggableId={issue.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            onClick={() => !snapshot.isDragging && onSelect(issue)}
                            style={{
                              ...provided.draggableProps.style,
                              marginBottom: '8px',
                              borderRadius: '10px',
                              padding: '12px',
                              cursor: snapshot.isDragging ? 'grabbing' : 'grab',
                              background: snapshot.isDragging ? '#1e1e24' : '#17171b',
                              border: `1px solid ${snapshot.isDragging
                                ? 'rgba(99,102,241,0.4)'
                                : 'rgba(255,255,255,0.07)'}`,
                              boxShadow: snapshot.isDragging
                                ? '0 12px 32px rgba(0,0,0,0.5)'
                                : 'none',
                              userSelect: 'none',
                            }}
                          >
                            {issue.title && (
                              <p style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {issue.title}
                              </p>
                            )}
                            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.38)', lineHeight: 1.5, marginBottom: '10px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {issue.comment}
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <PriorityBadge priority={issue.priority} />
                              {issue.assignee && (
                                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.28)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70px' }}>
                                  {issue.assignee}
                                </span>
                              )}
                            </div>
                            {issue.due_date && (
                              <p style={{ fontSize: '11px', marginTop: '6px', fontWeight: 500, color: new Date(issue.due_date) < new Date() ? '#f87171' : 'rgba(255,255,255,0.22)' }}>
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

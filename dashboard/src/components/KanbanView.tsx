import React from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { Issue, IssueStatus, updateIssueField, logActivity } from '../lib/supabase'
import StatusBadge from './StatusBadge'
import PriorityBadge from './PriorityBadge'

interface Props {
  issues: Issue[]
  reporterName: string
  onUpdate: (updated: Issue) => void
  onSelect: (issue: Issue) => void
}

const COLUMNS: { key: IssueStatus; label: string }[] = [
  { key: 'new',         label: 'New' },
  { key: 'discussed',   label: 'Discussed' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'done',        label: 'Done' },
  { key: 'wont_fix',    label: "Won't Fix" },
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
      <div className="flex gap-4 p-6 overflow-x-auto min-h-[calc(100vh-200px)]">
        {COLUMNS.map(col => {
          const colIssues = issues.filter(i => i.status === col.key)
          return (
            <div key={col.key} className="flex-shrink-0 w-64">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{col.label}</span>
                <span className="text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded-full">{colIssues.length}</span>
              </div>
              <Droppable droppableId={col.key}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`space-y-2 min-h-[200px] rounded-xl p-2 transition-colors ${snapshot.isDraggingOver ? 'bg-indigo-900/20 border border-indigo-500/30' : 'bg-gray-900/30'}`}
                  >
                    {colIssues.map((issue, index) => (
                      <Draggable key={issue.id} draggableId={issue.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            onClick={() => onSelect(issue)}
                            className={`bg-gray-900 border rounded-lg p-3 cursor-pointer hover:border-indigo-500/50 transition-all ${snapshot.isDragging ? 'border-indigo-500 shadow-lg shadow-indigo-900/30 rotate-1' : 'border-gray-800'}`}
                          >
                            {issue.title && <p className="text-xs font-medium text-white mb-1 truncate">{issue.title}</p>}
                            <p className="text-xs text-gray-400 line-clamp-2">{issue.comment}</p>
                            <div className="flex items-center justify-between mt-2 gap-1">
                              <PriorityBadge priority={issue.priority} />
                              {issue.assignee && (
                                <span className="text-xs text-gray-500 truncate">{issue.assignee}</span>
                              )}
                            </div>
                            {issue.due_date && (
                              <p className={`text-xs mt-1 ${new Date(issue.due_date) < new Date() ? 'text-red-400' : 'text-gray-600'}`}>
                                Due {new Date(issue.due_date).toLocaleDateString()}
                              </p>
                            )}
                            {(issue.tags ?? []).length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {(issue.tags ?? []).slice(0,2).map(t => (
                                  <span key={t} className="text-xs bg-indigo-900/40 text-indigo-400 px-1.5 rounded">#{t}</span>
                                ))}
                              </div>
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

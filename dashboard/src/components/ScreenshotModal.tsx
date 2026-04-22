import React from 'react'
import { Issue, getScreenshotUrl } from '../lib/supabase'
import StatusBadge from './StatusBadge'

interface Props { issue: Issue; onClose: () => void }

export default function ScreenshotModal({ issue, onClose }: Props) {
  const imgUrl = issue.screenshot_path ? getScreenshotUrl(issue.screenshot_path) : null

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-5 border-b border-gray-800">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <StatusBadge status={issue.status} />
              <span className="text-xs text-gray-500">{issue.reporter_name}</span>
            </div>
            <p className="text-sm text-gray-100">{issue.comment}</p>
            <a
              href={issue.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-indigo-400 hover:text-indigo-300 truncate block mt-1"
            >
              {issue.url}
            </a>
          </div>
          <button
            onClick={onClose}
            className="ml-4 text-gray-500 hover:text-gray-300 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {imgUrl ? (
          <div className="p-4">
            <img
              src={imgUrl}
              alt="Issue screenshot"
              className="w-full rounded-lg border border-gray-700"
            />
            {issue.x != null && (
              <p className="text-xs text-gray-500 mt-2">
                Selection: {issue.width}×{issue.height}px at ({issue.x}, {issue.y})
              </p>
            )}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-600 text-sm">No screenshot captured</div>
        )}

        <div className="px-5 pb-4 text-xs text-gray-600">
          {new Date(issue.created_at).toLocaleString()} · {issue.page_title ?? 'Unknown page'}
        </div>
      </div>
    </div>
  )
}

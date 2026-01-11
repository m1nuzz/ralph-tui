/**
 * ABOUTME: LeftPanel component for the Ralph TUI.
 * Displays the task list with status indicators (done/active/pending/blocked).
 */

import type { ReactNode } from 'react';
import { colors, getTaskStatusColor, getTaskStatusIndicator } from '../theme.js';
import type { LeftPanelProps, TaskItem } from '../types.js';

/**
 * Truncate text to fit within a maximum width
 * Adds ellipsis if text is truncated
 */
function truncateText(text: string, maxWidth: number): string {
  if (text.length <= maxWidth) return text;
  if (maxWidth <= 3) return text.slice(0, maxWidth);
  return text.slice(0, maxWidth - 1) + '…';
}

/**
 * Single task item row
 * Shows: [status indicator] [task ID] [task title (truncated)]
 */
function TaskRow({
  task,
  isSelected,
  maxWidth,
}: {
  task: TaskItem;
  isSelected: boolean;
  /** Maximum width for the entire row content (for truncation) */
  maxWidth: number;
}): ReactNode {
  const statusColor = getTaskStatusColor(task.status);
  const statusIndicator = getTaskStatusIndicator(task.status);

  // Format: "✓ task-id title"
  // Calculate available width: maxWidth - indicator(1) - space(1) - id - space(1)
  const idDisplay = task.id;
  const titleWidth = maxWidth - 3 - idDisplay.length;
  const truncatedTitle = truncateText(task.title, Math.max(5, titleWidth));

  return (
    <box
      style={{
        width: '100%',
        flexDirection: 'row',
        paddingLeft: 1,
        paddingRight: 1,
        backgroundColor: isSelected ? colors.bg.highlight : 'transparent',
      }}
    >
      <text>
        <span fg={statusColor}>{statusIndicator}</span>
        <span fg={colors.fg.muted}> {idDisplay}</span>
        <span fg={isSelected ? colors.fg.primary : colors.fg.secondary}> {truncatedTitle}</span>
      </text>
    </box>
  );
}

/**
 * LeftPanel component showing the scrollable task list
 */
export function LeftPanel({ tasks, selectedIndex, width = 45 }: LeftPanelProps & { width?: number }): ReactNode {
  // Calculate max width for task row content (panel width minus padding and border)
  const maxRowWidth = Math.max(20, width - 4);

  return (
    <box
      title="Tasks"
      style={{
        flexGrow: 1,
        flexShrink: 1,
        minWidth: 30,
        maxWidth: 50,
        flexDirection: 'column',
        backgroundColor: colors.bg.primary,
        border: true,
        borderColor: colors.border.normal,
      }}
    >
      <scrollbox
        style={{
          flexGrow: 1,
          width: '100%',
        }}
      >
        {tasks.length === 0 ? (
          <box style={{ padding: 1 }}>
            <text fg={colors.fg.muted}>No tasks</text>
          </box>
        ) : (
          tasks.map((task, index) => (
            <TaskRow
              key={task.id}
              task={task}
              isSelected={index === selectedIndex}
              maxWidth={maxRowWidth}
            />
          ))
        )}
      </scrollbox>
    </box>
  );
}

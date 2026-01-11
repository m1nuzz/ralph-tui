/**
 * ABOUTME: RightPanel component for the Ralph TUI.
 * Displays the current iteration details or selected task details.
 */

import type { ReactNode } from 'react';
import { colors, getTaskStatusColor, getTaskStatusIndicator } from '../theme.js';
import type { RightPanelProps } from '../types.js';

/**
 * Display when no task is selected
 */
function NoSelection(): ReactNode {
  return (
    <box
      style={{
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <text fg={colors.fg.muted}>Select a task to view details</text>
    </box>
  );
}

/**
 * Task details view
 */
function TaskDetails({
  task,
  currentIteration,
  iterationOutput,
}: {
  task: NonNullable<RightPanelProps['selectedTask']>;
  currentIteration: number;
  iterationOutput?: string;
}): ReactNode {
  const statusColor = getTaskStatusColor(task.status);
  const statusIndicator = getTaskStatusIndicator(task.status);

  return (
    <box style={{ flexDirection: 'column', padding: 1, flexGrow: 1 }}>
      {/* Task title and status */}
      <box style={{ marginBottom: 1 }}>
        <text>
          <span fg={statusColor}>{statusIndicator}</span>
          <span fg={colors.fg.primary}> {task.title}</span>
        </text>
      </box>

      {/* Task metadata */}
      <box style={{ flexDirection: 'row', gap: 2, marginBottom: 1 }}>
        <text fg={colors.fg.muted}>
          ID: <span fg={colors.fg.secondary}>{task.id}</span>
        </text>
        <text fg={colors.fg.muted}>
          Status: <span fg={statusColor}>{task.status}</span>
        </text>
        {task.iteration !== undefined && (
          <text fg={colors.fg.muted}>
            Iteration: <span fg={colors.accent.primary}>{task.iteration}</span>
          </text>
        )}
      </box>

      {/* Task description */}
      {task.description && (
        <box
          style={{
            marginBottom: 1,
            padding: 1,
            backgroundColor: colors.bg.tertiary,
            border: true,
            borderColor: colors.border.muted,
          }}
        >
          <text fg={colors.fg.secondary}>{task.description}</text>
        </box>
      )}

      {/* Current iteration info */}
      <box
        title={`Iteration ${currentIteration}`}
        style={{
          flexGrow: 1,
          border: true,
          borderColor: colors.border.normal,
          backgroundColor: colors.bg.secondary,
        }}
      >
        <scrollbox style={{ flexGrow: 1, padding: 1 }}>
          {iterationOutput ? (
            <text fg={colors.fg.secondary}>{iterationOutput}</text>
          ) : (
            <text fg={colors.fg.muted}>Waiting for iteration output...</text>
          )}
        </scrollbox>
      </box>
    </box>
  );
}

/**
 * RightPanel component showing task details or iteration output
 */
export function RightPanel({
  selectedTask,
  currentIteration,
  iterationOutput,
}: RightPanelProps): ReactNode {
  return (
    <box
      title="Details"
      style={{
        flexGrow: 2,
        flexShrink: 1,
        minWidth: 40,
        flexDirection: 'column',
        backgroundColor: colors.bg.primary,
        border: true,
        borderColor: colors.border.normal,
      }}
    >
      {selectedTask ? (
        <TaskDetails
          task={selectedTask}
          currentIteration={currentIteration}
          iterationOutput={iterationOutput}
        />
      ) : (
        <NoSelection />
      )}
    </box>
  );
}

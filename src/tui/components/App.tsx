/**
 * ABOUTME: Main App component for the Ralph TUI.
 * Composes Header, LeftPanel, RightPanel, and Footer into a responsive layout.
 */

import { useKeyboard, useTerminalDimensions } from '@opentui/react';
import type { ReactNode } from 'react';
import { useState, useCallback, useEffect } from 'react';
import { colors, layout } from '../theme.js';
import type { AppState, TaskItem } from '../types.js';
import { Header } from './Header.js';
import { Footer } from './Footer.js';
import { LeftPanel } from './LeftPanel.js';
import { RightPanel } from './RightPanel.js';

/**
 * Props for the App component
 */
export interface AppProps {
  /** Initial application state */
  initialState?: Partial<AppState>;
  /** Callback when quit is requested */
  onQuit?: () => void;
  /** Callback when Enter is pressed on a task to drill into details */
  onTaskDrillDown?: (task: TaskItem) => void;
}

/**
 * Default demo tasks for initial display
 */
const defaultTasks: TaskItem[] = [
  { id: 'task-1', title: 'Initialize project', status: 'done', description: 'Set up project scaffolding' },
  { id: 'task-2', title: 'Create TUI layout', status: 'active', description: 'Build the core TUI components', iteration: 1 },
  { id: 'task-3', title: 'Implement keyboard nav', status: 'pending', description: 'Add keyboard navigation support' },
  { id: 'task-4', title: 'Add task list view', status: 'pending', description: 'Create scrollable task list' },
  { id: 'task-5', title: 'Blocked by API', status: 'blocked', description: 'Waiting for tracker API implementation' },
];

/**
 * Create default application state
 */
function createDefaultState(tasks: TaskItem[] = defaultTasks): AppState {
  const completedTasks = tasks.filter((t) => t.status === 'done').length;
  const progress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  return {
    header: {
      status: 'running',
      epicName: 'Ralph TUI',
      elapsedTime: 0,
      trackerName: 'beads',
    },
    footer: {
      progress,
      totalTasks: tasks.length,
      completedTasks,
    },
    leftPanel: {
      tasks,
      selectedIndex: 0,
    },
    rightPanel: {
      selectedTask: tasks[0] ?? null,
      currentIteration: 1,
      iterationOutput: 'Starting iteration...',
    },
  };
}

/**
 * Main App component with responsive layout
 */
export function App({ initialState, onQuit, onTaskDrillDown }: AppProps): ReactNode {
  const { width, height } = useTerminalDimensions();
  const [state, setState] = useState<AppState>(() => ({
    ...createDefaultState(),
    ...initialState,
  }));
  const [elapsedTime, setElapsedTime] = useState(state.header.elapsedTime);

  // Update elapsed time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Handle keyboard navigation
  const handleKeyboard = useCallback(
    (key: { name: string }) => {
      const { tasks, selectedIndex } = state.leftPanel;

      switch (key.name) {
        case 'q':
        case 'escape':
          onQuit?.();
          process.exit(0);
          break;

        case 'up':
        case 'k':
          if (selectedIndex > 0) {
            const newIndex = selectedIndex - 1;
            setState((prev) => ({
              ...prev,
              leftPanel: { ...prev.leftPanel, selectedIndex: newIndex },
              rightPanel: { ...prev.rightPanel, selectedTask: tasks[newIndex] ?? null },
            }));
          }
          break;

        case 'down':
        case 'j':
          if (selectedIndex < tasks.length - 1) {
            const newIndex = selectedIndex + 1;
            setState((prev) => ({
              ...prev,
              leftPanel: { ...prev.leftPanel, selectedIndex: newIndex },
              rightPanel: { ...prev.rightPanel, selectedTask: tasks[newIndex] ?? null },
            }));
          }
          break;

        case 'p':
          // Toggle pause/resume
          setState((prev) => ({
            ...prev,
            header: {
              ...prev.header,
              status: prev.header.status === 'running' ? 'paused' : 'running',
            },
          }));
          break;

        case 'return':
        case 'enter':
          // Drill into selected task details
          if (tasks[selectedIndex]) {
            onTaskDrillDown?.(tasks[selectedIndex]);
          }
          break;
      }
    },
    [state.leftPanel, onQuit, onTaskDrillDown]
  );

  useKeyboard(handleKeyboard);

  // Calculate content area height (total height minus header and footer)
  const contentHeight = Math.max(1, height - layout.header.height - layout.footer.height);

  // Determine if we should use a compact layout for narrow terminals
  const isCompact = width < 80;

  return (
    <box
      style={{
        width: '100%',
        height: '100%',
        flexDirection: 'column',
        backgroundColor: colors.bg.primary,
      }}
    >
      {/* Header */}
      <Header
        status={state.header.status}
        epicName={state.header.epicName}
        elapsedTime={elapsedTime}
        trackerName={state.header.trackerName}
      />

      {/* Main content area */}
      <box
        style={{
          flexGrow: 1,
          flexDirection: isCompact ? 'column' : 'row',
          height: contentHeight,
        }}
      >
        <LeftPanel
          tasks={state.leftPanel.tasks}
          selectedIndex={state.leftPanel.selectedIndex}
        />
        <RightPanel
          selectedTask={state.rightPanel.selectedTask}
          currentIteration={state.rightPanel.currentIteration}
          iterationOutput={state.rightPanel.iterationOutput}
        />
      </box>

      {/* Footer */}
      <Footer
        progress={state.footer.progress}
        totalTasks={state.footer.totalTasks}
        completedTasks={state.footer.completedTasks}
      />
    </box>
  );
}

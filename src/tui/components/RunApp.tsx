/**
 * ABOUTME: RunApp component for the Ralph TUI execution view.
 * Integrates with the execution engine to display real-time progress.
 */

import { useKeyboard, useTerminalDimensions } from '@opentui/react';
import type { ReactNode } from 'react';
import { useState, useCallback, useEffect } from 'react';
import { colors, layout } from '../theme.js';
import type { RalphStatus, TaskStatus } from '../theme.js';
import type { TaskItem } from '../types.js';
import { Header } from './Header.js';
import { Footer } from './Footer.js';
import { LeftPanel } from './LeftPanel.js';
import { RightPanel } from './RightPanel.js';
import { IterationHistoryView } from './IterationHistoryView.js';
import type { ExecutionEngine, EngineEvent, IterationResult } from '../../engine/index.js';

/**
 * View modes for the RunApp component
 * - 'tasks': Show the task list (default)
 * - 'iterations': Show the iteration history
 */
type ViewMode = 'tasks' | 'iterations';

/**
 * Props for the RunApp component
 */
export interface RunAppProps {
  /** The execution engine instance */
  engine: ExecutionEngine;
  /** Callback when quit is requested */
  onQuit?: () => Promise<void>;
  /** Callback when Enter is pressed on a task to drill into details */
  onTaskDrillDown?: (task: TaskItem) => void;
  /** Callback when Enter is pressed on an iteration to drill into details */
  onIterationDrillDown?: (iteration: IterationResult) => void;
}

/**
 * Convert engine status to Ralph status
 */
function engineStatusToRalphStatus(
  engineStatus: string,
  hasError: boolean
): RalphStatus {
  if (hasError) return 'error';
  switch (engineStatus) {
    case 'running':
      return 'running';
    case 'paused':
      return 'paused';
    case 'stopping':
    case 'idle':
      return 'stopped';
    default:
      return 'stopped';
  }
}

// Note: trackerStatusToTaskStatus is reserved for future use when
// we load initial task state from the tracker

/**
 * Main RunApp component for execution view
 */
export function RunApp({ engine, onQuit, onTaskDrillDown, onIterationDrillDown }: RunAppProps): ReactNode {
  const { width, height } = useTerminalDimensions();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [status, setStatus] = useState<RalphStatus>('running');
  const [currentIteration, setCurrentIteration] = useState(0);
  const [currentOutput, setCurrentOutput] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [epicName] = useState('Ralph');
  const [trackerName] = useState('beads');
  // Iteration history state
  const [iterations, setIterations] = useState<IterationResult[]>([]);
  const [totalIterations] = useState(10); // Default max iterations for display
  const [viewMode, setViewMode] = useState<ViewMode>('tasks');
  const [iterationSelectedIndex, setIterationSelectedIndex] = useState(0);

  // Subscribe to engine events
  useEffect(() => {
    const unsubscribe = engine.on((event: EngineEvent) => {
      switch (event.type) {
        case 'engine:started':
          setStatus('running');
          break;

        case 'engine:stopped':
          setStatus('stopped');
          if (event.reason === 'error') {
            setHasError(true);
          }
          break;

        case 'engine:paused':
          setStatus('paused');
          break;

        case 'engine:resumed':
          setStatus('running');
          break;

        case 'iteration:started':
          setCurrentIteration(event.iteration);
          setCurrentOutput('');
          // Update task list to show current task as active
          setTasks((prev) =>
            prev.map((t) =>
              t.id === event.task.id ? { ...t, status: 'active' as TaskStatus } : t
            )
          );
          // Select the current task
          setTasks((prev) => {
            const idx = prev.findIndex((t) => t.id === event.task.id);
            if (idx !== -1) {
              setSelectedIndex(idx);
            }
            return prev;
          });
          break;

        case 'iteration:completed':
          if (event.result.taskCompleted) {
            setTasks((prev) =>
              prev.map((t) =>
                t.id === event.result.task.id
                  ? { ...t, status: 'done' as TaskStatus }
                  : t
              )
            );
          }
          // Add iteration result to history
          setIterations((prev) => {
            // Replace existing iteration or add new
            const existing = prev.findIndex((i) => i.iteration === event.result.iteration);
            if (existing !== -1) {
              const updated = [...prev];
              updated[existing] = event.result;
              return updated;
            }
            return [...prev, event.result];
          });
          break;

        case 'iteration:failed':
          setTasks((prev) =>
            prev.map((t) =>
              t.id === event.task.id ? { ...t, status: 'blocked' as TaskStatus } : t
            )
          );
          break;

        case 'task:selected':
          // Add task if not present
          setTasks((prev) => {
            const exists = prev.some((t) => t.id === event.task.id);
            if (exists) return prev;
            return [
              ...prev,
              {
                id: event.task.id,
                title: event.task.title,
                status: 'pending' as TaskStatus,
                description: event.task.description,
                iteration: event.iteration,
              },
            ];
          });
          break;

        case 'task:completed':
          setTasks((prev) =>
            prev.map((t) =>
              t.id === event.task.id ? { ...t, status: 'done' as TaskStatus } : t
            )
          );
          break;

        case 'agent:output':
          if (event.stream === 'stdout') {
            setCurrentOutput((prev) => prev + event.data);
          }
          break;
      }
    });

    return unsubscribe;
  }, [engine]);

  // Update elapsed time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Get initial state from engine
  useEffect(() => {
    const state = engine.getState();
    setCurrentIteration(state.currentIteration);
    setCurrentOutput(state.currentOutput);
  }, [engine]);

  // Calculate the number of items in iteration history (iterations + pending)
  const iterationHistoryLength = Math.max(iterations.length, totalIterations);

  // Handle keyboard navigation
  const handleKeyboard = useCallback(
    (key: { name: string }) => {
      switch (key.name) {
        case 'q':
        case 'escape':
          onQuit?.();
          break;

        case 'up':
        case 'k':
          if (viewMode === 'tasks') {
            setSelectedIndex((prev) => Math.max(0, prev - 1));
          } else {
            setIterationSelectedIndex((prev) => Math.max(0, prev - 1));
          }
          break;

        case 'down':
        case 'j':
          if (viewMode === 'tasks') {
            setSelectedIndex((prev) => Math.min(tasks.length - 1, prev + 1));
          } else {
            setIterationSelectedIndex((prev) => Math.min(iterationHistoryLength - 1, prev + 1));
          }
          break;

        case 'p':
          // Toggle pause/resume
          if (status === 'running') {
            engine.pause();
          } else if (status === 'paused') {
            engine.resume();
          }
          break;

        case 'c':
          // Ctrl+C to stop
          if (key.name === 'c') {
            engine.stop();
          }
          break;

        case 'i':
          // Toggle between tasks and iterations view
          setViewMode((prev) => (prev === 'tasks' ? 'iterations' : 'tasks'));
          break;

        case 't':
          // Switch to tasks view
          setViewMode('tasks');
          break;

        case 'return':
        case 'enter':
          if (viewMode === 'tasks') {
            // Drill into selected task details
            if (tasks[selectedIndex]) {
              onTaskDrillDown?.(tasks[selectedIndex]);
            }
          } else {
            // Drill into selected iteration details
            if (iterations[iterationSelectedIndex]) {
              onIterationDrillDown?.(iterations[iterationSelectedIndex]);
            }
          }
          break;
      }
    },
    [tasks, selectedIndex, status, engine, onQuit, onTaskDrillDown, viewMode, iterations, iterationSelectedIndex, iterationHistoryLength, onIterationDrillDown]
  );

  useKeyboard(handleKeyboard);

  // Calculate layout
  const contentHeight = Math.max(
    1,
    height - layout.header.height - layout.footer.height
  );
  const isCompact = width < 80;

  // Calculate progress
  const completedTasks = tasks.filter((t) => t.status === 'done').length;
  const totalTasks = tasks.length;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Get selected task
  const selectedTask = tasks[selectedIndex] ?? null;

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
        status={engineStatusToRalphStatus(engine.getStatus(), hasError)}
        epicName={epicName}
        elapsedTime={elapsedTime}
        trackerName={trackerName || 'beads'}
      />

      {/* Main content area */}
      <box
        style={{
          flexGrow: 1,
          flexDirection: isCompact ? 'column' : 'row',
          height: contentHeight,
        }}
      >
        {viewMode === 'tasks' ? (
          <LeftPanel tasks={tasks} selectedIndex={selectedIndex} />
        ) : (
          <IterationHistoryView
            iterations={iterations}
            totalIterations={totalIterations}
            selectedIndex={iterationSelectedIndex}
            runningIteration={currentIteration}
            width={isCompact ? width : Math.floor(width * 0.5)}
          />
        )}
        <RightPanel
          selectedTask={selectedTask}
          currentIteration={currentIteration}
          iterationOutput={currentOutput}
        />
      </box>

      {/* Footer */}
      <Footer
        progress={progress}
        totalTasks={totalTasks}
        completedTasks={completedTasks}
      />
    </box>
  );
}

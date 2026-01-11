/**
 * ABOUTME: Type definitions for Ralph TUI components.
 * Defines the data structures and props used across the TUI layout components.
 */

import type { TaskStatus, RalphStatus } from './theme.js';
import type { IterationResult } from '../engine/types.js';

/**
 * Task item displayed in the task list
 */
export interface TaskItem {
  id: string;
  title: string;
  status: TaskStatus;
  description?: string;
  iteration?: number;
}

/**
 * Props for the Header component
 */
export interface HeaderProps {
  /** Current Ralph execution status */
  status: RalphStatus;
  /** Name of the current epic/project */
  epicName: string;
  /** Elapsed time in seconds */
  elapsedTime: number;
  /** Name of the tracker being used (e.g., 'beads', 'jira') */
  trackerName: string;
}

/**
 * Props for the Footer component
 */
export interface FooterProps {
  /** Progress percentage (0-100) */
  progress: number;
  /** Total number of tasks */
  totalTasks: number;
  /** Number of completed tasks */
  completedTasks: number;
}

/**
 * Props for the LeftPanel (task list) component
 */
export interface LeftPanelProps {
  /** List of tasks to display */
  tasks: TaskItem[];
  /** Currently selected task index */
  selectedIndex: number;
  /** Callback when a task is selected (keyboard navigation) */
  onSelectTask?: (index: number) => void;
  /** Callback when Enter is pressed to drill into task details */
  onTaskDrillDown?: (task: TaskItem) => void;
}

/**
 * Props for the RightPanel (details) component
 */
export interface RightPanelProps {
  /** Currently selected task (null if none selected) */
  selectedTask: TaskItem | null;
  /** Current iteration number */
  currentIteration: number;
  /** Current iteration output/log */
  iterationOutput?: string;
}

/**
 * Overall application state for the TUI
 */
export interface AppState {
  header: HeaderProps;
  footer: FooterProps;
  leftPanel: LeftPanelProps;
  rightPanel: RightPanelProps;
}

/**
 * Props for the IterationHistoryPanel component
 */
export interface IterationHistoryPanelProps {
  /** List of iteration results */
  iterations: IterationResult[];
  /** Total number of iterations planned */
  totalIterations: number;
  /** Currently selected iteration index */
  selectedIndex: number;
  /** Current running iteration number (0 if none running) */
  runningIteration: number;
  /** Callback when Enter is pressed to drill into iteration details */
  onIterationDrillDown?: (iteration: IterationResult) => void;
}

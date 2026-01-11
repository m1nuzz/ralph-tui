/**
 * ABOUTME: Footer component for the Ralph TUI.
 * Displays keyboard shortcuts and a progress bar showing task completion.
 */

import type { ReactNode } from 'react';
import { colors, keyboardShortcuts, layout } from '../theme.js';
import type { FooterProps } from '../types.js';

/**
 * Progress bar component showing task completion
 */
function ProgressBar({ progress, width }: { progress: number; width: number }): ReactNode {
  // Ensure progress is between 0 and 100
  const normalizedProgress = Math.max(0, Math.min(100, progress));
  const filledWidth = Math.floor((normalizedProgress / 100) * width);
  const emptyWidth = width - filledWidth;

  const filledBar = '█'.repeat(filledWidth);
  const emptyBar = '░'.repeat(emptyWidth);

  return (
    <text>
      <span fg={colors.status.success}>{filledBar}</span>
      <span fg={colors.fg.dim}>{emptyBar}</span>
      <span fg={colors.fg.secondary}> {normalizedProgress}%</span>
    </text>
  );
}

/**
 * Footer component showing keyboard shortcuts and progress
 */
export function Footer({ progress, totalTasks, completedTasks }: FooterProps): ReactNode {
  // Format keyboard shortcuts as a single string
  const shortcutText = keyboardShortcuts
    .map(({ key, description }) => `${key}:${description}`)
    .join('  ');

  return (
    <box
      style={{
        width: '100%',
        height: layout.footer.height,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.bg.secondary,
        paddingLeft: 1,
        paddingRight: 1,
        border: true,
        borderColor: colors.border.normal,
      }}
    >
      {/* Left section: Keyboard shortcuts */}
      <box style={{ flexShrink: 1, overflow: 'hidden' }}>
        <text fg={colors.fg.muted}>{shortcutText}</text>
      </box>

      {/* Right section: Progress bar and task count (X/Y complete format) */}
      <box style={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
        <text fg={colors.fg.secondary}>
          {completedTasks}/{totalTasks} complete
        </text>
        <ProgressBar progress={progress} width={20} />
      </box>
    </box>
  );
}

/**
 * ABOUTME: TUI-native formatted text rendering component.
 * Renders FormattedSegment arrays with proper theme colors using OpenTUI's
 * native color support instead of ANSI escape codes.
 */

import type { ReactNode } from 'react';
import { colors } from '../theme.js';
import type { FormattedSegment, SegmentColor } from '../../plugins/agents/output-formatting.js';

// Re-export types for convenience
export type { FormattedSegment, SegmentColor };

/**
 * Map semantic color names to TUI theme hex colors.
 */
const COLOR_MAP: Record<SegmentColor, string> = {
  blue: colors.accent.primary,      // #7aa2f7 - tool names
  purple: colors.accent.secondary,  // #bb9af7 - file paths
  cyan: colors.accent.tertiary,     // #7dcfff - patterns/URLs
  green: colors.status.success,     // #9ece6a - success
  yellow: colors.status.warning,    // #e0af68 - queries/warnings
  pink: colors.status.error,        // #f7768e - errors
  muted: colors.fg.muted,           // #565f89 - secondary info
  default: colors.fg.primary,       // #c0caf5 - normal text
};

/**
 * Props for FormattedText component.
 */
export interface FormattedTextProps {
  /** Array of formatted segments to render */
  segments: FormattedSegment[];
}

/**
 * Render an array of formatted segments with TUI-native colors.
 * Each segment gets its own <text> element with the appropriate fg color.
 */
export function FormattedText({ segments }: FormattedTextProps): ReactNode {
  if (segments.length === 0) {
    return null;
  }

  return (
    <>
      {segments.map((segment, index) => {
        const color = COLOR_MAP[segment.color ?? 'default'];
        return (
          <text key={index} fg={color}>
            {segment.text}
          </text>
        );
      })}
    </>
  );
}

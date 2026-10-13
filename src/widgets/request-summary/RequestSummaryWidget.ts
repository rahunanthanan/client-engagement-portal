import { h, type ComponentChild } from 'preact';

/**
 * NEW LEARNING: a Preact widget (≈4 KB runtime) embedded in the React app.
 *
 * Why Preact here: this widget is designed to also be dropped into lightweight pages that do not
 * ship React (e.g. an intranet landing page). It is isolated: it receives plain data via props,
 * uses no React context, and styles itself with the shared CSS custom properties (`--cep-*`).
 * Written with `h()` instead of JSX so the React JSX transform used by the rest of the app does not
 * need a per-file pragma.
 */
export interface RequestSummaryProps {
  counts: { label: string; value: number; tone: 'neutral' | 'info' | 'warning' | 'success' | 'danger' }[];
  title: string;
  onSelect?: (label: string) => void;
}

const toneColour: Record<RequestSummaryProps['counts'][number]['tone'], string> = {
  neutral: 'var(--cep-color-textMuted)',
  info: 'var(--cep-color-brand)',
  warning: 'var(--cep-color-warning)',
  success: 'var(--cep-color-success)',
  danger: 'var(--cep-color-danger)',
};

export function RequestSummaryWidget({ counts, title, onSelect }: RequestSummaryProps): ComponentChild {
  return h(
    'section',
    {
      'aria-label': title,
      style: {
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.max(counts.length, 1)}, minmax(90px, 1fr))`,
        gap: 'var(--cep-spacing)',
        fontFamily: 'var(--cep-font-family)',
      },
    },
    counts.map((c) =>
      h(
        'button',
        {
          type: 'button',
          key: c.label,
          onClick: () => onSelect?.(c.label),
          style: {
            textAlign: 'left',
            cursor: onSelect ? 'pointer' : 'default',
            padding: 'calc(var(--cep-spacing) * 1.5)',
            border: '1px solid var(--cep-color-border)',
            borderTop: `4px solid ${toneColour[c.tone]}`,
            borderRadius: 'var(--cep-radius-md)',
            background: 'var(--cep-color-surfaceRaised)',
            color: 'var(--cep-color-text)',
            font: 'inherit',
          },
        },
        h('div', { style: { fontSize: '1.6rem', fontWeight: 600 } }, String(c.value)),
        h('div', { style: { fontSize: '0.85rem', color: 'var(--cep-color-textMuted)' } }, c.label),
      ),
    ),
  );
}

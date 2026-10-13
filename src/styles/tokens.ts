/**
 * Shared design tokens — the single source of truth for colour, spacing, radius and type.
 * Consumed by the MUI theme (theme.ts) and exposed as CSS custom properties (`--cep-*`) for SCSS
 * and for non-React widgets (the Preact summary widget, bpmn-js/dmn-js overlays).
 */
export const tokens = {
  color: {
    brand: '#1B4F8A',
    brandStrong: '#123A66',
    brandSubtle: '#E7EEF7',
    accent: '#0F7B6C',
    surface: '#F5F7FA',
    surfaceRaised: '#FFFFFF',
    border: '#D5DCE5',
    text: '#1C2430',
    textMuted: '#536173',
    success: '#2E7D32',
    warning: '#B26A00',
    danger: '#B3261E',
    highlight: '#FFB74D',
  },
  radius: { sm: 4, md: 8, lg: 12 },
  spacingUnit: 8,
  font: {
    family: '"Inter", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    sizeBase: 14,
  },
} as const;

/** Flattens tokens into CSS custom properties, e.g. `--cep-color-brand`. */
export function tokensAsCssVariables(): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [name, value] of Object.entries(tokens.color)) vars[`--cep-color-${name}`] = value;
  for (const [name, value] of Object.entries(tokens.radius)) vars[`--cep-radius-${name}`] = `${value}px`;
  vars['--cep-spacing'] = `${tokens.spacingUnit}px`;
  vars['--cep-font-family'] = tokens.font.family;
  return vars;
}

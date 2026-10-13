import { Typography, type TypographyProps } from '@mui/material';

/**
 * Renders text that came from users or the server. React escapes it, so markup such as
 * `<img onerror=...>` is displayed literally and never executed. Line breaks are preserved.
 * (`dangerouslySetInnerHTML` is banned by the ESLint config.)
 */
export function UserText({ text, ...props }: { text: string | null | undefined } & TypographyProps) {
  if (!text) return null;
  // eslint-disable-next-line no-control-regex
  const cleaned = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  return (
    <Typography {...props} sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', ...props.sx }}>
      {cleaned}
    </Typography>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Alert } from '@mui/material';
import { FormEditor } from '@bpmn-io/form-js';
import '@bpmn-io/form-js/dist/assets/form-js.css';
import '@bpmn-io/form-js/dist/assets/form-js-editor.css';

/**
 * NEW LEARNING: form-js visual editor. This is the ALTERNATIVE form technology: it edits form-js JSON,
 * not the custom typed schema used by DynamicForm. See docs/ARCHITECTURE.md for the boundary.
 */
export default function FormJsEditor({ schema, onChange }: { schema: Record<string, unknown>; onChange: (schema: Record<string, unknown>) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!container.current) return undefined;
    const editor = new FormEditor({ container: container.current });
    let disposed = false;
    editor
      .importSchema(schema as never)
      .then(() => {
        editor.on('changed', () => {
          if (!disposed) onChangeRef.current(editor.saveSchema() as unknown as Record<string, unknown>);
        });
      })
      .catch((e: unknown) => !disposed && setError(e instanceof Error ? e.message : 'Form could not be loaded.'));
    return () => {
      disposed = true;
      editor.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return <Alert severity="error">{error}</Alert>;
  return <div ref={container} className="cep-formjs" />;
}

import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Typography } from '@mui/material';
import { Form } from '@bpmn-io/form-js';
import '@bpmn-io/form-js/dist/assets/form-js.css';

/** form-js runtime viewer: renders a form-js schema and returns its submitted data. */
export default function FormJsViewer({ schema }: { schema: Record<string, unknown> }) {
  const container = useRef<HTMLDivElement>(null);
  const formRef = useRef<Form | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!container.current) return undefined;
    const form = new Form({ container: container.current });
    formRef.current = form;
    form.importSchema(schema as never, {}).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Form could not be displayed.'));
    return () => {
      formRef.current = null;
      form.destroy();
    };
  }, [schema]);

  const submit = () => {
    const outcome = formRef.current?.submit();
    if (!outcome) return;
    setResult(Object.keys(outcome.errors).length ? `Fix ${Object.keys(outcome.errors).length} error(s).` : JSON.stringify(outcome.data, null, 2));
  };

  if (error) return <Alert severity="error">{error}</Alert>;
  return (
    <Box>
      <div ref={container} className="cep-formjs" />
      <Button variant="outlined" sx={{ mt: 1 }} onClick={submit}>
        Preview submit
      </Button>
      {result && (
        <Typography component="pre" variant="body2" sx={{ mt: 1, p: 1, bgcolor: 'grey.100', borderRadius: 1, overflow: 'auto' }}>
          {result}
        </Typography>
      )}
    </Box>
  );
}

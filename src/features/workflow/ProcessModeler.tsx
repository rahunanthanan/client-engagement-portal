import { useEffect, useRef, useState } from 'react';
import { Alert } from '@mui/material';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';

/**
 * NEW LEARNING: editable BPMN modeler (bpmn-js) for administrators. Changes are emitted as XML; the
 * definition only becomes active after the backend approves it (simulated here).
 */
export default function ProcessModeler({ xml, onChange }: { xml: string; onChange: (xml: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!container.current) return undefined;
    const modeler = new BpmnModeler({ container: container.current });
    let disposed = false;
    modeler
      .importXML(xml)
      .then(() => {
        if (disposed) return;
        modeler.get<{ zoom(level: string): void }>('canvas').zoom('fit-viewport');
        modeler.on('commandStack.changed', async () => {
          const { xml: next } = await modeler.saveXML({ format: true });
          if (next && !disposed) onChangeRef.current(next);
        });
      })
      .catch((e: unknown) => !disposed && setError(e instanceof Error ? e.message : 'Diagram could not be loaded.'));
    return () => {
      disposed = true;
      modeler.destroy();
    };
    // Re-importing on every keystroke would reset the canvas; xml is only the initial document.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return <Alert severity="error">{error}</Alert>;
  return <div ref={container} className="cep-diagram cep-diagram--tall" aria-label="BPMN process editor" />;
}

import { useEffect, useRef, useState } from 'react';
import { Alert } from '@mui/material';
import DmnModeler from 'dmn-js/lib/Modeler';
import DmnViewer from 'dmn-js/lib/Viewer';
import 'dmn-js/dist/assets/diagram-js.css';
import 'dmn-js/dist/assets/dmn-js-shared.css';
import 'dmn-js/dist/assets/dmn-js-drd.css';
import 'dmn-js/dist/assets/dmn-js-decision-table.css';
import 'dmn-js/dist/assets/dmn-js-decision-table-controls.css';
import 'dmn-js/dist/assets/dmn-font/css/dmn-embedded.css';

/**
 * dmn-js decision table. In "view" mode the rules the BACKEND matched are highlighted; in "edit" mode
 * administrators can change the table (NEW LEARNING). The UI never evaluates the decision itself.
 */
export default function DecisionTable({
  xml,
  matchedRuleIds = [],
  mode = 'view',
  onChange,
}: {
  xml: string;
  matchedRuleIds?: string[];
  mode?: 'view' | 'edit';
  onChange?: (xml: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const el = container.current;
    if (!el) return undefined;
    const instance = mode === 'edit' ? new DmnModeler({ container: el }) : new DmnViewer({ container: el });
    let disposed = false;

    const highlight = () => {
      el.querySelectorAll('.cep-matched-rule').forEach((n) => n.classList.remove('cep-matched-rule'));
      matchedRuleIds.forEach((id) => el.querySelectorAll(`[data-row-id="${CSS.escape(id)}"]`).forEach((cell) => cell.classList.add('cep-matched-rule')));
    };

    instance
      .importXML(xml)
      .then(async () => {
        const table = instance.getViews().find((v) => v.type === 'decisionTable');
        if (table) await instance.open(table);
        if (disposed) return;
        highlight();
        instance.on('views.changed', highlight);
        if (mode === 'edit') {
          // dmn-js re-serialises differently from the source XML, so compare against a post-import baseline:
          // switching views or no-op edits must not mark the definition as changed.
          const { xml: baseline } = await instance.saveXML({ format: true });
          const emit = async () => {
            const { xml: next } = await instance.saveXML({ format: true });
            if (!disposed) onChangeRef.current?.(next === baseline ? xml : next);
          };
          instance.on('views.changed', () => void emit());
          instance.getActiveViewer()?.get<{ on(e: string, cb: () => void): void }>('eventBus').on('elements.changed', () => void emit());
        }
      })
      .catch((e: unknown) => !disposed && setError(e instanceof Error ? e.message : 'Decision table could not be displayed.'));

    return () => {
      disposed = true;
      instance.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xml, mode, matchedRuleIds.join(',')]);

  if (error) return <Alert severity="error">{error}</Alert>;
  return <div ref={container} className="cep-dmn" aria-label="Risk tier decision table" />;
}

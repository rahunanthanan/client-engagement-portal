import { useEffect, useRef, useState } from 'react';
import { Alert } from '@mui/material';
import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';

interface Canvas {
  addMarker(elementId: string, marker: string): void;
  zoom(level: 'fit-viewport'): void;
}
interface ElementRegistry {
  get(id: string): unknown;
}

/**
 * Read-only BPMN diagram (bpmn-js) with the CURRENT activity and completed activities highlighted.
 * Which activity is current is decided by the backend (`request.workflow`), never by the UI.
 * Lazy-loaded: bpmn-js is only downloaded when this component is first rendered.
 */
export default function ProcessViewer({ xml, currentActivityId, completedActivityIds = [] }: { xml: string; currentActivityId?: string | null; completedActivityIds?: string[] }) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!container.current) return undefined;
    const viewer = new NavigatedViewer({ container: container.current });
    let disposed = false;
    viewer
      .importXML(xml)
      .then(() => {
        if (disposed) return;
        const canvas = viewer.get<Canvas>('canvas');
        const registry = viewer.get<ElementRegistry>('elementRegistry');
        canvas.zoom('fit-viewport');
        completedActivityIds.filter((id) => registry.get(id)).forEach((id) => canvas.addMarker(id, 'cep-completed'));
        if (currentActivityId && registry.get(currentActivityId)) canvas.addMarker(currentActivityId, 'cep-current');
      })
      .catch((e: unknown) => !disposed && setError(e instanceof Error ? e.message : 'Diagram could not be displayed.'));
    return () => {
      disposed = true;
      viewer.destroy();
    };
  }, [xml, currentActivityId, completedActivityIds]);

  if (error) return <Alert severity="error">The process diagram could not be displayed: {error}</Alert>;
  return <div ref={container} className="cep-diagram" role="img" aria-label={`Process diagram. Current step: ${currentActivityId ?? 'none (finished)'}`} />;
}

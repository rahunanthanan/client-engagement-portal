import { useEffect, useRef } from 'react';
import { h, render } from 'preact';
import { RequestSummaryWidget, type RequestSummaryProps } from './RequestSummaryWidget';

/**
 * React → Preact bridge. React owns the container <div>; Preact owns everything inside it.
 * Props are pushed in on every change; Preact unmounts when React does.
 */
export function RequestSummaryIsland(props: RequestSummaryProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) render(h(RequestSummaryWidget, props), el);
  });

  useEffect(() => {
    const el = ref.current;
    return () => {
      if (el) render(null, el);
    };
  }, []);

  return <div ref={ref} data-testid="preact-summary-widget" />;
}

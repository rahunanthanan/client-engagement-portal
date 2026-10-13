// Minimal typings for dmn-js, which does not ship TypeScript declarations.
declare module 'dmn-js/lib/Viewer' {
  export interface DmnView {
    type: 'drd' | 'decisionTable' | 'literalExpression' | 'boxedExpression';
    element: { id: string };
  }
  export interface DmnActiveViewer {
    get<T = unknown>(service: string): T;
  }
  export default class DmnViewer {
    constructor(options: { container: HTMLElement; common?: Record<string, unknown> });
    importXML(xml: string): Promise<{ warnings: unknown[] }>;
    saveXML(options?: { format?: boolean }): Promise<{ xml: string }>;
    getViews(): DmnView[];
    getActiveView(): DmnView | undefined;
    getActiveViewer(): DmnActiveViewer | undefined;
    open(view: DmnView): Promise<unknown>;
    on(event: string, callback: (...args: unknown[]) => void): void;
    destroy(): void;
  }
}

declare module 'dmn-js/lib/Modeler' {
  import DmnViewer from 'dmn-js/lib/Viewer';
  export default class DmnModeler extends DmnViewer {}
}

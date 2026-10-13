import type { FieldSchema, FormSchema, RowFieldSchema } from '../schema/types';
import { collectRefs, isRowRef } from './rules';

/**
 * Dependency graph between fields.
 *
 * An edge `A -> B` means "B depends on A" (B's visibility, required rule or options
 * are computed from A). Row-level fields are addressed as `repeatableId.fieldId`.
 */
export interface DependencyGraph {
  nodes: Set<string>;
  /** dependency -> dependents */
  dependents: Map<string, Set<string>>;
  /** dependent -> dependencies */
  dependencies: Map<string, Set<string>>;
}

function addEdge(graph: DependencyGraph, from: string, to: string): void {
  graph.nodes.add(from);
  graph.nodes.add(to);
  if (!graph.dependents.has(from)) graph.dependents.set(from, new Set());
  if (!graph.dependencies.has(to)) graph.dependencies.set(to, new Set());
  graph.dependents.get(from)!.add(to);
  graph.dependencies.get(to)!.add(from);
}

function refToNode(ref: string, repeatableId?: string): string {
  if (isRowRef(ref) && repeatableId) return `${repeatableId}.${ref.slice(4)}`;
  return ref;
}

/** All refs a field depends on (conditions, option parents, read-only sources). */
export function fieldDependencies(field: FieldSchema | RowFieldSchema): Set<string> {
  const refs = new Set<string>();
  collectRefs(field.visibleWhen, refs);
  if ('requiredWhen' in field) collectRefs(field.requiredWhen, refs);
  if (field.type === 'dropdown' && field.options.source === 'api') field.options.dependsOn?.forEach((r) => refs.add(r));
  if (field.type === 'readonly' && 'field' in field.source) refs.add(field.source.field);
  return refs;
}

export function buildDependencyGraph(schema: FormSchema): DependencyGraph {
  const graph: DependencyGraph = { nodes: new Set(), dependents: new Map(), dependencies: new Map() };

  for (const section of schema.sections) {
    const sectionRefs = collectRefs(section.visibleWhen);
    for (const field of section.fields) {
      graph.nodes.add(field.id);
      sectionRefs.forEach((ref) => addEdge(graph, ref, field.id));
      fieldDependencies(field).forEach((ref) => addEdge(graph, refToNode(ref), field.id));

      if (field.type === 'repeatable') {
        for (const rowField of field.fields) {
          const node = `${field.id}.${rowField.id}`;
          graph.nodes.add(node);
          fieldDependencies(rowField).forEach((ref) => addEdge(graph, refToNode(ref, field.id), node));
        }
      }
    }
  }
  return graph;
}

/** Returns the first dependency cycle found (e.g. `['a', 'b', 'a']`) or `null`. */
export function findCycle(graph: DependencyGraph): string[] | null {
  const WHITE = 0;
  const GREY = 1;
  const BLACK = 2;
  const colour = new Map<string, number>();
  const stack: string[] = [];

  const visit = (node: string): string[] | null => {
    colour.set(node, GREY);
    stack.push(node);
    for (const next of graph.dependents.get(node) ?? []) {
      const c = colour.get(next) ?? WHITE;
      if (c === GREY) return [...stack.slice(stack.indexOf(next)), next];
      if (c === WHITE) {
        const cycle = visit(next);
        if (cycle) return cycle;
      }
    }
    stack.pop();
    colour.set(node, BLACK);
    return null;
  };

  for (const node of [...graph.nodes].sort()) {
    if ((colour.get(node) ?? WHITE) === WHITE) {
      const cycle = visit(node);
      if (cycle) return cycle;
    }
  }
  return null;
}

/** Topological order (dependencies first). Throws if the graph has a cycle. */
export function topologicalOrder(graph: DependencyGraph): string[] {
  const inDegree = new Map<string, number>();
  graph.nodes.forEach((n) => inDegree.set(n, graph.dependencies.get(n)?.size ?? 0));
  const queue = [...graph.nodes].filter((n) => inDegree.get(n) === 0).sort();
  const order: string[] = [];
  while (queue.length) {
    const node = queue.shift()!;
    order.push(node);
    for (const dependent of graph.dependents.get(node) ?? []) {
      const remaining = (inDegree.get(dependent) ?? 0) - 1;
      inDegree.set(dependent, remaining);
      if (remaining === 0) queue.push(dependent);
    }
  }
  if (order.length !== graph.nodes.size) throw new Error('Dependency graph contains a cycle');
  return order;
}

/** Transitive dependents of a field, used to cascade clears when a parent changes. */
export function transitiveDependents(graph: DependencyGraph, fieldId: string): Set<string> {
  const result = new Set<string>();
  const queue = [fieldId];
  while (queue.length) {
    const current = queue.shift()!;
    for (const dependent of graph.dependents.get(current) ?? []) {
      if (!result.has(dependent)) {
        result.add(dependent);
        queue.push(dependent);
      }
    }
  }
  return result;
}

import { createDescartesLayers } from './descartes-graph.js';
import { createFermatLayers } from './fermat-graph.js';
import { createBarrowLayers } from './barrow-graph.js';
import { createModernLayers } from './modern-graph.js';

/** Selects the construction used by a graph board. */
export function createMethodLayers(graph, method) {
  const builders = {
    descartes: createDescartesLayers,
    fermat: createFermatLayers,
    barrow: createBarrowLayers,
    modern: createModernLayers,
  };
  const build = builders[method];
  if (!build) throw new Error(`Unknown graph method: ${method}`);
  build(graph);
}

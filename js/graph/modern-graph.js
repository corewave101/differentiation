/** Modern calculus: draw the tangent supplied by the derivative. */
export function createModernLayers(graph) {
  const { colors } = graph;

  graph.lineThroughSlope(() => graph.model.tangentSlope, {
    strokeColor: colors.tangent,
    strokeWidth: 2.8,
    visible: () => graph.atStep(1) && graph.state.revealed && graph.model.valid,
  });

  graph.create('point', [
    () => graph.example.point.x,
    () => graph.example.point.y,
  ], {
    name: 'P',
    size: 4,
    strokeColor: '#fff',
    strokeWidth: 2,
    fillColor: colors.tangent,
    label: { offset: [10, 13], fontSize: 12, color: colors.tangent },
    visible: () => graph.atStep(1) && graph.model.valid,
  });
}

/** A nonzero displacement defines the secant; the limit tangent has its own state. */
export function createFermatLayers(graph) {
  const { colors } = graph;
  const near = graph.draggablePoint('near', { visible: () => graph.hasNearPoint() });
  const corner = graph.point(() => ({
    x: graph.model.nearPoint?.x ?? graph.example.point.x,
    y: graph.example.point.y,
  }), { visible: false });
  const triangleVisible = () => graph.atStep(1) && graph.hasNearPoint();
  graph.create('segment', [graph.fixedPoint, corner], {
    strokeColor: colors.construction, strokeWidth: 1.4, dash: 2, visible: triangleVisible,
  });
  graph.create('segment', [corner, near], {
    strokeColor: colors.construction, strokeWidth: 1.4, dash: 2, visible: triangleVisible,
  });
  graph.create('line', [graph.fixedPoint, near], {
    strokeColor: colors.secant, strokeWidth: 2, visible: triangleVisible,
  });
  graph.lineThroughSlope(() => graph.model.tangentSlope, { visible: () => graph.showTangent() });
}

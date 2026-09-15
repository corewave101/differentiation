/** Differential triangle on the selected curve, with the linear approximation. */
export function createBarrowLayers(graph) {
  const { colors } = graph;
  const near = graph.draggablePoint('near', { name: 'N', visible: () => graph.hasNearPoint() });
  const corner = graph.point(() => ({
    x: graph.model.nearPoint?.x ?? graph.example.point.x,
    y: graph.example.point.y,
  }), { name: 'R', size: 2, fillColor: colors.construction,
    label: { offset: [9, -13], fontSize: 11, color: colors.text },
    visible: () => graph.atStep(1) && graph.hasNearPoint() && Math.abs(graph.model.dx) >= 0.12,
  });
  const triangleVisible = () => graph.atStep(1) && graph.hasNearPoint();
  graph.create('polygon', [graph.fixedPoint, corner, near], {
    fillColor: colors.secant, fillOpacity: 0.07, withLines: true,
    vertices: { visible: false },
    borders: { strokeColor: colors.construction, strokeWidth: 1.4, dash: 2, highlight: false },
    visible: triangleVisible,
  });
  graph.create('line', [graph.fixedPoint, near], {
    strokeColor: colors.secant, strokeWidth: 1.8, visible: triangleVisible,
  });
  graph.lineThroughSlope(() => graph.model.tangentSlope, {
    strokeWidth: 2.2, dash: 2,
    visible: () => graph.atStep(2) && graph.state.showApprox && !graph.showTangent(),
  });
  const approximate = graph.point(() => ({
    x: graph.example.point.x + (graph.model.dx || 0),
    y: graph.example.point.y + graph.model.tangentSlope * (graph.model.dx || 0),
  }), { name: '', size: 2.8, fillColor: colors.tangent,
    visible: () => graph.atStep(2) && graph.state.showApprox && graph.hasNearPoint(),
  });
  graph.create('segment', [near, approximate], {
    strokeColor: colors.tangent, strokeWidth: 2.4,
    visible: () => graph.atStep(2) && graph.state.showApprox && graph.hasNearPoint(),
  });
  graph.lineThroughSlope(() => graph.model.tangentSlope, { visible: () => graph.showTangent() });
}

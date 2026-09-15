/** Descartes: circles, repeated intersections, normal and perpendicular tangent. */
export function createDescartesLayers(graph) {
  const { colors } = graph;
  const hasCircle = () => graph.model.valid && Boolean(graph.model.center);
  const center = graph.draggablePoint('center', { visible: hasCircle,
    label: { offset: [9, -16], fontSize: 12, color: colors.secant } });
  graph.create('circle', [center, graph.fixedPoint], {
    strokeColor: colors.secant, strokeWidth: 1.8, fillColor: colors.secant,
    fillOpacity: 0.025, visible: hasCircle,
  });
  graph.polyline(() => graph.traceX.map((x, i) => ({ x, y: graph.traceY[i] })), {
    strokeColor: colors.secant, strokeWidth: 5, strokeOpacity: 0.22,
    visible: () => graph.state.showTrace && graph.atStep(1),
  });
  graph.point(() => graph.model.secondaryPoint, {
    name: 'S', size: 3.4, fillColor: colors.secant,
    label: { offset: [11, 12], fontSize: 12, color: colors.secant },
    visible: () => graph.atStep(1) && hasCircle() && Boolean(graph.model.secondaryPoint) && !graph.model.contact,
  });
  graph.create('segment', [center, graph.fixedPoint], {
    strokeColor: colors.construction, strokeWidth: 1.6, dash: 2,
    visible: () => hasCircle() && graph.atStep(2) && graph.state.showRadius,
  });
  graph.create('line', [center, graph.fixedPoint], {
    strokeColor: colors.construction, strokeWidth: 1.3, dash: 2, strokeOpacity: 0.6,
    visible: () => hasCircle() && graph.atStep(2) && graph.state.showRadius,
  });
  graph.lineThroughSlope(() => graph.model.tangentSlope, { visible: () => graph.showTangent() });
  graph.polyline(() => {
    const p = graph.example.point;
    const q = graph.model.center;
    if (!q) return [];
    const normalLength = Math.hypot(q.x - p.x, q.y - p.y);
    const tangentLength = Math.hypot(1, graph.model.tangentSlope);
    if (!normalLength || !Number.isFinite(tangentLength)) return [];
    const size = 13 / graph.board.unitX;
    const ux = (q.x - p.x) / normalLength * size;
    const uy = (q.y - p.y) / normalLength * size;
    const vx = size / tangentLength;
    const vy = graph.model.tangentSlope * size / tangentLength;
    return [{ x: p.x + ux, y: p.y + uy }, { x: p.x + ux + vx, y: p.y + uy + vy },
      { x: p.x + vx, y: p.y + vy }];
  }, { strokeColor: colors.tangent, strokeWidth: 1.3,
    visible: () => graph.showTangent() && graph.state.showRadius });
}

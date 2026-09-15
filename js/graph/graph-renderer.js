import { EXAMPLES, getControlConfig } from '../config.js';
import { createMethodLayers } from './comparison-graph.js';

const JXG = globalThis.JXG;

export const GRAPH_COLORS = Object.freeze({
  curve: '#416fbc', tangent: '#d1743d', secant: '#44866c',
  construction: '#8a929a', grid: '#edf0f2', text: '#65707b',
});

const isPoint = (point) => point && Number.isFinite(point.x) && Number.isFinite(point.y);

/** Owns one main board. Method changes replace its layers, preserving the view. */
export class GraphRenderer {
  constructor(containerId, { exampleId = 'descartes', method = 'descartes', onValue, boundingBox } = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) throw new Error(`Graph container not found: ${containerId}`);
    this.exampleId = exampleId;
    this.example = EXAMPLES[exampleId];
    if (!this.example) throw new Error(`Unknown graph example: ${exampleId}`);
    this.method = method;
    this.onValue = onValue;
    this.colors = GRAPH_COLORS;
    this.defaultBoundingBox = [...(boundingBox || this.example.bounds)];
    this.equalUnits = exampleId === 'descartes' || exampleId === 'comparison';
    this.elements = [];
    this.cleanups = [];
    this.model = { valid: false, point: this.example.point };
    this.state = { step: 0, revealed: false, showRadius: true, showTrace: false, showApprox: false };
    this.syncing = false;
    this.disposed = false;
    this.traceX = [];
    this.traceY = [];

    this.board = JXG.JSXGraph.initBoard(containerId, {
      renderer: 'svg', boundingbox: this.defaultBoundingBox, keepaspectratio: this.equalUnits,
      axis: true, grid: false, showCopyright: false, showNavigation: false,
      showInfobox: false, resize: { enabled: false },
      pan: { enabled: true, needShift: false },
      zoom: { enabled: true, wheel: false, pinch: true, needShift: false },
      keyboard: { enabled: true, dx: 12, dy: 12, panShift: true },
      defaultAxes: {
        x: { strokeColor: '#cbd1d7', strokeWidth: 1, highlight: false,
          ticks: { strokeColor: '#dce1e5', minorTicks: 0, majorHeight: 5,
            label: { fontSize: 10, color: GRAPH_COLORS.text, offset: [-3, -13] } } },
        y: { strokeColor: '#cbd1d7', strokeWidth: 1, highlight: false,
          ticks: { strokeColor: '#dce1e5', minorTicks: 0, majorHeight: 5,
            label: { fontSize: 10, color: GRAPH_COLORS.text, offset: [-10, -3] } } },
      },
    });
    this.board.create('grid', [], {
      majorStep: 'auto', minorElements: 0,
      major: { face: 'line', strokeColor: GRAPH_COLORS.grid, strokeWidth: 1, strokeOpacity: 1 },
      strokeColor: GRAPH_COLORS.grid, strokeWidth: 1, highlight: false,
    });
    this.curve = this.board.create('functiongraph', [
      (x) => this.example.fn(x),
    ], { strokeColor: GRAPH_COLORS.curve, strokeWidth: 2.6, highlight: false, fixed: true });
    const { x, y } = this.example.point;
    this.fixedPoint = this.board.create('point', [x, y], {
      name: `P (${x}, ${y})`, fixed: true, size: 3.6, strokeWidth: 2,
      strokeColor: '#ffffff', fillColor: GRAPH_COLORS.curve, highlight: false,
      label: { offset: [-62, 20], fontSize: 12, color: GRAPH_COLORS.curve },
      showInfobox: false,
    });
    this.createInset();
    this.rebuildLayers();
    this.observeSize();
  }

  create(type, parents, attributes = {}) {
    const element = this.board.create(type, parents, {
      highlight: false, fixed: true, showInfobox: false, ...attributes,
    });
    this.elements.push(element);
    return element;
  }

  point(getPoint, attributes = {}) {
    return this.create('point', [
      () => (isPoint(getPoint()) ? getPoint().x : this.example.point.x),
      () => (isPoint(getPoint()) ? getPoint().y : this.example.point.y),
    ], { name: '', size: 3, strokeWidth: 2, strokeColor: '#fff',
      fillColor: this.colors.secant, ...attributes });
  }

  polyline(getPoints, attributes = {}) {
    const element = this.create('curve', [[], []], attributes);
    element.updateDataArray = function () {
      const points = getPoints().filter(isPoint);
      this.dataX = points.map((point) => point.x);
      this.dataY = points.map((point) => point.y);
    };
    return element;
  }

  lineThroughSlope(slope, attributes = {}) {
    const second = this.point(() => ({
      x: this.example.point.x + 1,
      y: this.example.point.y + (Number.isFinite(slope()) ? slope() : 0),
    }), { visible: false });
    return this.create('line', [this.fixedPoint, second], {
      strokeColor: this.colors.tangent, strokeWidth: 2.6, ...attributes,
    });
  }

  /** A glider stays on its axis/curve; the callback updates the shared app state. */
  draggablePoint(kind, attributes = {}) {
    const control = getControlConfig(this.exampleId, this.method);
    const value = control.initial;
    let guide = this.curve;
    let x = this.example.point.x + value;
    let y = this.example.fn(x);
    if (kind === 'center') {
      const origin = this.point(() => ({ x: 0, y: 0 }), { visible: false });
      const unit = this.point(() => ({ x: 1, y: 0 }), { visible: false });
      guide = this.create('line', [origin, unit], { visible: false });
      x = value;
      y = 0;
    }
    const point = this.create('glider', [x, y, guide], {
      name: kind === 'center' ? 'Q' : "P′", fixed: false, size: 4.4,
      strokeColor: '#fff', strokeWidth: 2, fillColor: this.colors.secant,
      highlight: true, highlightFillColor: this.colors.secant,
      highlightStrokeColor: '#ddebe5', highlightStrokeWidth: 6,
      label: { offset: [12, 13], fontSize: 12, color: this.colors.secant },
      ...attributes,
    });
    const drag = () => {
      if (this.syncing || this.disposed) return;
      const current = getControlConfig(this.exampleId, this.method);
      const [min, max] = this.state.valueRange || [current.min, current.max];
      const raw = kind === 'center' ? point.X() : point.X() - this.example.point.x;
      const clamped = Math.max(min, Math.min(max, raw));
      const rounded = Number((Math.round(clamped / current.step) * current.step).toFixed(8));
      const next = Math.max(min, Math.min(max, rounded));
      const nextX = kind === 'center' ? next : this.example.point.x + next;
      this.position(point, { x: nextX, y: kind === 'center' ? 0 : this.example.fn(nextX) });
      this.onValue?.(next);
    };
    point.on('drag', drag);
    this.cleanups.push(() => point.off('drag', drag));
    this.handle = point;
    this.handleKind = kind;
    return point;
  }

  position(element, point) {
    if (!element || !isPoint(point)) return;
    this.syncing = true;
    element.setPosition(JXG.COORDS_BY_USER, [point.x, point.y]);
    this.syncing = false;
  }

  atStep(step) { return Number(this.state.step || 0) >= step; }
  hasNearPoint() { return Boolean(this.model.valid && isPoint(this.model.nearPoint) && Math.abs(this.model.dx) > 1e-12); }
  showTangent() {
    return this.atStep(3) && this.state.revealed && Number.isFinite(this.model.tangentSlope)
      && (this.method !== 'descartes' || this.model.contact);
  }

  rebuildLayers() {
    this.board.suspendUpdate();
    this.cleanups.splice(0).forEach((cleanup) => cleanup());
    for (const element of this.elements.reverse()) {
      if (this.board.objects[element.id]) this.board.removeObject(element);
    }
    this.elements = [];
    this.handle = null;
    this.traceX.length = 0;
    this.traceY.length = 0;
    createMethodLayers(this, this.method);
    this.board.unsuspendUpdate();
  }

  setMethod(method) {
    if (method === this.method || this.disposed) return;
    const bounds = this.getBoundingBox();
    this.method = method;
    this.rebuildLayers();
    this.board.setBoundingBox(bounds, this.equalUnits);
    this.updateInset();
  }

  update(model, state = {}) {
    if (this.disposed) return;
    this.model = model || { valid: false, point: this.example.point };
    this.state = { ...this.state, ...state };
    if (state.method && state.method !== this.method) this.setMethod(state.method);
    if (this.handle) {
      const coordinate = this.handleKind === 'center' ? this.model.center : this.model.nearPoint;
      this.position(this.handle, coordinate);
    }
    if (this.method === 'descartes' && this.state.showTrace && isPoint(this.model.secondaryPoint)) {
      const point = this.model.secondaryPoint;
      const n = this.traceX.length;
      if (!n || Math.abs(point.x - this.traceX[n - 1]) > 1e-7) {
        this.traceX.push(point.x);
        this.traceY.push(point.y);
        if (this.traceX.length > 240) { this.traceX.shift(); this.traceY.shift(); }
      }
    } else if (!this.state.showTrace) {
      this.traceX.length = 0;
      this.traceY.length = 0;
    }
    this.board.update();
    this.updateInset();
  }

  getBoundingBox() { return this.board ? [...this.board.getBoundingBox()] : [...this.defaultBoundingBox]; }

  resetView() {
    if (!this.disposed) this.board.setBoundingBox([...this.defaultBoundingBox], this.equalUnits);
  }

  zoom(factor) {
    if (this.disposed || !Number.isFinite(factor) || factor <= 0) return;
    const [left, top, right, bottom] = this.getBoundingBox();
    const centerX = (left + right) / 2;
    const centerY = (top + bottom) / 2;
    const halfWidth = (right - left) / (2 * factor);
    const halfHeight = (top - bottom) / (2 * factor);
    this.board.setBoundingBox([centerX - halfWidth, centerY + halfHeight,
      centerX + halfWidth, centerY - halfHeight], this.equalUnits);
  }

  observeSize() {
    const resize = () => {
      if (this.disposed) return;
      const width = this.container.clientWidth;
      const height = this.container.clientHeight;
      if (width < 20 || height < 20) return;
      if (Math.abs(width - this.board.canvasWidth) < 1 && Math.abs(height - this.board.canvasHeight) < 1) return;
      const bounds = this.getBoundingBox();
      this.board.resizeContainer(width, height, true, false);
      this.board.setBoundingBox(bounds, this.equalUnits);
    };
    this.resizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(this.resizeFrame);
      this.resizeFrame = requestAnimationFrame(resize);
    });
    this.resizeObserver.observe(this.container);
  }

  createInset() {
    this.inset = document.createElement('div');
    this.inset.className = 'graph-inset';
    this.inset.setAttribute('aria-label', '고정점 P를 원점으로 옮겨 확대한 미분삼각형');
    this.inset.style.cssText = 'position:absolute;right:16px;bottom:18px;width:190px;padding:12px;background:rgba(255,255,255,.96);border:1px solid #e5e9ec;border-radius:12px;box-shadow:0 5px 20px #33445508;z-index:6;pointer-events:none;';
    this.inset.innerHTML = '<div style="font-size:10px;font-weight:600;color:#65707b;margin-bottom:6px">미분삼각형 확대 · P 기준</div><svg viewBox="0 0 166 122" width="100%" height="122" aria-hidden="true"></svg><div class="graph-inset-caption" style="font-size:10px;color:#81908a;margin-top:4px"></div>';
    this.inset.hidden = true;
    this.container.append(this.inset);
  }

  updateInset() {
    const visible = this.method === 'barrow' && this.atStep(1) && this.hasNearPoint()
      && Math.abs(this.model.dx) <= 0.25;
    this.inset.hidden = !visible;
    if (!visible) return;
    const dx = this.model.dx;
    const dy = this.model.dy;
    const approx = this.model.tangentSlope * dx;
    const ys = this.state.showApprox ? [0, dy, approx] : [0, dy];
    const minX = Math.min(0, dx), maxX = Math.max(0, dx);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const scale = Math.min(106 / Math.max(maxX - minX, 1e-12), 82 / Math.max(maxY - minY, 1e-12));
    const x = (value) => 83 + (value - (minX + maxX) / 2) * scale;
    const y = (value) => 59 - (value - (minY + maxY) / 2) * scale;
    const xy = (a, b) => `${x(a).toFixed(2)},${y(b).toFixed(2)}`;
    const px = x(0), py = y(0), nx = x(dx), ny = y(dy);
    const color = this.colors;
    this.inset.querySelector('svg').innerHTML = `
      <line x1="12" y1="${py}" x2="154" y2="${py}" stroke="#e2e7ea" />
      <line x1="${px}" y1="9" x2="${px}" y2="112" stroke="#e2e7ea" />
      <polygon points="${xy(0, 0)} ${xy(dx, 0)} ${xy(dx, dy)}" fill="#44866c12" stroke="${color.construction}" stroke-width="1.2" stroke-dasharray="3 3" />
      <line x1="${px}" y1="${py}" x2="${nx}" y2="${ny}" stroke="${color.secant}" stroke-width="2" />
      ${this.state.showApprox ? `<line x1="${px}" y1="${py}" x2="${nx}" y2="${y(approx)}" stroke="${color.tangent}" stroke-width="2" stroke-dasharray="4 3" />` : ''}
      <circle cx="${px}" cy="${py}" r="3" fill="${color.curve}" />
      <circle cx="${nx}" cy="${ny}" r="3" fill="${color.secant}" />
      <text x="${px - 13}" y="${py + 14}" font-size="10" fill="${color.text}">P</text>
      <text x="${nx + 8}" y="${ny - 4}" font-size="10" fill="${color.text}">N</text>
      <text x="${(px + nx) / 2 + 9}" y="${py + (dy >= 0 ? 15 : -8)}" font-size="10" fill="${color.text}">e</text>
      <text x="${nx + 9}" y="${(py + ny) / 2}" font-size="10" fill="${color.text}">a</text>`;
    this.inset.querySelector('.graph-inset-caption').textContent = '가로·세로 같은 배율 · Δx, Δy';
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.resizeFrame);
    this.resizeObserver?.disconnect();
    this.cleanups.splice(0).forEach((cleanup) => cleanup());
    this.inset?.remove();
    if (this.board) JXG.JSXGraph.freeBoard(this.board);
    this.board = null;
    this.elements = [];
  }
}

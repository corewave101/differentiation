import { EXAMPLES, getControlConfig } from '../config.js';

const CLASSIC_METHODS = ['descartes', 'fermat', 'barrow'];
const ALL_METHODS = [...CLASSIC_METHODS, 'modern'];

export function validateParameter(exampleId, method, value) {
  const isComparisonMethod = exampleId === 'comparison' && ALL_METHODS.includes(method);
  const isDirectMethod = exampleId !== 'comparison' && exampleId === method;

  if (!EXAMPLES[exampleId] || (!isComparisonMethod && !isDirectMethod)) {
    return { valid: false, message: '예제와 작도법을 다시 선택해 주세요.' };
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { valid: false, message: '유한한 숫자를 입력해 주세요.' };
  }

  const { min, max } = getControlConfig(exampleId, method);
  if (value < min || value > max) {
    return { valid: false, message: `${min} 이상 ${max} 이하로 입력해 주세요.` };
  }

  return { valid: true, message: '' };
}

function makeBaseResult(example, validation, value) {
  const point = example ? { ...example.point } : null;
  const tangentSlope = example?.derivative?.(example.point.x);

  return {
    ...validation,
    point,
    nearPoint: null,
    center: null,
    radius: null,
    dx: null,
    dy: null,
    slope: null,
    tangentSlope,
    tangentIntercept: point ? point.y - tangentSlope * point.x : null,
    secondaryPoint: null,
    normalSlope: null,
    remainder: null,
    contact: false,
    value,
    formula: example?.formula || '',
  };
}

/**
 * Calculate one method without relying on hard-coded slope coefficients.
 * The finite-difference slope is always evaluated from the selected curve.
 */
export function calculate(exampleId, method, value) {
  const validation = validateParameter(exampleId, method, value);
  const example = EXAMPLES[exampleId];
  const result = makeBaseResult(example, validation, value);

  if (!validation.valid || !example) return result;

  if (method === 'descartes') {
    const centerX = value;
    const secondaryX = example.descartes.secondaryX(centerX);
    const secondaryPoint = {
      x: secondaryX,
      y: example.fn(secondaryX),
    };
    const contact = Math.abs(secondaryX - example.point.x) < 1e-8;

    return {
      ...result,
      nearPoint: secondaryPoint,
      secondaryPoint,
      center: { x: centerX, y: 0 },
      radius: Math.hypot(example.point.x - centerX, example.point.y),
      dx: secondaryX - example.point.x,
      dy: secondaryPoint.y - example.point.y,
      normalSlope: (example.point.y - 0) / (example.point.x - centerX),
      slope: contact ? result.tangentSlope : null,
      contact,
    };
  }

  if (method === 'modern') {
    return {
      ...result,
      contact: true,
      slope: result.tangentSlope,
    };
  }

  const nearX = example.point.x + value;
  const nearY = example.fn(nearX);
  const dy = nearY - example.point.y;
  const slope = value === 0 ? null : dy / value;
  const remainder = slope === null ? 0 : slope - result.tangentSlope;

  return {
    ...result,
    nearPoint: { x: nearX, y: nearY },
    dx: value,
    dy,
    slope,
    remainder,
    contact: value === 0,
  };
}

/** Keep tiny nonzero quantities visible, and never round a near-integer to it. */
export function formatNumber(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  if (value === 0) return '0';
  if (Math.abs(value) < 0.0001 || Math.abs(value) >= 1e9) return String(value);

  const rounded = Number(value.toPrecision(10));
  if (Number.isInteger(rounded) && rounded !== value) return String(value);
  return String(rounded);
}

const fermatFunction = (x) => (x * x) + (2 * x) + 1;
const descartesFunction = (x) => (x >= -3 ? Math.sqrt(x + 3) : NaN);
const barrowFunction = (x) => (x * x * x) - (2 * x) + 4;

/**
 * The examples deliberately use different curve shapes:
 * - Fermat: a translated parabola
 * - Descartes: a square-root branch that can be intersected by a circle
 * - Barrow: a cubic with a visible higher-order correction
 * - Comparison: one shared square-root curve for all four approaches
 */
export const EXAMPLES = {
  fermat: {
    id: 'fermat',
    title: '페르마 실험실',
    subtitle: '두 점 사이의 간격을 줄이며 할선의 기울기를 관찰하세요.',
    formula: 'y=x^2+2x+1',
    fn: fermatFunction,
    derivative: (x) => (2 * x) + 2,
    point: { x: 2, y: 9 },
    bounds: [-1, 28, 5, -4],
    control: {
      label: '가로 변화량 E',
      symbol: 'E',
      min: -1,
      max: 1,
      step: 0.001,
      initial: 0.1,
      presets: [1, 0.5, 0.1, 0.01, -0.01, 0],
    },
  },
  descartes: {
    id: 'descartes',
    title: '데카르트 실험실',
    subtitle: '원의 중심을 옮겨 두 교점이 합쳐지는 순간을 찾아보세요.',
    formula: 'y=\\sqrt{x+3}',
    fn: descartesFunction,
    derivative: (x) => 1 / (2 * Math.sqrt(x + 3)),
    point: { x: 1, y: 2 },
    bounds: [-2, 4, 4, -1],
    descartes: {
      contactCenter: 1.5,
      secondaryX: (centerX) => (2 * centerX) - 2,
    },
    control: {
      label: '원의 중심 a',
      symbol: 'a',
      min: 0.75,
      max: 2.25,
      step: 0.01,
      initial: 0.75,
      presets: [0.75, 1.25, 1.49, 1.5, 1.51, 2.25],
    },
  },
  barrow: {
    id: 'barrow',
    title: '배로 실험실',
    subtitle: '작은 삼각형의 변화량과 전개식의 일차항을 연결하세요.',
    formula: 'y=x^3-2x+4',
    fn: barrowFunction,
    derivative: (x) => (3 * x * x) - 2,
    point: { x: 1, y: 3 },
    bounds: [-1, 30, 3, -4],
    control: {
      label: '가로 변화량 e',
      symbol: 'e',
      min: -1,
      max: 1,
      step: 0.001,
      initial: 0.1,
      presets: [1, 0.5, 0.1, 0.01, -0.01, 0],
    },
  },
  comparison: {
    id: 'comparison',
    title: '네 가지 미분 방법 비교',
    subtitle: '하나의 함수에서 세 고전적 작도법과 현대의 도함수를 동시에 비교하세요.',
    formula: 'y=\\sqrt{x+3}',
    fn: descartesFunction,
    derivative: (x) => 1 / (2 * Math.sqrt(x + 3)),
    point: { x: 1, y: 2 },
    bounds: [-2, 4, 4, -1],
    descartes: {
      contactCenter: 1.5,
      secondaryX: (centerX) => (2 * centerX) - 2,
    },
    control: {
      min: 0,
      max: 1,
      step: 0.01,
      initial: 0.5,
      presets: [0, 0.25, 0.5, 0.75, 0.9, 1],
    },
    methodControls: {
      fermat: {
        label: '페르마 변화량 h',
        symbol: 'h',
        min: 0,
        max: 0.8,
        step: 0.001,
        initial: 0.4,
        presets: [0.8, 0.4, 0.1, 0.01, 0],
      },
      barrow: {
        label: '배로 변화량 e',
        symbol: 'e',
        min: 0,
        max: 0.8,
        step: 0.001,
        initial: 0.4,
        presets: [0.8, 0.4, 0.1, 0.01, 0],
      },
      descartes: {
        label: '원의 중심 a',
        symbol: 'a',
        min: 0.75,
        max: 2.25,
        step: 0.01,
        initial: 1.875,
        presets: [0.75, 1.25, 1.49, 1.5, 1.51, 2.25],
      },
      modern: {
        label: '공통 진행도',
        symbol: 'p',
        min: 0,
        max: 1,
        step: 0.01,
        initial: 0.5,
        presets: [0, 0.25, 0.5, 0.75, 0.9, 1],
      },
    },
  },
};

export function getControlConfig(exampleId, method = exampleId) {
  const example = EXAMPLES[exampleId];
  if (!example) throw new RangeError('알 수 없는 예제입니다.');

  if (exampleId === 'comparison') {
    return example.methodControls?.[method] || example.control;
  }

  if (method !== exampleId) {
    throw new RangeError('알 수 없는 작도법입니다.');
  }

  return example.control;
}

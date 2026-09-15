import { EXAMPLES, getControlConfig } from './js/config.js';
import { calculate, formatNumber, validateParameter } from './js/utils/math-utils.js';
import { GraphRenderer } from './js/graph/graph-renderer.js';
import { mountApplications } from './applications.js';

const modal = document.getElementById('simulation-modal');
const body = document.getElementById('modal-body');
const title = document.getElementById('modal-title');
const kicker = document.getElementById('modal-kicker');

const COMPARISON_METHODS = ['fermat', 'descartes', 'barrow', 'modern'];
const METHOD_LABELS = {
  fermat: '페르마',
  descartes: '데카르트',
  barrow: '배로',
  modern: '현대의 미분',
};

const METHOD_STRENGTHS = {
  fermat: {
    title: '평균변화율에서 순간변화율로',
    description: '두 점 사이의 간격을 줄이며 할선이 접선에 가까워지는 과정을 볼 수 있습니다. 평균변화율이 순간변화율로 이어지는 이유를 직관적으로 이해하기 좋습니다.',
  },
  descartes: {
    title: '접하는 조건을 방정식으로',
    description: '원과 곡선의 두 교점이 겹치는 조건을 중근으로 표현합니다. 접선 문제를 방정식의 근 문제로 바꾸어, 도형과 대수의 연결을 보여 줍니다.',
  },
  barrow: {
    title: '기울기를 작은 삼각형으로',
    description: '작은 삼각형의 세로 변화량과 가로 변화량의 비로 접선의 기울기를 파악합니다. 변화량의 비가 기울기가 되는 이유를 도형으로 이해하기 좋습니다.',
  },
  modern: {
    title: '도함수 하나로 여러 지점을 계산',
    description: '순간변화율을 도함수로 나타내면 원하는 지점의 기울기를 구할 때마다 같은 과정을 반복할 필요가 없습니다. 도함수의 부호와 값을 이용해 함수의 증가·감소와 극값도 분석할 수 있습니다.',
  },
};

const SIM_META = {
  application: {
    title: '미분의 실생활 활용',
    kicker: 'BOX · BAT · TOUCH',
  },
  fermat: {
    title: '페르마의 방법',
    kicker: 'SECANT → TANGENT',
    description: '번역된 포물선에서 두 점 사이의 가로 변화량 E를 줄여 보세요. 유한한 E에서는 할선이지만, E가 0으로 가까워질 때 접선의 기울기로 향합니다.',
  },
  descartes: {
    title: '데카르트의 방법',
    kicker: 'DOUBLE ROOT CONDITION',
    description: '제곱근 곡선을 지나는 원의 중심 Q를 옮깁니다. 두 교점의 x좌표가 중근을 이루는 순간, 반지름에 수직인 선이 접선이 됩니다.',
  },
  barrow: {
    title: '배로의 방법',
    kicker: 'DIFFERENTIAL TRIANGLE',
    description: '삼차함수의 작은 변화량을 세로 변화량으로 나누어 전개합니다. 일차항은 남고 고차항은 작아지면서 접선의 기울기를 결정합니다.',
  },
  comparison: {
    title: '현대의 미분',
    kicker: 'ONE FUNCTION · FOUR ROUTES',
    description: '하나의 공통 함수에서 페르마, 데카르트, 배로, 현대의 도함수를 같은 진행도에 맞춰 동시에 비교합니다.',
  },
};

let activeType = null;
let activeMethod = null;
let activeValue = 0;
let graph = null;
let comparisonGraphs = [];
let disposeApplications = null;

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[char]));

function renderFormula(element, tex) {
  if (!element) return;
  if (globalThis.katex) {
    globalThis.katex.render(tex, element, {
      displayMode: true,
      throwOnError: false,
      strict: false,
    });
  } else {
    element.textContent = tex;
  }
}

function controlsFor(type, method = type) {
  return getControlConfig(type, method);
}

function disposeGraphs() {
  disposeApplications?.();
  disposeApplications = null;
  graph?.dispose();
  graph = null;
  comparisonGraphs.forEach((item) => item.instance.dispose());
  comparisonGraphs = [];
}

function openModal(type) {
  activeType = type;
  activeMethod = type;
  activeValue = type === 'application' ? 0 : type === 'comparison'
    ? EXAMPLES.comparison.control.initial
    : controlsFor(type).initial;

  title.textContent = SIM_META[type].title;
  kicker.textContent = SIM_META[type].kicker;
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');

  if (type === 'application') disposeApplications = mountApplications(body);
  else if (type === 'comparison') renderComparisonSimulation();
  else renderMathSimulation();

  modal.querySelector('.close-button').focus();
}

function closeModal() {
  disposeGraphs();
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}

function renderMathSimulation() {
  const example = EXAMPLES[activeType];
  const config = controlsFor(activeType, activeMethod);

  body.innerHTML = `
    <div class="simulation-layout">
      <div class="simulation-graph" id="modal-graph" role="img" aria-label="${esc(SIM_META[activeType].title)} 그래프"></div>
      <div class="simulation-panel">
        <p>${SIM_META[activeType].description}</p>
        <div class="simulation-function">
          <span>이번 예제 함수</span>
          <div id="simulation-function-formula"></div>
          <small>P = (${formatNumber(example.point.x)}, ${formatNumber(example.point.y)})</small>
        </div>
        <div class="equation" id="simulation-equation"></div>
        <div class="simulation-control">
          <label for="sim-range">
            <span>${esc(config.label || '변화량')}</span>
            <output id="sim-output">${formatNumber(activeValue)}</output>
          </label>
          <input id="sim-range" type="range" min="${config.min}" max="${config.max}" step="${config.step}" value="${activeValue}" />
        </div>
        <div class="simulation-control">
          <label for="sim-number"><span>숫자로 직접 입력</span></label>
          <input id="sim-number" type="number" min="${config.min}" max="${config.max}" step="${config.step}" value="${activeValue}" />
        </div>
        <div class="preset-row" id="sim-presets"></div>
        <div class="simulation-metrics" id="sim-metrics"></div>
        <p class="insight" id="sim-insight"></p>
      </div>
    </div>`;

  renderFormula(document.getElementById('simulation-function-formula'), example.formula);

  config.presets.forEach((value) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = formatNumber(value);
    button.addEventListener('click', () => updateValue(value));
    document.getElementById('sim-presets').append(button);
  });

  document.getElementById('sim-range').addEventListener('input', (event) => {
    updateValue(Number(event.target.value));
  });
  document.getElementById('sim-number').addEventListener('input', (event) => {
    updateValue(Number(event.target.value));
  });

  graph = new GraphRenderer('modal-graph', {
    exampleId: activeType,
    method: activeMethod,
    onValue: (value) => updateValue(value),
  });
  updateValue(activeValue);
}

function renderComparisonSimulation() {
  body.innerHTML = `
    <div class="comparison-body comparison-simulation">
      <p class="comparison-intro">
        하나의 함수 <b>y=√(x+3)</b>와 기준점 P=(1,2)를 고정합니다.
        아래의 진행도를 움직이면 네 방법의 계산과 그래프가 함께 갱신됩니다.
      </p>
      <div class="comparison-equation" id="comparison-equation"></div>
      <div class="comparison-shared-control">
        <label for="comparison-range">
          <span>공통 진행도 · 할선은 h→0, 원은 중근으로</span>
          <output id="comparison-output">${formatNumber(activeValue)}</output>
        </label>
        <input id="comparison-range" type="range" min="0" max="1" step="0.01" value="${activeValue}" />
        <div class="preset-row" id="comparison-presets"></div>
      </div>
      <div class="comparison-live-grid">
        ${COMPARISON_METHODS.map((method, index) => `
          <article class="comparison-live-card" data-method="${method}">
            <div class="comparison-column-head">
              <span>0${index + 1}</span>
              <h3>${METHOD_LABELS[method]}</h3>
            </div>
            <div class="comparison-live-graph" id="comparison-graph-${method}" role="img" aria-label="${METHOD_LABELS[method]} 공통 함수 그래프"></div>
            <p class="comparison-live-parameter" id="comparison-parameter-${method}"></p>
            <div class="comparison-live-formula" id="comparison-formula-${method}"></div>
            <div class="comparison-live-metrics" id="comparison-metrics-${method}"></div>
            <section class="comparison-strength" aria-label="${METHOD_LABELS[method]} 방법의 장점">
              <h4>장점 · ${METHOD_STRENGTHS[method].title}</h4>
              <p>${METHOD_STRENGTHS[method].description}</p>
            </section>
          </article>`).join('')}
      </div>
      <div class="comparison-conclusion">
        <span class="conclusion-mark">◎</span>
        <p><strong>같은 함수, 네 가지 언어.</strong> 세 고전적 방법은 가까워지는 할선·중근·미분삼각형으로 접근하고, 현대의 미분은 그 순간변화율을 도함수로 바로 계산합니다.</p>
      </div>
    </div>`;

  renderFormula(
    document.getElementById('comparison-equation'),
    'f(x)=\\sqrt{x+3},\\quad P=(1,2),\\quad f\'(1)=\\frac14',
  );

  const progressConfig = controlsFor('comparison', 'modern');
  progressConfig.presets.forEach((value) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = formatNumber(value);
    button.addEventListener('click', () => updateComparisonProgress(value));
    document.getElementById('comparison-presets').append(button);
  });
  document.getElementById('comparison-range').addEventListener('input', (event) => {
    updateComparisonProgress(Number(event.target.value));
  });

  comparisonGraphs = COMPARISON_METHODS.map((method) => ({
    method,
    instance: new GraphRenderer(`comparison-graph-${method}`, {
      exampleId: 'comparison',
      method,
      onValue: (value) => onComparisonGraphValue(method, value),
    }),
  }));

  updateComparisonProgress(activeValue);
}

function comparisonParameters(progress) {
  const remaining = 1 - progress;
  return {
    fermat: 0.8 * remaining,
    barrow: 0.8 * remaining,
    descartes: 1.5 + (0.75 * remaining),
    modern: progress,
  };
}

function progressFromGraphValue(method, value) {
  if (method === 'descartes') return 1 - ((value - 1.5) / 0.75);
  if (method === 'modern') return value;
  return 1 - (value / 0.8);
}

function onComparisonGraphValue(method, value) {
  const progress = Math.max(0, Math.min(1, progressFromGraphValue(method, value)));
  updateComparisonProgress(progress);
}

function updateComparisonProgress(progress) {
  const config = controlsFor('comparison', 'modern');
  const bounded = Math.max(config.min, Math.min(config.max, Number(progress)));
  activeValue = Number(bounded.toFixed(2));

  const range = document.getElementById('comparison-range');
  const output = document.getElementById('comparison-output');
  if (range) range.value = activeValue;
  if (output) output.textContent = formatNumber(activeValue);

  const parameters = comparisonParameters(activeValue);
  comparisonGraphs.forEach(({ method, instance }) => {
    const parameter = parameters[method];
    const model = calculate('comparison', method, parameter);
    const methodConfig = controlsFor('comparison', method);
    instance.update(model, {
      step: 3,
      revealed: true,
      showRadius: true,
      showTrace: true,
      showApprox: true,
      valueRange: [methodConfig.min, methodConfig.max],
      method,
    });
    renderComparisonCard(method, parameter, model);
  });
}

function renderComparisonCard(method, parameter, model) {
  const parameterElement = document.getElementById(`comparison-parameter-${method}`);
  const formulaElement = document.getElementById(`comparison-formula-${method}`);
  const metricsElement = document.getElementById(`comparison-metrics-${method}`);
  if (!parameterElement || !formulaElement || !metricsElement) return;

  if (method === 'descartes') {
    parameterElement.textContent = `원의 중심 a = ${formatNumber(parameter)}`;
    renderFormula(formulaElement, '(x-1)(x+2-2a)=0');
    metricsElement.innerHTML = [
      ['두 번째 교점', model.secondaryPoint ? `(${formatNumber(model.secondaryPoint.x)}, ${formatNumber(model.secondaryPoint.y)})` : '—'],
      ['접선 기울기', model.contact ? formatNumber(model.tangentSlope) : '중근을 찾는 중'],
    ].map(metricMarkup).join('');
    return;
  }

  if (method === 'modern') {
    parameterElement.textContent = '도함수는 진행도와 무관하게 순간값을 계산';
    renderFormula(formulaElement, 'f\'(x)=\\frac{1}{2\\sqrt{x+3}},\\quad f\'(1)=\\frac14');
    metricsElement.innerHTML = [
      ['기준점', 'P=(1, 2)'],
      ['도함수 값', formatNumber(model.tangentSlope)],
    ].map(metricMarkup).join('');
    return;
  }

  const symbol = method === 'fermat' ? 'h' : 'e';
  const finiteFormula = `\\frac{\\sqrt{4+${symbol}}-2}{${symbol}}`;
  parameterElement.textContent = `${method === 'fermat' ? '할선' : '미분삼각형'} 변화량 ${symbol} = ${formatNumber(parameter)}`;
  renderFormula(formulaElement, `${finiteFormula}\\quad\\longrightarrow\\quad\\frac14`);
  metricsElement.innerHTML = [
    ['현재 비', model.slope === null ? '극한으로 이동' : formatNumber(model.slope)],
    ['극한값', formatNumber(model.tangentSlope)],
  ].map(metricMarkup).join('');
}

function metricMarkup([label, value]) {
  return `<div class="metric"><small>${esc(label)}</small><strong>${esc(value)}</strong></div>`;
}

function updateValue(value) {
  const config = controlsFor(activeType, activeMethod);
  const check = validateParameter(activeType, activeMethod, value);
  if (!check.valid) return;

  activeValue = value;
  const model = calculate(activeType, activeMethod, value);
  const range = document.getElementById('sim-range');
  const number = document.getElementById('sim-number');
  const output = document.getElementById('sim-output');
  if (range) range.value = value;
  if (number) number.value = value;
  if (output) output.textContent = formatNumber(value);

  graph?.update(model, {
    step: 3,
    revealed: true,
    showRadius: true,
    showTrace: true,
    showApprox: true,
    method: activeMethod,
    valueRange: [config.min, config.max],
  });
  renderSimulationData(model);
}

function renderSimulationData(model) {
  const equation = document.getElementById('simulation-equation');
  const metrics = document.getElementById('sim-metrics');
  const insight = document.getElementById('sim-insight');
  if (!equation || !metrics || !insight) return;

  let formula = '';
  let metricRows = [];
  let message = '';

  if (activeMethod === 'descartes') {
    formula = `a=${formatNumber(model.value)}\\quad\\Longrightarrow\\quad m_{\\mathrm{접선}}=${model.contact ? formatNumber(model.tangentSlope) : '\\text{중근을 찾아보세요}'}`;
    metricRows = [
      ['중심 Q', `(${formatNumber(model.center?.x)}, 0)`],
      ['다른 교점', model.secondaryPoint ? `(${formatNumber(model.secondaryPoint.x)}, ${formatNumber(model.secondaryPoint.y)})` : '—'],
    ];
    message = model.contact
      ? '두 교점이 정확히 합쳐졌습니다. 반지름과 접선이 직각을 이루는 순간입니다.'
      : `a=${formatNumber(EXAMPLES.descartes.descartes.contactCenter)}에서 중근이 됩니다.`;
  }

  if (activeMethod === 'fermat') {
    formula = 'm_E=\\frac{f(2+E)-f(2)}{E}=6+E\\quad(E\\ne0)';
    metricRows = [
      ['할선 기울기', model.slope === null ? '정의되지 않음' : formatNumber(model.slope)],
      ['극한 기울기', formatNumber(model.tangentSlope)],
    ];
    message = model.slope === null
      ? 'E=0에서는 원래 할선의 분수를 계산하지 않고 극한값을 따로 봅니다.'
      : `현재 평균변화율은 ${formatNumber(model.slope)}이고, E→0에서 ${formatNumber(model.tangentSlope)}에 가까워집니다.`;
  }

  if (activeMethod === 'barrow') {
    formula = '\\frac{a}{e}=1+3e+e^2\\quad(e\\ne0)';
    metricRows = [
      ['변화량의 비', model.slope === null ? '정의되지 않음' : formatNumber(model.slope)],
      ['극한 기울기', formatNumber(model.tangentSlope)],
    ];
    message = model.slope === null
      ? 'e=0에서는 삼각형의 비를 계산하지 않고 극한으로 구분합니다.'
      : `고차항이 만드는 보정량은 ${formatNumber(model.remainder)}입니다.`;
  }

  renderFormula(equation, formula);
  metrics.innerHTML = metricRows.map(metricMarkup).join('');
  insight.textContent = message;
}

document.querySelectorAll('[data-sim]').forEach((card) => {
  card.addEventListener('click', () => openModal(card.dataset.sim));
});

document.querySelectorAll('[data-close-modal]').forEach((element) => {
  element.addEventListener('click', closeModal);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !modal.hidden) closeModal();
});

// Simple line drawings: every displayed value comes from the simulation model.
const f = (n) => Number(n.toFixed(2)).toLocaleString('ko-KR');
const text = (x, y, value, cls = '') => `<text x="${x}" y="${y}" text-anchor="middle" class="${cls}">${value}</text>`;
const arrow = (x, y, length) => `<path d="M${x},${y}h${length}" fill="none" stroke="currentColor" stroke-width="2" marker-end="url(#scene-arrow)"/>`;

function rocket(x, y, fuel, exhaust) {
  return `<g transform="translate(${x} ${y})" class="scene-ink">
    ${exhaust > 0 ? `<g class="scene-exhaust" opacity="${0.3 + exhaust * 0.7}"><path d="M-55,-10L${-70-exhaust*35},0L-55,10" fill="#f8c94a"/><path d="M-73,-18h-15m5,18h-25m20,18h-15" stroke="#64748b" stroke-width="1.5"/></g>` : ''}
    <path d="M-48,-20Q-65,-49 -85,-44L-64,-12M-48,20Q-65,49 -85,44L-64,12" fill="white"/>
    <path d="M-65,-20Q-5,-43 43,-22L70,0L43,22Q-5,43 -65,20Z" fill="white"/>
    <rect x="-47" y="-12" width="${Math.max(0,fuel)*68}" height="24" rx="6" fill="#f8c94a" stroke="none"/>
    <path d="M43,-22V22M-67,-5h30v10h-30Z" fill="white"/>
    <circle cx="18" cy="0" r="10" fill="#edf3fb"/>
  </g>`;
}

function battery(x, level) {
  return `<g transform="translate(${x} 116)" class="scene-ink">
    <rect x="-17" y="-9" width="34" height="10" rx="3" fill="white"/>
    <rect x="-48" width="96" height="156" rx="13" fill="white"/>
    <rect x="-39" y="${147 - level * 1.38}" width="78" height="${level * 1.38}" rx="6" stroke="none" fill="${level < 20 ? '#eeac83' : '#d8e9da'}"/>
    <path d="M5,45L-13,78H1L-5,107L16,71H3Z" fill="#29445c" stroke="none"/>
  </g>`;
}

function rocketScene(m, v, progress) {
  const used = v.e * progress;
  const gain = -v.ve * Math.log1p(-used / m.mass);
  const endVelocity = m.y + gain;
  const speedLength = (speed) => speed === 0 ? 0 : 18 + speed / 6500 * 70;
  return `${text(145, 37, '연료 방출 전', 'scene-heading')}${text(445, 37, '연료 방출 후', 'scene-heading')}
    <path d="M300,64V335" stroke="#e3e7ed" stroke-dasharray="4 7"/>
    ${text(145, 82, 'v')}${text(445, 82, 'v + Δv')}
    ${arrow(145, 96, speedLength(m.y))}${arrow(445, 96, speedLength(endVelocity))}
    ${rocket(145, 168, (m.mass-200)/800, 0)}${rocket(445, 168, (m.mass-used-200)/800, used/100)}
    ${text(145, 238, `m = ${f(m.mass)} kg`)}${text(445, 238, `m − E = ${f(m.mass-used)} kg`)}
    ${text(145, 267, `${f(m.y)} m/s`, 'scene-value')}${text(445, 267, `${f(endVelocity)} m/s`, 'scene-value')}
    ${text(445, 301, `← 방출한 추진제 ${f(used)} kg`, 'scene-small')}
    ${text(300, 364, `추진제 ${f(v.e)} kg 추가 사용 → 속도 +${f(m.dy)} m/s`, 'scene-heading')}
    ${text(300, 398, '화살표: 진행 방향 · 노란색: 남은 추진제', 'scene-small')}`;
}

function batteryScene(m, v, progress) {
  const remaining = m.fn(v.t + v.e * progress);
  return `${text(150, 40, '지금', 'scene-heading')}${text(450, 40, '조금 뒤', 'scene-heading')}
    ${text(150, 77, `t = ${f(v.t)} h`)}${text(450, 77, `t + e = ${f(v.t+v.e*progress)} h`)}
    ${battery(150, m.y)}${battery(450, remaining)}${arrow(260, 193, 70)}
    ${text(150, 314, `${f(m.y)}%`, 'scene-value')}${text(450, 314, `${f(remaining)}%`, 'scene-value')}
    ${text(300, 365, `${f(v.e)}시간 동안 ${f(-m.dy)}%p 감소`, 'scene-heading')}
    ${text(300, 398, '시간 간격을 줄여 순간적인 소모 속도를 확인하세요.', 'scene-small')}`;
}

function roadScene(m) {
  // Same distance scale in both directions, with screen y inverted.
  const px = (x) => 240 + x * 45;
  const py = (y) => 230 - y * 45;
  const road = Array.from({length:101}, (_,i) => {
    const x = -2.8 + 7.8*i/100;
    return `${i ? 'L' : 'M'}${px(x)},${py(m.fn(x))}`;
  }).join(' ');
  const angle = -Math.atan(m.candidateSlope)*180/Math.PI;
  return `${text(300, 35, '굽은 길에서 어느 방향으로 나아갈까?', 'scene-heading')}
    <path d="${road}" fill="none" stroke="#e4e8ed" stroke-width="43" stroke-linecap="round"/>
    <path d="${road}" fill="none" stroke="white" stroke-width="2" stroke-dasharray="10 10"/>
    <circle cx="${px(m.a)}" cy="230" r="${m.radius*45}" fill="none" stroke="#93a795" stroke-width="1.5" stroke-dasharray="5 5"/>
    <path d="M${px(m.a)},230L285,140" stroke="#93a795" stroke-width="1.5"/>
    <circle cx="${px(m.a)}" cy="230" r="4" fill="#536b57"/>${text(px(m.a), 252, 'Q', 'scene-small')}
    ${!m.contact ? `<circle cx="${px(m.sx)}" cy="${py(m.sy)}" r="5" fill="#668a6d"/>${text(px(m.sx),py(m.sy)-23,'S','scene-small')}` : ''}
    <g transform="translate(285 140) rotate(-14.036)"><rect x="-21" y="-11" width="42" height="22" rx="7" fill="white" stroke="#29384a" stroke-width="2"/><path d="M6,-8V8" stroke="#29384a" stroke-width="2"/></g>
    <g transform="translate(285 140) rotate(${angle})" style="color:${m.contact ? '#306a46' : '#b67632'}">${arrow(26, 0, 73)}</g>
    ${text(279, 105, 'P', 'scene-small')}
    ${text(300, 374, m.contact ? '방향 일치 · 접선 완성' : '원의 중심을 움직여 진행 방향을 맞춰보세요.', 'scene-heading')}
    ${text(300, 405, '자동차: 도로 방향 · 화살표: 원의 반지름에 수직인 후보 방향', 'scene-small')}`;
}

export function renderScene(type, model, values, progress = 1) {
  const content = type === 'rocket' ? rocketScene(model, values, progress)
    : type === 'battery' ? batteryScene(model, values, progress) : roadScene(model);
  return `<svg viewBox="0 0 600 430" role="img" aria-label="${type === 'rocket' ? '로켓의 추진제 방출 전후' : type === 'battery' ? '시간에 따른 배터리 잔량 변화' : '곡선 도로 위 자동차의 진행 방향'}">
    <defs><marker id="scene-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0L10,5L0,10Z" fill="currentColor"/></marker></defs>
    ${content}</svg>`;
}

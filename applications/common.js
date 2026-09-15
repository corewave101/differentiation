export const fmt = (n, digits = 2) => Number(n.toFixed(digits)).toLocaleString('ko-KR');
export const control = (id, label, min, max, step, value) => `<label class="mvp-control" for="${id}"><span>${label}</span><output id="${id}-out">${value}</output><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"></label>`;
export const metrics = (rows) => rows.map(([label, value]) => `<div class="mvp-metric"><small>${label}</small><strong>${value}</strong></div>`).join('');

export function chart(series, { xmin = 0, xmax = 1, ymin = 0, ymax = 1, label = '', cursor, markers = [] } = {}) {
  const X = (x) => 52 + (x-xmin)/(xmax-xmin)*370;
  const Y = (y) => 176 - (y-ymin)/(ymax-ymin)*144;
  const ticks = Array.from({ length: 4 }, (_, i) => {
    const y = ymin + (ymax-ymin)*i/3;
    const x = xmin + (xmax-xmin)*i/3;
    return `<path d="M52 ${Y(y)}H422" stroke="#e4eaf2"/><text x="45" y="${Y(y)+4}" text-anchor="end">${fmt(y,1)}</text><text x="${X(x)}" y="195" text-anchor="middle">${fmt(x,1)}</text>`;
  }).join('');
  return `<svg class="mvp-chart" viewBox="0 0 450 210" role="img" aria-label="${label}"><text x="52" y="17">${label}</text>${ticks}${series.map(({points, color}) => `<polyline points="${points.filter(([x,y]) => Number.isFinite(x+y)).map(([x,y])=>`${X(x)},${Y(y)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="2.3"/>`).join('')}${cursor === undefined ? '' : `<path d="M${X(cursor)} 30V176" stroke="#8d9fb4" stroke-dasharray="4 4"/>`}${markers.map(([x,y,color])=>`<circle cx="${X(x)}" cy="${Y(y)}" r="4" fill="${color}" stroke="white"/>`).join('')}</svg>`;
}

export function equation(root, tex) {
  if (globalThis.katex) globalThis.katex.render(tex, root, { displayMode: true, throwOnError: false });
  else root.textContent = tex;
}

import { clamp, swing, contactTime } from './models.js';
import { control, metrics, fmt, chart, equation } from './common.js';

export function mount(root) {
  root.innerHTML = `<h3>탑뷰에서 본 배트와 날아가는 공</h3>
    <p>가로로 긴 화면에서 두 스윙의 속력을 비교하고, 공이 임팩트 뒤 날아가는 모습을 봅니다.</p>
    <div class="bat-wide">
      <div class="bat-stage"></div>
      <div class="mvp-actions"><button data-play>느리게 재생</button><button data-reset>처음으로</button></div>
      <div class="bat-controls">
        ${control('bat-time', '재생 시점 (%)', 0, 100, .1, 0)}
        ${control('bat-duration', '전체 스윙 시간 (s)', .15, .4, .01, .2)}
        ${control('bat-contact', '경로상 공의 위치 (%)', 20, 95, 1, 67)}
        ${control('bat-impact', '충격시간 Δt (ms)', 8, 60, 1, 25)}
      </div>
      <div class="mvp-metrics"></div>
      <div class="bat-distance-plot"></div>
      <div class="bat-speed-plot"></div>
      <div class="bat-impulse-plot"></div>
    </div>
    <details><summary>미분한 속력에서 충격량까지</summary>
      <div class="mvp-equation"></div>
      <p>이동거리 함수 <b>s(t)</b>를 미분하면 배트 속도 <b>s'(t)</b>가 됩니다. 가상의 충돌시간 <b>Δt</b> 동안 솟는 충격력 그래프의 면적이 충격량 <b>J=∫Fdt</b>이고, 공 질량은 145g으로 둔 설명용 모델입니다.</p>
    </details>`;

  let u = 0;
  let duration = .2;
  let contact = .67;
  let impactDuration = .025;
  let playing = false;
  let last = 0;
  let frame;
  const colors = ['#2365ae', '#d98531'];

  function draw() {
    const lanes = [
      { sign: 1, y: 115, color: colors[0], title: '1 · 초반에 빠르게' },
      { sign: -1, y: 400, color: colors[1], title: '2 · 후반에 빠르게' },
    ];
    const xPivot = 170;
    const batLength = 120;
    const xEnd = 1005;
    // Screen coordinates grow downward: start south-west, then sweep through south to south-east.
    const angleStart = 2.35;
    const angleSpan = -2.0;
    const contacts = lanes.map((lane) => contactTime(contact, lane.sign));
    const impulseValues = contacts.map((value, index) => impulseAt(value, index ? -1 : 1, duration));
    const scenes = lanes.map((lane) => {
      const state = swing(u, lane.sign, duration);
      const hitAt = contactTime(contact, lane.sign);
      const flight = clamp((u - hitAt) / Math.max(.001, 1 - hitAt), 0, 1);
      // The bat starts behind the body (upper-left) and sweeps forward to the right.
      const angle = angleStart + state.fraction * angleSpan;
      const tipX = xPivot + Math.cos(angle) * batLength;
      const tipY = lane.y + Math.sin(angle) * batLength;
      const impactAngle = angleStart + contact * angleSpan;
      const impactX = xPivot + Math.cos(impactAngle) * batLength;
      const impactY = lane.y + Math.sin(impactAngle) * batLength;
      const trajectoryPoint = (progress) => ({
        x: impactX + (xEnd - impactX) * progress,
        y: impactY + Math.sin(Math.PI * progress) * 95 + progress * 5,
      });
      const ballPoint = trajectoryPoint(flight);
      const ballX = ballPoint.x;
      const ballY = ballPoint.y;
      const arcPoints = Array.from({ length: 30 }, (_, index) => {
        const arcAngle = angleStart + index / 29 * angleSpan;
        return [xPivot + Math.cos(arcAngle) * batLength, lane.y + Math.sin(arcAngle) * batLength];
      });
      const sweepPath = arcPoints.map(([x, y], index) => `${index ? 'L' : 'M'}${x} ${y}`).join(' ');
      const target = `<circle cx="${impactX}" cy="${impactY}" r="11" fill="white" stroke="${lane.color}" stroke-width="3" stroke-dasharray="4 4"/>`;
      const flightPath = `<path d="M${impactX} ${impactY} Q ${(impactX + xEnd) / 2} ${impactY + 100} ${xEnd} ${impactY + 5}" fill="none" stroke="${lane.color}" stroke-opacity=".25" stroke-width="3" stroke-dasharray="8 8"/>`;
      const trailDots = Array.from({ length: 18 }, (_, index) => {
        const progress = flight * index / 17;
        const point = trajectoryPoint(progress);
        return `<circle cx="${point.x}" cy="${point.y}" r="${index % 3 === 0 ? 3 : 2}" fill="${lane.color}" fill-opacity="${.18 + index / 90}"/>`;
      }).join('');
      const ball = `<circle cx="${ballX}" cy="${ballY}" r="10" fill="#f8c94a" stroke="#9b6b00" stroke-width="2"/>`;
      return `<text x="34" y="${lane.y - 58}" fill="${lane.color}" font-weight="700">${lane.title}</text>
        <line x1="42" y1="${lane.y + 48}" x2="${xEnd + 18}" y2="${lane.y + 48}" stroke="#cad5e3" stroke-width="2"/>
        <text x="42" y="${lane.y - 30}" fill="#6b7d92" font-size="13">탑뷰 · 배트가 공을 향해 움직임</text>
        <text x="${xPivot - 12}" y="${lane.y + 35}" fill="#6b7d92" font-size="12">1 시작</text>
        <text x="${impactX - 20}" y="${impactY - 18}" fill="#6b7d92" font-size="12">2 임팩트</text>
        <text x="${xEnd - 32}" y="${lane.y + 92}" fill="#6b7d92" font-size="12">공 자취</text>
        <path d="${sweepPath}" fill="none" stroke="${lane.color}" stroke-opacity=".2" stroke-width="3" stroke-dasharray="5 7"/>
        ${flightPath}${flight ? trailDots : ''}${target}
        <circle cx="${xPivot}" cy="${lane.y}" r="20" fill="#dce6f1"/>
        <path d="M${xPivot} ${lane.y} L${tipX} ${tipY}" stroke="${lane.color}" stroke-width="12" stroke-linecap="round"/>
        <circle cx="${tipX}" cy="${tipY}" r="7" fill="${lane.color}"/>
        ${ball}
        <text x="${xEnd - 5}" y="${lane.y + 26}" text-anchor="end" fill="${lane.color}">현재 배트 속력 ${fmt(state.speed)} m/s</text>`;
    }).join('');

    const impulseBadge = `<g><rect x="810" y="12" width="270" height="54" rx="9" fill="#0b3b7c"/><text x="828" y="34" fill="#d8e8fb" font-size="12">충격량 J = ∫Fdt = mΔv</text><text x="828" y="54" fill="#fff" font-size="16" font-weight="700">1: ${fmt(impulseValues[0], 3)} | 2: ${fmt(impulseValues[1], 3)} N·s</text></g>`;
    root.querySelector('.bat-stage').innerHTML = `<svg viewBox="0 0 1100 800" role="img" aria-label="가로로 긴 탑뷰 배트와 공의 비행 비교"><rect width="1100" height="520" rx="14" fill="#fff"/>${impulseBadge}${scenes}</svg>`;
    root.querySelector('.mvp-metrics').innerHTML = metrics([
      ['1 임팩트 속력', `${fmt(swing(contacts[0], 1, duration).speed)} m/s`],
      ['2 임팩트 속력', `${fmt(swing(contacts[1], -1, duration).speed)} m/s`],
      ['1 최대 충격력', `${fmt(peakForce(impulseValues[0], impactDuration), 0)} N`],
      ['2 최대 충격력', `${fmt(peakForce(impulseValues[1], impactDuration), 0)} N`],
      ['충격시간 Δt', `${fmt(impactDuration * 1000, 0)} ms`],
      ['공 질량 · 평균 속력', `145 g · ${fmt(2 / duration)} m/s`],
    ]);
    root.querySelector('.bat-distance-plot').innerHTML = chart(
      [1, -1].map((sign, i) => ({
        color: colors[i],
        points: Array.from({ length: 101 }, (_, j) => [j / 100 * duration, swing(j / 100, sign, duration).distance]),
      })),
      {
        xmax: duration,
        ymax: 2.1,
        label: '시간 t (s) → 이동거리 s(t) (m)',
        cursor: u * duration,
        markers: contacts.map((c, i) => [c * duration, swing(c, i ? -1 : 1, duration).distance, colors[i]]),
      },
    );
    root.querySelector('.bat-speed-plot').innerHTML = chart(
      [1, -1].map((sign, i) => ({
        color: colors[i],
        points: Array.from({ length: 101 }, (_, j) => [j / 100 * duration, swing(j / 100, sign, duration).speed]),
      })),
      {
        xmax: duration,
        ymax: 2 / duration * 2,
        label: "시간 t (s) → 배트 속도 s'(t) (m/s)",
        cursor: u * duration,
        markers: contacts.map((c, i) => [c * duration, swing(c, i ? -1 : 1, duration).speed, colors[i]]),
      },
    );
    root.querySelector('.bat-impulse-plot').innerHTML = chart(
      [1, -1].map((sign, i) => ({
        color: colors[i],
        points: Array.from({ length: 101 }, (_, j) => {
          const tau = j / 100 * impactDuration;
          return [tau * 1000, collisionForce(tau, impulseValues[i], impactDuration)];
        }),
      })),
      {
        xmax: impactDuration * 1000,
        ymax: Math.max(1, Math.max(...impulseValues.map((value) => peakForce(value, impactDuration))) * 1.15),
        label: '충돌시간 τ (ms) → 충격력 F (N), 그래프 면적 = 충격량 J',
        cursor: impactDuration * 1000 / 2,
        markers: impulseValues.map((value, i) => [impactDuration * 1000 / 2, peakForce(value, impactDuration), colors[i]]),
      },
    );
    for (const [id, value] of [['time', u * 100], ['duration', duration], ['contact', contact * 100], ['impact', impactDuration * 1000]]) {
      root.querySelector(`#bat-${id}`).value = value;
      root.querySelector(`#bat-${id}-out`).textContent = fmt(value);
    }
    root.querySelector('[data-play]').textContent = playing ? '일시 정지' : '느리게 재생';
  }

  const input = () => {
    playing = false;
    u = +root.querySelector('#bat-time').value / 100;
    duration = +root.querySelector('#bat-duration').value;
    contact = +root.querySelector('#bat-contact').value / 100;
    impactDuration = +root.querySelector('#bat-impact').value / 1000;
    draw();
  };
  const click = (event) => {
    if (event.target.closest('[data-play]')) {
      if (u >= 1) u = 0;
      playing = !playing;
    }
    if (event.target.closest('[data-reset]')) {
      u = 0;
      playing = false;
    }
    draw();
  };
  root.addEventListener('input', input);
  root.addEventListener('click', click);
  equation(root.querySelector('.mvp-equation'), String.raw`s_{1,2}(t)=2[3u^2-2u^3\pm2u^2(1-u)^2],\quad v=s'(t),\quad J=\int F\,dt=\Delta p=m\Delta v`);

  function impulseAt(progress, sign, totalDuration) {
    const impactSpeed = swing(progress, sign, totalDuration).speed;
    const ballMass = .145;
    const exitSpeed = impactSpeed * 1.35;
    return ballMass * exitSpeed;
  }

  function collisionForce(tau, impulse, deltaT) {
    const phase = tau / deltaT;
    if (phase < 0 || phase > 1) return 0;
    return peakForce(impulse, deltaT) * Math.sin(Math.PI * phase);
  }

  function peakForce(impulse, deltaT) {
    return impulse * Math.PI / (2 * deltaT);
  }

  function tick(now) {
    if (playing) {
      u = Math.min(1, u + (last ? Math.min(now - last, 50) : 0) / 2400);
      if (u === 1) playing = false;
      draw();
    }
    last = now;
    frame = requestAnimationFrame(tick);
  }
  draw();
  frame = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(frame);
    root.removeEventListener('input', input);
    root.removeEventListener('click', click);
  };
}

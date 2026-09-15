import { clamp, releaseVelocity, stepBall } from './models.js';
import { metrics, fmt, chart, equation } from './common.js';

export function mount(root) {
  root.innerHTML = `<h3>공이 있는 터치스크린: 속도로 입력 구분</h3>
    <p>공을 눌러 움직여 보세요. 오른쪽 위 속도계는 최근 손가락 위치를 미분한 순간 속력이며 30Hz로 갱신됩니다.</p>
    <div class="touch-layout">
      <div>
        <div class="touch-screen"><canvas class="touch-stage" width="900" height="430" aria-label="공을 조작하는 터치스크린"></canvas></div>
        <div class="mvp-actions"><button data-tap>예시 · 터치</button><button data-drag>예시 · 드래그</button><button data-swipe>예시 · 스와이프</button><button data-reset>초기화</button></div>
        <p class="mvp-status" role="status">공을 눌러 움직여 보세요.</p>
      </div>
      <aside>
        <div class="mvp-metrics"></div>
        <div class="touch-plot"></div>
        <p class="mvp-note">터치: 무지개 공 · 드래그: 놓은 속도로 이동 · 스와이프: 더 빠르게 발사</p>
      </aside>
    </div>
    <details><summary>손가락 위치 → 속도 → 공의 움직임</summary>
      <div class="mvp-equation"></div>
      <p>최근 위치 표본의 기울기 Δx/Δt, Δy/Δt를 구해 속력을 계산합니다. 짧고 느린 입력은 터치, 중간 속도 이동은 드래그, 빠르고 긴 입력은 스와이프로 분류합니다.</p>
    </details>`;

  const canvas = root.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  let active = false;
  let pointerId = null;
  let start = null;
  let current = { x: 450, y: 245 };
  let samples = [];
  let path = [];
  let history = [];
  let ballTrail = [];
  let speed = 0;
  let peak = 0;
  let elapsed = 0;
  let gestureDistance = 0;
  let result = '대기 중';
  let startedAt = 0;
  let lastPointerAt = 0;
  let lastFrame = 0;
  let motion = false;
  const ball = { x: 450, y: 245, vx: 0, vy: 0, r: 23, rainbow: false, mode: '대기' };

  const position = (event) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: clamp((event.clientX - rect.left) * 900 / rect.width, 0, 900),
      y: clamp((event.clientY - rect.top) * 430 / rect.height, 0, 430),
    };
  };
  const updateSpeed = (now, saveHistory = true) => {
    samples = samples.filter((sample) => now - sample.t <= 120);
    const velocity = releaseVelocity(samples, now);
    speed = Math.hypot(velocity.vx, velocity.vy);
    peak = Math.max(peak, speed);
    elapsed = Math.max(0, (now - startedAt) / 1000);
    if (saveHistory) {
      history.push({ t: elapsed, v: speed });
      history = history.slice(-180);
    }
    return velocity;
  };
  const record = (now, point) => {
    lastPointerAt = now;
    samples.push({ t: now, x: point.x, y: point.y });
    return updateSpeed(now);
  };
  const down = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    const now = performance.now();
    current = position(event);
    active = true;
    motion = false;
    pointerId = event.pointerId;
    startedAt = now;
    start = { ...current, t: now };
    samples = [];
    path = [{ ...current }];
    history = [];
    ballTrail = [];
    speed = 0;
    peak = 0;
    elapsed = 0;
    lastPointerAt = 0;
    gestureDistance = 0;
    result = '움직임을 측정하는 중…';
    ball.rainbow = false;
    ball.mode = '잡는 중';
    ball.x = current.x;
    ball.y = current.y;
    ball.vx = 0;
    ball.vy = 0;
    canvas.setPointerCapture(pointerId);
    record(now, current);
    draw();
  };
  const move = (event) => {
    if (!active || event.pointerId !== pointerId) return;
    event.preventDefault();
    const now = performance.now();
    current = position(event);
    path.push({ ...current });
    const velocity = record(now, current);
    ball.x = current.x;
    ball.y = current.y;
    ball.vx = velocity.vx;
    ball.vy = velocity.vy;
    draw();
  };
  const finish = (event) => {
    if (!active || event.pointerId !== pointerId) return;
    const now = performance.now();
    let velocity = { vx: 0, vy: 0 };
    if (event.type !== 'pointercancel') {
      current = position(event);
      path.push({ ...current });
      velocity = record(now, current);
    }
    const distance = start ? Math.hypot(current.x - start.x, current.y - start.y) : 0;
    const durationMs = start ? now - start.t : 0;
    gestureDistance = distance;
    if (event.type === 'pointercancel') {
      result = '취소됨';
      ball.mode = '취소됨';
    } else if (distance < 35 && durationMs < 350) {
      result = '터치';
      ball.rainbow = true;
      ball.mode = '터치 → 무지개 공';
      ball.vx = 0;
      ball.vy = 0;
      motion = false;
    } else if (distance >= 120 && peak >= 1100) {
      result = '스와이프';
      ball.rainbow = false;
      ball.mode = '스와이프 → 빠른 발사';
      ball.vx = velocity.vx * 1.45;
      ball.vy = velocity.vy * 1.45;
      motion = true;
    } else if (distance >= 35) {
      result = '드래그';
      ball.rainbow = false;
      ball.mode = '드래그 → 놓은 속도로 이동';
      ball.vx = velocity.vx;
      ball.vy = velocity.vy;
      motion = true;
    } else {
      result = '터치';
      ball.rainbow = true;
      ball.mode = '터치 → 무지개 공';
      motion = false;
    }
    active = false;
    if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
    // The gesture has ended, so the current finger velocity is zero.
    speed = 0;
    root.querySelector('.mvp-status').textContent = `${result} · 이동 거리 ${fmt(distance, 0)} px · 최고 속력 ${fmt(peak, 0)} px/s`;
    draw();
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', finish);
  canvas.addEventListener('pointercancel', finish);

  const reset = () => {
    if (active && pointerId !== null && canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
    active = false;
    pointerId = null;
    start = null;
    current = { x: 450, y: 245 };
    samples = [];
    path = [];
    history = [];
    ballTrail = [];
    speed = 0;
    peak = 0;
    elapsed = 0;
    gestureDistance = 0;
    result = '대기 중';
    motion = false;
    ball.x = 450;
    ball.y = 245;
    ball.vx = 0;
    ball.vy = 0;
    ball.rainbow = false;
    ball.mode = '대기';
    root.querySelector('.mvp-status').textContent = '공을 눌러 움직여 보세요.';
    draw();
  };
  const sample = (kind) => {
    reset();
    const now = performance.now();
    startedAt = now;
    const points = kind === 'tap'
      ? [{ x: 450, y: 245, dt: 0 }, { x: 455, y: 247, dt: 90 }, { x: 450, y: 245, dt: 180 }]
      : kind === 'drag'
        ? Array.from({ length: 11 }, (_, index) => ({ x: 180 + index * 30, y: 300 - index * 12, dt: index * 55 }))
        : Array.from({ length: 10 }, (_, index) => ({ x: 130 + index * 70, y: 290 - Math.sin(index / 9 * Math.PI) * 48, dt: index * 25 }));
    path = [];
    samples = [];
    history = [];
    for (const point of points) {
      const t = now + point.dt;
      current = { x: point.x, y: point.y };
      ball.x = current.x;
      ball.y = current.y;
      path.push({ ...current });
      record(t, current);
    }
    const distance = Math.hypot(points.at(-1).x - points[0].x, points.at(-1).y - points[0].y);
    gestureDistance = distance;
    const velocity = releaseVelocity(samples, now + points.at(-1).dt);
    if (kind === 'tap') {
      result = '터치';
      ball.rainbow = true;
      ball.mode = '터치 → 무지개 공';
      motion = false;
    } else if (kind === 'drag') {
      result = '드래그';
      ball.vx = velocity.vx;
      ball.vy = velocity.vy;
      ball.mode = '드래그 → 놓은 속도로 이동';
      motion = true;
    } else {
      result = '스와이프';
      ball.vx = velocity.vx * 1.45;
      ball.vy = velocity.vy * 1.45;
      ball.mode = '스와이프 → 빠른 발사';
      motion = true;
    }
    root.querySelector('.mvp-status').textContent = `${result} 예시 · 이동 거리 ${fmt(distance, 0)} px · 최고 속력 ${fmt(peak, 0)} px/s`;
    draw();
  };
  const click = (event) => {
    if (event.target.closest('[data-reset]')) reset();
    if (event.target.closest('[data-tap]')) sample('tap');
    if (event.target.closest('[data-drag]')) sample('drag');
    if (event.target.closest('[data-swipe]')) sample('swipe');
  };
  root.addEventListener('click', click);
  const fingerTimer = setInterval(() => {
    if (!active) return;
    // Re-sample at 30Hz even when no pointermove event arrives. If no new
    // pointer sample arrived during this tick, the instantaneous speed is 0.
    const now = performance.now();
    if (now - lastPointerAt >= 1000 / 30) {
      speed = 0;
      elapsed = Math.max(0, (now - startedAt) / 1000);
      history.push({ t: elapsed, v: 0 });
      history = history.slice(-180);
    } else {
      updateSpeed(now);
    }
    draw();
  }, 1000 / 30);

  function drawBall() {
    if (ball.rainbow) {
      const hues = [0, 45, 90, 150, 210, 270, 315];
      hues.forEach((hue, index) => {
        ctx.fillStyle = `hsl(${hue} 85% 58%)`;
        ctx.beginPath();
        ctx.moveTo(ball.x, ball.y);
        ctx.arc(ball.x, ball.y, ball.r, index / hues.length * Math.PI * 2, (index + 1) / hues.length * Math.PI * 2);
        ctx.closePath();
        ctx.fill();
      });
    } else {
      const gradient = ctx.createRadialGradient(ball.x - 8, ball.y - 8, 2, ball.x, ball.y, ball.r);
      gradient.addColorStop(0, ball.mode.startsWith('스와이프') ? '#ffd16e' : '#91c9ff');
      gradient.addColorStop(1, ball.mode.startsWith('스와이프') ? '#d98531' : '#2464a9');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  function draw() {
    ctx.clearRect(0, 0, 900, 430);
    const gradient = ctx.createLinearGradient(0, 0, 900, 430);
    gradient.addColorStop(0, '#eff5fd');
    gradient.addColorStop(1, '#dce9f8');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 900, 430);
    ctx.strokeStyle = '#cbd9e9';
    ctx.lineWidth = 1;
    for (let x = 0; x <= 900; x += 45) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 430); ctx.stroke(); }
    for (let y = 0; y <= 430; y += 45) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(900, y); ctx.stroke(); }
    ctx.fillStyle = '#345372';
    ctx.font = '700 14px sans-serif';
    ctx.fillText('TOUCH SURFACE', 24, 30);
    ctx.textAlign = 'right';
    ctx.fillStyle = active ? '#0b3b7c' : '#526a85';
    ctx.fillText(`현재 손가락 속도 ${fmt(speed, 0)} px/s`, 876, 30);
    ctx.textAlign = 'left';
    if (ballTrail.length > 1) {
      ctx.strokeStyle = ball.mode.startsWith('스와이프') ? '#d98531aa' : '#2365ae88';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ballTrail.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
      ctx.stroke();
    }
    if (path.length > 1) {
      ctx.strokeStyle = '#2365ae';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      path.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
      ctx.stroke();
    }
    drawBall();
    ctx.fillStyle = '#526a85';
    ctx.font = '13px sans-serif';
    ctx.fillText(active ? '손가락으로 공을 잡는 중' : ball.mode, 24, 402);
    const distance = active && start ? Math.hypot(current.x - start.x, current.y - start.y) : gestureDistance;
    root.querySelector('.mvp-metrics').innerHTML = metrics([
      ['현재 속력', `${fmt(speed, 0)} px/s`],
      ['최고 속력', `${fmt(peak, 0)} px/s`],
      ['이동 거리', `${fmt(distance, 0)} px`],
      ['입력 판정', result],
    ]);
    const xmax = Math.max(2, elapsed);
    root.querySelector('.touch-plot').innerHTML = chart([{ color: '#2365ae', points: history.map((point) => [point.t, point.v]) }], { xmin: 0, xmax, ymax: Math.max(400, peak * 1.25), label: '시간 t (s) → 손가락 속력 ds/dt (px/s)' });
  }

  equation(root.querySelector('.mvp-equation'), String.raw`v_x=\frac{\Delta x}{\Delta t},\quad v_y=\frac{\Delta y}{\Delta t},\quad |v|=\sqrt{v_x^2+v_y^2}`);
  function tick(now) {
    const dt = lastFrame ? Math.min((now - lastFrame) / 1000, .05) : 0;
    lastFrame = now;
    if (!active && motion) {
      stepBall(ball, dt, 900, .72, 900, 430);
      ballTrail.push({ x: ball.x, y: ball.y });
      ballTrail = ballTrail.slice(-35);
      if (ball.y >= 430 - ball.r - 1 && Math.hypot(ball.vx, ball.vy) < 28) {
        ball.vx = 0;
        ball.vy = 0;
        motion = false;
      }
      draw();
    }
    frame = requestAnimationFrame(tick);
  }
  draw();
  let frame = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(frame);
    clearInterval(fingerTimer);
    if (active && pointerId !== null && canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', finish);
    canvas.removeEventListener('pointercancel', finish);
    root.removeEventListener('click', click);
  };
}

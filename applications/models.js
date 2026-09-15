export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export function boxModel(L, W, x) {
  const optimum = (L + W - Math.sqrt(L * L - L * W + W * W)) / 6;
  const volume = (cut) => cut * (L - 2 * cut) * (W - 2 * cut);
  return { width: L - 2 * x, depth: W - 2 * x, height: x,
    volume: volume(x), derivative: L * W - 4 * (L + W) * x + 12 * x * x,
    optimum, maxVolume: volume(optimum), volumeAt: volume };
}

// Volume models used by the 3D solid selector. Each model exposes a
// one-variable volume function and its derivative for the side panel.
export function fixedAreaBoxModel(surface, ratio, height) {
  const depthAt = (h) => surface / (Math.sqrt(h * h * (ratio + 1) ** 2 + ratio * surface) + h * (ratio + 1));
  const volumeAt = (h) => ratio * depthAt(h) ** 2 * h;
  const depth = depthAt(height);
  const width = ratio * depth;
  const optimum = Math.sqrt(ratio * surface / (3 * (ratio + 1) ** 2));
  return {
    kind: 'box', surface, width, depth, height, volume: volumeAt(height),
    derivative: width * depth * (1 - 2 * height * (ratio + 1) / Math.sqrt(height ** 2 * (ratio + 1) ** 2 + ratio * surface)),
    optimum, maxVolume: volumeAt(optimum), volumeAt,
    base: 0, sceneSize: Math.max(Math.sqrt(surface * ratio), Math.sqrt(surface / ratio), 20), centerY: height / 2,
  };
}

// Water volume below a horizontal surface h above the bottom.
export function waterVolumeAt(model, h) {
  h = clamp(h, 0, model.height);
  if (model.kind === 'sphere') return Math.PI * h * h * (model.radius - h / 3);
  if (model.kind === 'cone') {
    const u = h / model.height;
    return model.volume * u * (3 - 3 * u + u * u);
  }
  return model.volume * h / model.height;
}

export function fillState(model, amount, flow = 120) {
  const volume = clamp(amount, 0, model.volume);
  let lo = 0;
  let hi = model.height;
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    if (waterVolumeAt(model, mid) < volume) lo = mid;
    else hi = mid;
  }
  const height = volume === 0 ? 0 : volume === model.volume ? model.height : (lo + hi) / 2;
  const radius = model.kind === 'sphere'
    ? Math.sqrt(Math.max(0, height * (2 * model.radius - height)))
    : model.kind === 'cone' ? model.radius * (1 - height / model.height) : model.radius;
  const area = model.kind === 'box' ? model.width * model.depth : Math.PI * radius ** 2;
  return { height, radius, area, speed: volume >= model.volume ? 0 : area > 1e-10 ? flow / area : Infinity };
}

export function solidModel(kind, value) {
  if (kind === 'cylinder') {
    const surface = 400;
    const radius = clamp(value, 3, 7.9);
    const heightAt = (r) => surface / (2 * Math.PI * r) - r;
    const volumeAt = (r) => surface * r / 2 - Math.PI * r ** 3;
    const optimum = Math.sqrt(surface / (6 * Math.PI));
    return {
      kind, radius, height: heightAt(radius), volume: volumeAt(radius),
      derivative: surface / 2 - 3 * Math.PI * radius * radius,
      volumeAt, optimum, maxVolume: volumeAt(optimum), minRadius: 3, maxRadius: 7.9,
      base: 0, sceneSize: 19, centerY: heightAt(radius) / 2,
    };
  }
  if (kind === 'cone') {
    const slant = 12;
    const radius = clamp(value, .5, 11.5);
    const heightAt = (r) => Math.sqrt(Math.max(.001, slant * slant - r * r));
    const volumeAt = (r) => Math.PI * r * r * heightAt(r) / 3;
    const derivativeAt = (r) => Math.PI * r * (2 * slant * slant - 3 * r * r) / (3 * heightAt(r));
    const optimum = slant * Math.sqrt(2 / 3);
    return {
      kind, radius, height: heightAt(radius), volume: volumeAt(radius),
      derivative: derivativeAt(radius), volumeAt, optimum, maxVolume: volumeAt(optimum), maxRadius: 11.5,
      base: 0, sceneSize: 24, centerY: heightAt(radius) / 2,
    };
  }
  if (kind === 'sphere') {
    const radius = clamp(value, 1, 10);
    const volumeAt = (r) => 4 * Math.PI * r * r * r / 3;
    return {
      kind, radius, height: radius * 2, volume: volumeAt(radius),
      derivative: 4 * Math.PI * radius * radius, volumeAt, optimum: null,
      maxVolume: volumeAt(10), maxRadius: 10, base: -radius, sceneSize: 22, centerY: 0,
    };
  }
  throw new Error(`Unknown solid: ${kind}`);
}

// Two monotone swing-distance curves, identical total distance and duration.
export function swing(u, sign, duration = 0.2, distance = 2) {
  u = clamp(u, 0, 1);
  const p = 3 * u * u - 2 * u ** 3 + sign * 2 * u * u * (1 - u) ** 2;
  const dp = 6 * u - 6 * u * u + sign * 2 * (2 * u - 6 * u * u + 4 * u ** 3);
  return { distance: distance * p, speed: distance / duration * dp, fraction: p };
}

export function contactTime(fraction, sign) {
  let lo = 0, hi = 1;
  for (let i = 0; i < 45; i++) {
    const mid = (lo + hi) / 2;
    if (swing(mid, sign).fraction < fraction) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// Fit the slope of the recent pointer samples, including the release sample.
export function releaseVelocity(samples, now) {
  const recent = samples.filter((s) => now - s.t <= 100);
  if (recent.length < 2 || recent.at(-1).t - recent[0].t < 8) return { vx: 0, vy: 0 };
  const mean = (key) => recent.reduce((sum, s) => sum + s[key], 0) / recent.length;
  const mt = mean('t'), mx = mean('x'), my = mean('y');
  let denom = 0, nx = 0, ny = 0;
  for (const s of recent) {
    const dt = (s.t - mt) / 1000;
    denom += dt * dt;
    nx += dt * (s.x - mx);
    ny += dt * (s.y - my);
  }
  return denom ? { vx: clamp(nx / denom, -1500, 1500), vy: clamp(ny / denom, -1500, 1500) } : { vx: 0, vy: 0 };
}

export function stepBall(ball, dt, gravity, bounce, width = 600, height = 380) {
  const r = 20;
  ball.vy += gravity * dt;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  let hit = false;
  if (ball.x < r) { ball.x = r; ball.vx = Math.abs(ball.vx) * bounce; hit = true; }
  if (ball.x > width-r) { ball.x = width-r; ball.vx = -Math.abs(ball.vx) * bounce; hit = true; }
  if (ball.y < r) { ball.y = r; ball.vy = Math.abs(ball.vy) * bounce; hit = true; }
  if (ball.y > height-r) {
    const impactSpeed = Math.abs(ball.vy);
    ball.y = height-r;
    ball.vy = -Math.abs(ball.vy) * bounce;
    ball.vx *= 0.985;
    if (Math.abs(ball.vy) < 20) ball.vy = 0;
    if (Math.abs(ball.vx) < 1) ball.vx = 0;
    hit = hit || impactSpeed >= 20;
  }
  return hit;
}

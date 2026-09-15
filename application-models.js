// Educational models. Time is hours, battery level is percent, mass is kg.
export function batteryModel(t, e) {
  const fn = (x) => 100 - 4 * x - x * x;
  const slope = -4 - 2 * t;
  return { fn, x: t, y: fn(t), dx: e, dy: e * (slope - e),
    slope, secant: e === 0 ? null : slope - e };
}

export function roadModel(a) {
  const fn = (x) => Math.sqrt(x + 3);
  const sx = 2 * a - 2;
  return { fn, x: 1, y: 2, a, sx, sy: fn(sx),
    radius: Math.hypot(1 - a, 2), contact: a === 1.5,
    candidateSlope: (a - 1) / 2, slope: 0.25 };
}

export function rocketModel(b, e, ve) {
  const mass = 1000 - b;
  const fn = (x) => -ve * Math.log1p(-x / 1000);
  // log1p keeps the difference accurate as E tends to zero.
  const dy = -ve * Math.log1p(-e / mass);
  return { fn, x: b, y: fn(b), dx: e, dy, mass,
    slope: ve / mass, secant: e === 0 ? null : dy / e };
}

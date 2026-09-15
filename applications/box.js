import * as THREE from '../vendor/three.module.min.js';
import { fixedAreaBoxModel, fillState, clamp, solidModel } from './models.js';
import { control, metrics, fmt, chart, equation } from './common.js';

const SHAPES = {
  box: {
    label: '상자',
    title: '상자: 같은 종이 면적으로 최대 부피',
    copy: '밑면과 네 옆면의 총면적을 고정합니다. 높이 x를 바꾸면 밑면 가로·세로가 같은 비율로 자동 조절됩니다.',
    equation: String.raw`\begin{gathered}S=ab+2x(a+b),\quad a=kb,\quad V(x)=kb^2x\\ b=\frac{S}{\sqrt{x^2(k+1)^2+kS}+x(k+1)}\\ V'(x)=kb^2\left(1-\frac{2x(k+1)}{\sqrt{x^2(k+1)^2+kS}}\right)\end{gathered}`,
    note: '뚜껑 없는 상자에 실제 사용하는 종이 면적 S를 고정합니다. 밑면 비율 k=a/b도 고정한 상태에서 높이에 따른 부피의 최댓값을 찾습니다.',
  },
  cylinder: {
    label: '원기둥',
    title: '원기둥: 같은 겉넓이에서 최대 부피',
    copy: '겉넓이 400cm²를 고정하고 반지름을 바꿔 보세요. 높이는 조건에 맞춰 자동으로 바뀝니다.',
    equation: String.raw`S=2\pi rh+2\pi r^2=400,\quad V(r)=\pi r^2h(r),\quad V'(r)=200-3\pi r^2`,
    note: '원기둥은 겉넓이를 고정한 최적화 모델입니다. V′(r)=0에서 최대 부피가 됩니다.',
  },
  cone: {
    label: '원뿔',
    title: '원뿔: 모선이 고정된 최대 부피',
    copy: '모선 길이 12cm를 고정하고 밑면 반지름을 바꿔 보세요. 높이와 부피가 함께 변합니다.',
    equation: String.raw`\ell=12,\quad h=\sqrt{\ell^2-r^2},\quad V(r)=\frac{\pi r^2h}{3},\quad V'(r)=\frac{\pi r(2\ell^2-3r^2)}{3h}`, 
    note: '원뿔은 모선 길이를 고정한 최적화 모델입니다. 꼭짓점은 위쪽입니다. 전체 높이 H, 밑면 반지름 R일 때 수면 단면적은 A(h)=πR²(1−h/H)²입니다. 위로 갈수록 단면적이 줄어 수면이 더 빨리 올라갑니다.',
  },
  sphere: {
    label: '구',
    title: '구: 반지름에 따른 부피와 표면적',
    copy: '반지름을 바꿔 구의 부피를 확인해 보세요. 부피를 미분하면 바로 표면적이 됩니다.',
    equation: String.raw`V(r)=\frac{4}{3}\pi r^3,\quad V'(r)=4\pi r^2=S(r)`,
    note: '구 자체의 반지름에 대한 부피 도함수는 표면적 4πr²입니다. 물 채우기에서는 바닥부터의 수면 높이 h를 사용합니다. 물 부피는 πh²(R−h/3), 그 도함수인 수면 단면적은 A(h)=πh(2R−h)입니다.',
  },
};

export function mount(root) {
  root.innerHTML = `<h3 class="shape-title"></h3><p class="shape-copy"></p>
    <nav class="mvp-tabs shape-tabs" aria-label="3D 도형 선택">${Object.entries(SHAPES).map(([id, info], index) => `<button type="button" data-shape="${id}" aria-pressed="${index === 0}">${info.label}</button>`).join('')}</nav>
    <div class="mvp-split"><div><div class="box-stage" aria-label="회전 가능한 3D 도형"></div><div class="mvp-actions"><button data-pour>채우기</button><button data-empty>비우기</button><button data-optimal>최적값 찾기</button></div><p class="mvp-status" role="status"></p></div>
    <aside><div class="shape-controls"></div><div class="mvp-metrics"></div><div class="box-plot"></div></aside></div>
    <details><summary>부피와 도함수</summary><div class="mvp-equation"></div><p class="shape-note"></p></details>
    <p>물은 초당 120cm³씩 들어옵니다. 수면 높이 h에서 dV/dh = 단면적 A(h)이므로, dh/dt = 120/A(h)입니다. 단면이 넓을수록 천천히 차오릅니다.</p>`;

  const stage = root.querySelector('.box-stage');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0xf1f5fb);
  renderer.localClippingEnabled = true;
  stage.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', '회전 가능한 3D 도형');
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 300);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xa4b3c6, 2.5));
  const light = new THREE.DirectionalLight(0xffffff, 3);
  light.position.set(15, 40, 30);
  scene.add(light);
  const shapeGroup = new THREE.Group();
  scene.add(shapeGroup);
  const grid = new THREE.GridHelper(60, 12, 0xc9d6e5, 0xe0e8f1);
  scene.add(grid);

  const shapeMaterial = new THREE.MeshPhysicalMaterial({ color: 0xd9ba79, transparent: true, opacity: .44, roughness: .35, side: THREE.DoubleSide, depthWrite: false });
  const baseMaterial = new THREE.MeshStandardMaterial({ color: 0xd8b676, roughness: .8 });
  const waterPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  const waterMaterial = new THREE.MeshPhysicalMaterial({ color: 0x3eaeec, transparent: true, opacity: .66, roughness: .1, metalness: .1, clippingPlanes: [waterPlane], side: THREE.DoubleSide });
  const surfaceMaterial = new THREE.MeshStandardMaterial({ color: 0x46b9ef, transparent: true, opacity: .85, roughness: .25, side: THREE.DoubleSide });
  const streamMaterial = new THREE.MeshStandardMaterial({ color: 0x66c8ff, transparent: true, opacity: .75 });
  let water = null;
  let waterSurface = null;
  let stream = null;
  let shape = 'box';
  let surface = 600;
  let ratio = 1.5;
  let x = 2;
  let radius = 4.6;
  let model;
  let amount = 0;
  let pouring = false;
  let spill = 0;
  let frame;
  let last = performance.now();
  let lastUI = 0;
  let yaw = .65;
  let pitch = .65;
  let drag = null;

  function currentValue() {
    if (shape === 'box') {
      return fixedAreaBoxModel(surface, ratio, x);
    }
    return solidModel(shape, radius);
  }

  function renderControls() {
    const html = shape === 'box'
      ? `${control('box-area', '고정 종이 면적 S (cm²)', 200, 1200, 10, surface)}${control('box-ratio', '밑면 가로/세로 비율 k', .5, 3, .05, ratio)}${control('box-x', '높이 x (cm)', .25, 20, .01, x)}`
      : shape === 'cylinder'
        ? control('solid-radius', '원기둥 반지름 r (cm)', 3, 7.9, .05, radius)
        : shape === 'cone'
          ? control('solid-radius', '원뿔 반지름 r (cm)', .5, 11.5, .05, radius)
          : control('solid-radius', '구 반지름 r (cm)', 1, 10, .1, radius);
    root.querySelector('.shape-controls').innerHTML = html;
  }

  function clearShape() {
    shapeGroup.traverse((object) => object.geometry?.dispose());
    shapeGroup.clear();
    water = null;
    waterSurface = null;
    stream = null;
  }

  function makeStream(height) {
    const geometry = new THREE.CylinderGeometry(.12, .2, 1, 12);
    stream = new THREE.Mesh(geometry, streamMaterial);
    stream.scale.y = Math.max(.1, height);
    shapeGroup.add(stream);
  }

  function buildShape() {
    clearShape();
    const t = .16;
    if (shape === 'box') {
      const a = model.width;
      const b = model.depth;
      const h = model.height;
      const bottom = new THREE.Mesh(new THREE.BoxGeometry(a + t * 2, t, b + t * 2), baseMaterial);
      bottom.position.y = -t / 2;
      shapeGroup.add(bottom);
      const walls = [
        [new THREE.BoxGeometry(a + t * 2, h, t), 0, h / 2, -b / 2 - t / 2],
        [new THREE.BoxGeometry(a + t * 2, h, t), 0, h / 2, b / 2 + t / 2],
        [new THREE.BoxGeometry(t, h, b), -a / 2 - t / 2, h / 2, 0],
        [new THREE.BoxGeometry(t, h, b), a / 2 + t / 2, h / 2, 0],
      ];
      walls.forEach(([geometry, px, py, pz]) => {
        const wall = new THREE.Mesh(geometry, shapeMaterial);
        wall.position.set(px, py, pz);
        shapeGroup.add(wall);
      });
      water = new THREE.Mesh(new THREE.BoxGeometry(a, 1, b), waterMaterial);
      shapeGroup.add(water);
      makeStream(h + 8);
    } else if (shape === 'cylinder') {
      const r = model.radius;
      const h = model.height;
      const solid = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 64), shapeMaterial);
      solid.position.y = h / 2;
      shapeGroup.add(solid);
      water = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 64), waterMaterial);
      shapeGroup.add(water);
      makeStream(h + 5);
    } else if (shape === 'cone') {
      const r = model.radius;
      const h = model.height;
      const solid = new THREE.Mesh(new THREE.ConeGeometry(r, h, 64), shapeMaterial);
      solid.position.y = h / 2;
      shapeGroup.add(solid);
      water = new THREE.Mesh(new THREE.ConeGeometry(r, h, 64), waterMaterial);
      water.position.y = h / 2;
      shapeGroup.add(water);
      makeStream(h + 5);
    } else {
      const r = model.radius;
      const solid = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 24), shapeMaterial);
      shapeGroup.add(solid);
      water = new THREE.Mesh(new THREE.SphereGeometry(r, 64, 48), waterMaterial);
      shapeGroup.add(water);
      makeStream(r * 2 + 5);
    }
    if (shape === 'cone' || shape === 'sphere') {
      waterSurface = new THREE.Mesh(new THREE.CircleGeometry(1, 96), surfaceMaterial);
      waterSurface.rotation.x = -Math.PI / 2;
      shapeGroup.add(waterSurface);
    }
  }

  function cameraUpdate() {
    const radiusDistance = model.sceneSize * 2.05;
    camera.position.set(Math.sin(yaw) * Math.cos(pitch) * radiusDistance, model.centerY + Math.sin(pitch) * radiusDistance, Math.cos(yaw) * Math.cos(pitch) * radiusDistance);
    camera.lookAt(0, model.centerY, 0);
    grid.position.y = model.base - .3;
  }

  function updateWater() {
    const fill = fillState(model, amount);
    const currentTop = model.base + fill.height;
    waterPlane.constant = currentTop;
    if (water) {
      water.visible = amount > .01;
      if (shape === 'box' || shape === 'cylinder') {
        water.scale.set(1, Math.max(.001, fill.height), 1);
        water.position.y = fill.height / 2;
      }
    }
    if (waterSurface) {
      waterSurface.visible = amount > .01 && fill.radius > .001;
      waterSurface.scale.set(fill.radius, fill.radius, 1);
      waterSurface.position.y = currentTop;
    }
    if (stream) {
      const top = model.base + model.height + 4;
      stream.visible = pouring;
      stream.scale.y = Math.max(.1, top - currentTop);
      stream.position.y = currentTop + (top - currentTop) / 2;
    }
  }

  function refresh() {
    model = currentValue();
    amount = Math.min(amount, model.volume);
    spill = 0;
    if (!root.querySelector('.shape-controls input')) renderControls();
    buildShape();
    for (const [id, value] of shape === 'box'
      ? [['area', surface], ['ratio', ratio], ['x', x]]
      : [['radius', radius]]) {
      const input = root.querySelector(`#${shape === 'box' ? `box-${id}` : 'solid-radius'}`);
      if (input) {
        input.value = value;
        root.querySelector(`#${input.id}-out`).textContent = fmt(value);
      }
    }
    const maxRadius = shape === 'box' ? 20 : model.maxRadius;
    const cursor = shape === 'box' ? x : radius;
    const markers = model.optimum === null
      ? [[radius, model.volume, '#dd862b']]
      : [[model.optimum, model.maxVolume, '#dd862b'], [cursor, model.volume, '#2365ae']];
    root.querySelector('.box-plot').innerHTML = chart([{ color: '#2464ad', points: Array.from({ length: 101 }, (_, i) => {
      const value = i * maxRadius / 100;
      return [value, model.volumeAt(value)];
    }) }], { xmax: maxRadius, ymax: model.maxVolume * 1.15, label: shape === 'box' ? 'x (cm) → 부피 V (cm³)' : '반지름 r (cm) → 부피 V (cm³)', cursor, markers });
    root.querySelector('.shape-title').textContent = SHAPES[shape].title;
    root.querySelector('.shape-copy').textContent = SHAPES[shape].copy;
    root.querySelector('.shape-note').textContent = SHAPES[shape].note;
    equation(root.querySelector('.mvp-equation'), SHAPES[shape].equation);
    root.querySelectorAll('[data-shape]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.shape === shape)));
    cameraUpdate();
    updateUI();
  }

  function updateUI() {
    const optimalButton = root.querySelector('[data-optimal]');
    optimalButton.disabled = model.optimum === null;
    optimalButton.textContent = model.optimum === null ? '최적화 없음' : '최적값 찾기';
    const rows = shape === 'box'
      ? [['밑면 × 높이', `${fmt(model.width)} × ${fmt(model.depth)} × ${fmt(model.height)} cm`], ['현재 부피', `${fmt(model.volume / 1000, 3)} L`], ['종이 면적 (밑면+네 옆면)', `${fmt(model.width * model.depth + 2 * x * (model.width + model.depth))} cm²`], ['현재 V′(x)', `${fmt(model.derivative)} cm²`], ['최적 높이', `${fmt(model.optimum)} cm`], ['최대 용량 대비', `${fmt(model.volume / model.maxVolume * 100, 1)}%`]]
      : shape === 'sphere'
        ? [['반지름', `${fmt(model.radius)} cm`], ['현재 부피', `${fmt(model.volume, 1)} cm³`], ['현재 V′(r)', `${fmt(model.derivative, 1)} cm²`], ['V′(r)의 의미', '구의 표면적'], ['최대 반지름', `${fmt(model.maxRadius)} cm`], ['미분 관계', '부피 → 표면적']]
        : [['반지름', `${fmt(model.radius)} cm`], ['높이', `${fmt(model.height)} cm`], ['현재 부피', `${fmt(model.volume, 1)} cm³`], ['현재 V′(r)', `${fmt(model.derivative, 1)} cm²`], ['최적 반지름', `${fmt(model.optimum)} cm`], ['최대 부피', `${fmt(model.maxVolume, 1)} cm³`]];
    const fill = fillState(model, amount);
    rows.push(['현재 물', `${fmt(amount, 1)} cm³`], ['수면 높이 h', `${fmt(fill.height)} cm`], ['수면 단면적 A(h)', `${fmt(fill.area)} cm²`], ['현재 상승 속도 dh/dt', !pouring || amount >= model.volume ? '0 cm/s' : Number.isFinite(fill.speed) ? `${fmt(fill.speed)} cm/s` : '시작점: 단면적 0']);
    root.querySelector('.mvp-metrics').innerHTML = metrics(rows);
    root.querySelector('.mvp-status').textContent = spill > 0 ? '가득 찼습니다. 물이 넘칩니다.' : pouring ? '채우는 중이에요…' : amount > 0 ? '채우기를 누르면 이어서 채울 수 있어요.' : '도형에 물을 채워 부피를 확인하세요.';
    root.querySelector('[data-pour]').textContent = pouring ? '채우기 멈추기' : '채우기';
  }

  const input = () => {
    if (shape === 'box') {
      surface = +root.querySelector('#box-area').value;
      ratio = +root.querySelector('#box-ratio').value;
      const slider = root.querySelector('#box-x');
      x = clamp(+slider.value, .25, +slider.max);
    } else {
      radius = +root.querySelector('#solid-radius').value;
    }
    refresh();
  };
  const click = (event) => {
    const selected = event.target.closest('[data-shape]');
    if (selected) {
      shape = selected.dataset.shape;
      amount = 0;
      pouring = false;
      radius = shape === 'cylinder' ? 4.6 : shape === 'cone' ? 8 : 5;
      renderControls();
      refresh();
      return;
    }
    if (event.target.closest('[data-pour]')) { pouring = !pouring; spill = 0; }
    if (event.target.closest('[data-empty]')) { amount = 0; pouring = false; spill = 0; }
    if (event.target.closest('[data-optimal]') && model.optimum !== null) { radius = shape === 'box' ? radius : model.optimum; if (shape === 'box') x = model.optimum; refresh(); }
    updateUI();
  };
  const down = (event) => { drag = { x: event.clientX, y: event.clientY }; renderer.domElement.setPointerCapture(event.pointerId); };
  const move = (event) => { if (!drag) return; yaw -= (event.clientX - drag.x) * .008; pitch = clamp(pitch + (event.clientY - drag.y) * .008, .2, 1.25); drag = { x: event.clientX, y: event.clientY }; cameraUpdate(); };
  const up = () => { drag = null; };
  renderer.domElement.addEventListener('pointerdown', down);
  renderer.domElement.addEventListener('pointermove', move);
  renderer.domElement.addEventListener('pointerup', up);
  renderer.domElement.addEventListener('pointercancel', up);
  root.addEventListener('input', input);
  root.addEventListener('click', click);
  const resize = new ResizeObserver(() => { const w = stage.clientWidth; const h = stage.clientHeight; if (w && h) { renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); } });
  resize.observe(stage);
  refresh();

  function animate(now) {
    const dt = Math.min((now - last) / 1000, .05);
    last = now;
    if (pouring) { amount = Math.min(model.volume, amount + 120 * dt); if (amount >= model.volume) spill += dt; if (spill > 1.8) pouring = false; }
    updateWater();
    if (now - lastUI > 100) { updateUI(); lastUI = now; }
    renderer.render(scene, camera);
    frame = requestAnimationFrame(animate);
  }
  frame = requestAnimationFrame(animate);
  return () => {
    cancelAnimationFrame(frame);
    resize.disconnect();
    root.removeEventListener('input', input);
    root.removeEventListener('click', click);
    for (const [event, fn] of [['pointerdown', down], ['pointermove', move], ['pointerup', up], ['pointercancel', up]]) renderer.domElement.removeEventListener(event, fn);
    shapeGroup.traverse((object) => object.geometry?.dispose());
    shapeMaterial.dispose(); baseMaterial.dispose(); waterMaterial.dispose(); surfaceMaterial.dispose(); streamMaterial.dispose();
    grid.geometry.dispose(); grid.material.dispose(); renderer.dispose(); renderer.forceContextLoss();
  };
}

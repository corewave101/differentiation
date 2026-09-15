const demos = [
  ['box', '01 · 3D 상자와 물'],
  ['bat', '02 · 배트 스윙'],
  ['touch', '03 · 터치스크린'],
];
const loaders = {
  box: () => import('./applications/box.js'),
  bat: () => import('./applications/bat.js'),
  touch: () => import('./applications/touch.js'),
};

export function mountApplications(root) {
  let dispose = null;
  let version = 0;
  root.innerHTML = `<section class="mvp-apps"><nav class="mvp-tabs" aria-label="실생활 MVP 선택">${demos.map(([id,title]) => `<button type="button" data-demo="${id}">${title}</button>`).join('')}</nav><div class="mvp-content"></div></section>`;
  const content = root.querySelector('.mvp-content');
  async function select(id) {
    const current = ++version;
    dispose?.();
    dispose = null;
    root.querySelectorAll('[data-demo]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.demo === id)));
    content.textContent = '시뮬레이션을 준비하고 있어요…';
    try {
      const module = await loaders[id]();
      if (current !== version) return;
      dispose = module.mount(content);
    } catch (error) {
      if (current !== version) return;
      content.textContent = '이 시뮬레이션을 시작하지 못했습니다. 페이지를 새로고침하거나 다른 탭을 선택해 다시 시도해 주세요.';
      console.error(error);
    }
  }
  const click = event => {
    const button = event.target.closest('[data-demo]');
    if (button) select(button.dataset.demo);
  };
  root.addEventListener('click', click);
  select('box');
  return () => {
    ++version;
    dispose?.();
    root.removeEventListener('click', click);
  };
}

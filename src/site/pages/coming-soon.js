/** A registry game without a mount yet. Shown automatically until its module lands. */
import { playable } from '../registry.js';
import { escape } from '../ui/dom.js';
import { icon } from '../ui/icons.js';

export function render(main, { game }) {
  const ready = playable();
  main.innerHTML = `<section class="soon wrap">
    <div class="soon-copy">
      <nav class="crumbs" aria-label="导航路径"><a href="/#collection">游戏</a><span aria-hidden="true">/</span><span aria-current="page">${escape(game.title)}</span></nav>
      <p class="eyebrow">${escape(game.statusLabel)}</p>
      <h1>${escape(game.title)}<em>.</em></h1>
      <p class="lede">${escape(game.intro || game.tagline)}</p>
      <p>这款游戏还在制作中。</p>
      ${ready.length ? `<p class="soon-meanwhile">可以先玩：${ready.map((other) => `<a class="text-link" href="${other.path}">${escape(other.title)} ${icon('arrow', { size: 12 })}</a>`).join(' ')}</p>` : ''}
    </div>
    <div class="soon-art" data-mini="${game.id}" aria-hidden="true"></div>
  </section>`;
  import('../minis.js').then(({ drawMini }) => {
    const art = main.querySelector('.soon-art');
    if (art) art.innerHTML = drawMini(game.id);
  }).catch(() => {});
}

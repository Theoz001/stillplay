/** /secrets and /secrets/<slug>. The articles and their demos live in src/secrets.js. */
import { secrets, renderSecret } from '../../secrets.js';
import { showToast } from '../ui/toast.js';
import { secretCard } from './home.js';

export function render(main, { slug }) {
  if (!slug) {
    main.innerHTML = `<section class="secrets-index wrap"><p class="eyebrow">游戏掌故</p><h1>小游戏<br><em>掌故</em></h1><p class="lede">这里用游戏本身的程序演示经典规则、牌局编号和一些容易忽略的细节。</p><div class="secrets-grid">${secrets.map(secretCard).join('')}</div></section>`;
    return null;
  }
  const secret = secrets.find((item) => item.slug === slug);
  document.title = secret ? `${secret.title.replace(/\.$/, '')} · Stillplay` : "掌故尚未收录 · Stillplay";
  let cleanup = null;
  let gone = false;
  renderSecret(slug, main, { showToast }).then((dispose) => {
    if (gone) dispose?.();
    else cleanup = dispose;
  }).catch((error) => console.error(error));
  return () => { gone = true; cleanup?.(); };
}

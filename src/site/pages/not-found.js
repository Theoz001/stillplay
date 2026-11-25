/** Unknown paths. */
import { icon } from '../ui/icons.js';

export function render(main) {
  main.innerHTML = `<article class="article"><p class="eyebrow">未找到页面</p><h1>这里没有内容。</h1><p class="lede">可以返回游戏列表继续玩。</p><p><a class="text-link" href="/">${icon('arrow', { size: 12 })}返回游戏</a></p></article>`;
}

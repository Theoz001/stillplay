/** /about: why this exists, how it is made, and where your data lives. */
import { playable, siteGames } from '../registry.js';
import { escape } from '../ui/dom.js';

function list(titles) {
  if (titles.length <= 1) return titles.join('');
  return `${titles.slice(0, -1).join(', ')}和${titles.at(-1)}`;
}

export function render(main) {
  const ready = playable().map((game) => game.title);
  const coming = siteGames().length - ready.length;
  main.innerHTML = `<article class="article">
    <p class="eyebrow">关于 Stillplay</p>
    <h1>值得珍藏的<br><em>经典游戏</em></h1>
    <p class="lede">一片雷区，一桌纸牌，重温熟悉的小游戏。</p>
    <p>Stillplay 是对 Windows XP 自带小游戏的致敬。当年，许多人正是玩这些游戏学会了用鼠标。现在可以在这台 Mac 上重玩${escape(list(ready))}。${coming ? ` ${coming === 1 ? 'One more follows' : 'The rest follow'} once ${coming === 1 ? 'it plays' : 'each plays'} well.` : ''}</p>

    <h2>每日挑战</h2>
    <p>每款游戏根据日期生成当天的牌局或雷区，所有玩家拿到的题目相同。连续通关可以累积连胜天数。获胜后可以分享用时或回放。</p>

    <h2>游戏如何制作</h2>
    <p>原作者用 C 编写规则并编译为 WebAssembly。牌面、方格、图标与音效均由项目自行制作。</p>
    <p>“像素牌面”还原早年的低分辨率画面；“清晰牌面”使用相同图案，适合高分辨率屏幕。</p>

    <h2>本机离线游玩</h2>
    <p>无账号、无广告。游戏、中文界面和音效随应用一起安装，统计和设置保存在这台 Mac 上。</p>

    <h2>开源项目</h2>
    <p>Stillplay 采用 MIT 许可证，字体沿用各自的许可。源码见 <a href="https://github.com/btahir/stillplay">GitHub</a>，原站托管于 <a href="https://shiptiffin.com/?ref=stillplay">ShipTiffin</a>.</p>
    <p class="source-note">这是独立爱好者项目，与微软无隶属关系。文中的产品名称用于说明游戏渊源。</p>
  </article>`;
}

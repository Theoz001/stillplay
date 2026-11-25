// Game cores load only when a secret's live demo needs them.

// All illustrations are our own SVG, drawn for Stillplay.
const svg = (body) => `<svg viewBox="0 0 240 150" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;
const tile = (x, y, number = '') => `<g transform="translate(${x} ${y})"><path fill="#c9ccc3" d="M0 0h24v24H0z"/><path stroke="#f9faf2" stroke-width="2" d="M1 23V1h22"/><path stroke="#858d7f" stroke-width="2" d="M1 23h22V1"/>${number ? `<text x="12" y="17" text-anchor="middle" font-size="16" font-family="monospace" font-weight="bold" fill="#3b6187">${number}</text>` : ''}</g>`;
const firstArt = svg(`<g transform="translate(44 20)">${Array.from({ length: 20 }, (_, i) => tile((i % 5) * 26, Math.floor(i / 5) * 26, [2, 7, 11].includes(i) ? '1' : '')).join('')}<circle cx="64" cy="64" r="5" fill="#354c39"/><path d="M64 64V18H116" stroke="#2c6249" stroke-width="2" stroke-dasharray="3 3"/><path d="m110 12 7 6-7 6" stroke="#2c6249" stroke-width="2"/><rect x="53" y="53" width="22" height="22" stroke="#2c6249" stroke-width="2"/></g>`);
const xyzzyArt = svg(`<path d="M36 37h169v79H36z" stroke="#adb5a5"/><path d="M36 37h169v12H36z" fill="#7e8d7c"/><rect x="40" y="41" width="3" height="3" fill="#f8f9f2"/>${[...'XYZZY'].map((letter, i) => `<g transform="translate(${49 + i * 29} 66)"><rect width="25" height="31" rx="2" fill="#d4d7cc" stroke="#9aa490"/><path d="M3 27h19" stroke="#a4ad9c"/><text x="12.5" y="20" text-anchor="middle" fill="#354c39" font-family="monospace" font-size="17">${letter}</text></g>`).join('')}<path d="M69 123h106" stroke="#a4ad9c"/><rect x="159" y="109" width="5" height="5" fill="#2c6249"/>`);
const hardArt = svg(`<g transform="translate(57 29) rotate(-12 28 42)"><rect width="57" height="85" fill="#e1e4d8" stroke="#a9b39e"/><text x="8" y="20" fill="#5a6e54" font-family="Georgia" font-size="17">A</text></g><g transform="translate(89 23)"><rect width="57" height="85" fill="#f9faf2" stroke="#a9b39e"/><path d="m29 32 9 13-9 13-9-13z" fill="#9b5c49"/><text x="8" y="20" fill="#9b5c49" font-family="Georgia" font-size="17">Q</text></g><g transform="translate(123 29) rotate(12 28 42)"><rect width="57" height="85" fill="#e1e4d8" stroke="#a9b39e"/><text x="8" y="20" fill="#5a6e54" font-family="Georgia" font-size="17">K</text></g><path d="M55 122h130" stroke="#adb5a5"/><text x="120" y="141" text-anchor="middle" fill="#64765e" letter-spacing="3" font-family="monospace" font-size="12">11982</text>`);
const numberArt = svg(`<text x="35" y="64" fill="#2c6249" font-family="Georgia" font-size="39">1</text><path d="M62 55h26m-6-5 6 5-6 5" stroke="#8e9b83"/><g transform="translate(99 27)"><rect x="7" y="-5" width="47" height="70" fill="#d7ddce" stroke="#a2ad98"/><rect x="3" y="-2" width="47" height="70" fill="#e4e8dd" stroke="#a2ad98"/><rect width="47" height="70" fill="#f9faf2" stroke="#a2ad98"/><text x="23.5" y="42" text-anchor="middle" fill="#64765e" font-family="Georgia" font-size="24">52</text></g><path d="M163 55h26m-6-5 6 5-6 5" stroke="#8e9b83"/><g fill="#879c7b">${Array.from({ length: 8 }, (_, i) => `<rect x="${53 + i * 17}" y="111" width="11" height="19"/>`).join('')}</g><text x="203" y="65" fill="#2c6249" font-family="Georgia" font-size="39">8</text>`);

export const secrets = [
  { slug: 'first-click', number: '01', title: "第一次点击为什么安全？",
    description: "看看扫雷如何移走第一颗地雷。", art: firstArt },
  { slug: 'xyzzy', number: '02', title: "五个字母，一处彩蛋",
    description: "XYZZY 的来历，以及那个泄露地雷位置的像素点。", art: xyzzyArt },
  { slug: 'deal-11982', number: '03', title: "空当接龙第 11982 局之谜",
    description: "一个被玩家讨论多年的牌局编号。", art: hardArt },
  { slug: 'deal-numbers', number: '04', title: "一个编号如何记住整副牌？",
    description: "可重复的洗牌过程，让玩家能分享同一局。", art: numberArt },
];

const linkBack = "<p style=\"margin-top:42px\"><a class=\"text-link\" href=\"/secrets\">返回游戏掌故 <svg viewBox=\"0 0 16 16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.2\" width=\"12\" height=\"12\" aria-hidden=\"true\"><path d=\"M3 13 13 3M4 3h9v9\"/></svg></a></p>";

const articles = {
  'first-click': `
    <p class="lede">在本版扫雷中，即使第一次恰好点到地雷，这一格也会变安全。</p>
    <p>第一次点击前，程序已经根据一个种子排好 81 格和 10 颗地雷。如果第一次点中地雷，程序会按行寻找第一个没有地雷的位置，将它移过去，再重新计算相邻数字。</p>
    <p>首次点击保证安全，但不保证一定会展开空白区域，也不保证之后每一步都能靠推理得出。</p>
    <h2>试试移走地雷</h2>
    <p>这张示意图显示全部地雷。描边的格子起初有雷，点击按钮即可查看游戏引擎如何处理第一次点击。</p>
    <div class="demo" data-first-demo>
      <form data-seed-form style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:center">
        <label for="inspection-seed">雷区种子</label>
        <input id="inspection-seed" name="seed" type="number" min="0" max="4294967295" step="1" value="1" required style="width:130px;padding:9px;border:1px solid var(--line);background:var(--white);color:var(--ink)">
        <button type="submit">载入种子</button>
      </form>
      <div data-board-diagram style="width:252px;max-width:100%"></div>
      <p data-click-result aria-live="polite" style="text-align:center;max-width:440px"></p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center"><button data-first-reveal>翻开标记的方格</button><button data-first-reset>重置演示</button></div>
      <p>示意图 · 显示全部地雷 · 使用实际游戏引擎</p>
    </div>
    <h2>两格发生变化，地雷总数仍是十颗。</h2>
    <p>The clicked cell loses its mine; another cell gains one. The total stays the same. This policy is deterministic, so a replay records the original seed and the click, rather than saving a second board.</p>
    <pre><code>// Excerpt from our cores/minesweeper.c
cells[index] &amp;= ~MINE;
for (int target = 0; target &lt; board_width * board_height; ++target) {
    if (target != index &amp;&amp; !(cells[target] &amp; MINE)) {
        cells[target] |= MINE;
        break;
    }
}
count_neighbors();</code></pre>
    <p class="source-note">源码：见 <code>ms_reveal</code> 函数，位于 <code>cores/minesweeper.c</code>. We test first-click safety, mine totals and neighbor counts across 3,000 seeds.</p>`,
  xyzzy: `
    <p class="lede">早年的一个隐藏提示，只有屏幕角落的一个像素。</p>
    <div class="notice">这是旧版攻略里记载的彩蛋。Stillplay 的扫雷不含 XYZZY 秘技。</div>
    <p>早期扫雷攻略记载，输入 <code>XYZZY</code>并按后续组合键，就能在角落看到黑白提示点。各版本攻略对具体按键和适用版本说法不一。</p>
    <p>这个彩蛋的原理很简单：一串普通按键可以改变程序内部的隐藏状态。</p>
    <h2>试试这串按键</h2>
    <p>在下方输入 <code>XYZZY</code> 或点击五个字母键。输入正确后，可以切换示例方格，查看放大的提示点。</p>
    <div class="demo" data-latch-demo>
      <p style="font-size:9px;letter-spacing:1.4px;text-transform:uppercase">原理演示 · 独立于实际游戏</p>
      <label for="latch-input">输入五个字母</label>
      <input id="latch-input" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="64" placeholder="在这里输入" style="width:200px;padding:12px;border:1px solid var(--line);background:var(--white);color:var(--ink);text-align:center;letter-spacing:5px">
      <div style="display:flex;gap:7px">${[...'XYZZY'].map((letter) => `<button data-latch-key="${letter}" aria-label="输入 ${letter}" style="min-width:37px;padding:10px">${letter}</button>`).join('')}</div>
      <div style="display:flex;gap:18px;align-items:center;padding:18px 0">
        <div data-latch-pixel aria-hidden="true" style="height:38px;width:38px;background:#bbc3b1;border:1px solid #809174"></div>
        <p data-latch-state role="status">等待输入五个字母。</p>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center"><button data-sample-cell disabled>示例方格：安全</button><button data-latch-reset>重置输入</button></div>
      <p>提示点已放大，只对应这里的示例方格。</p>
    </div>
    <h2>为什么大家还记得这个彩蛋？</h2>
    <p>旧攻略对按键、位置和版本的说法各不相同。但能用一串奇怪的字母找到一个藏在眼前的像素，正是这个故事流传的原因。</p>
    <p class="source-note">相关资料： <a href="https://www.digitpress.com/eastereggs/pcminesweeper.htm" target="_blank" rel="noopener noreferrer">Digital Press 的扫雷彩蛋记录</a> 以及 <a href="https://gamefaqs.gamespot.com/pc/562694-minesweeper/faqs/26661" target="_blank" rel="noopener noreferrer">2003 年的扫雷常见问题</a>.</p>`,
  'deal-11982': `
    <p class="lede">牌局编号原本是为了重玩同一局，第 11982 局却成了玩家一直讨论的例外。</p>
    <div class="notice">该结论来自空当接龙玩家社区，本项目没有对它进行穷尽求解。</div>
    <div class="demo" style="padding-top:45px;padding-bottom:45px">
      <div style="font-family:Georgia,serif;font-size:clamp(60px,15vw,100px);letter-spacing:-4px;color:var(--green);line-height:1">11982</div>
      <p style="letter-spacing:2px;text-transform:uppercase;font-size:9px">一个编号，一场长久的讨论</p>
    </div>
    <h2>唯独剩下的那一局</h2>
    <p>Michael Keller 编写的 <a href="https://www.solitairelaboratory.com/fcfaq.html" target="_blank" rel="noopener noreferrer">《空当接龙常见问题》</a> 记录了玩家求解最初 32,000 局的过程。经过人工和计算机搜索，他们把第 11982 局认定为标准规则下唯一无解的一局。</p>
    <p>That is a documented historical result. Showing the number in our interface does not repeat the search behind it; that took solvers, spare machines and a lot of patience.</p>
    <h2>规则为什么重要？</h2>
    <p>四个空当、八列牌、红黑交替。改变可用空位或接牌规则，就会改变这个问题。某个求解结论只对应特定初始牌面和合法走法。</p>
    <p>本版可用撤销和提示探索这一局。提示指出合法的下一步，并不保证一定能走到终局。</p>
    <p><a class="text-link" href="/freecell?deal=11982">打开第 11982 局 <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" width="12" height="12" aria-hidden="true"><path d="M3 13 13 3M4 3h9v9"/></svg></a></p>
    <h2>值得记住的编号</h2>
    <p>两个人用同一编号得到相同的牌面，即使相隔多年、使用不同的电脑，也能比较各自的走法。</p>
    <p class="source-note">资料来源：Michael Keller， <a href="https://www.solitairelaboratory.com/fcfaq.html" target="_blank" rel="noopener noreferrer">《空当接龙常见问题》</a>中关于微软最初 32,000 局的章节。Stillplay 的游戏引擎和发牌代码由项目自行编写。</p>`,
  'deal-numbers': `
    <p class="lede">要分享一局牌，一个编号就够了。</p>
    <p>牌局编号充当随机种子。只要生成器、初始牌序和依次选牌的算法相同，最终的牌面就相同。</p>
    <h2>按编号发牌</h2>
    <p>这里显示实际空当接龙引擎发出的前八张牌，每列一张。第 1 局以方块 J、方块 2、红心 9 开头。</p>
    <div class="demo" data-deal-demo>
      <form data-deal-form style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:center">
        <label for="secret-deal">牌局编号</label>
        <input id="secret-deal" name="deal" type="number" min="1" max="2147483647" step="1" value="1" required style="width:130px;padding:9px;border:1px solid var(--line);background:var(--white);color:var(--ink)">
        <button type="submit">发牌</button>
      </form>
      <div data-deal-cards style="width:100%;max-width:580px"></div>
      <p data-deal-result role="status" style="text-align:center"></p>
      <a class="text-link" data-play-deal href="/freecell?deal=1">玩这一局 <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" width="12" height="12" aria-hidden="true"><path d="M3 13 13 3M4 3h9v9"/></svg></a>
    </div>
    <h2>发牌的原理</h2>
    <p>Our C core uses the documented 32-bit Microsoft CRT recurrence. The arithmetic wraps at 32 bits; the generator then takes 15 bits for each draw. This snippet comes from our implementation.</p>
    <pre><code>// Excerpt from our cores/freecell.c
random = random * 214013U + 2531011U;
int remaining = 52 - draw;
int selected = ((random &gt;&gt; 16) &amp; 0x7fffU) % remaining;
int original_id = deck[selected];
int card = (original_id % 4) * 13 + original_id / 4;
int column = draw % 8;</code></pre>
    <p>每选一张牌，剩余牌中的最后一张就补到它的位置。牌依次发到八列。初始牌序和这个补位步骤都决定最终的牌面。</p>
    <h2>如何验证可以重现？</h2>
    <p>浏览器和命令行工具使用同一份 WebAssembly 模块。输入同一编号可以得到同一牌面，项目也用已公布的牌例做过核对。</p>
    <p class="source-note">源码：见 <code>fc_new</code> in <code>cores/freecell.c</code>. Background: <a href="https://www.solitairelaboratory.com/fcfaq.html" target="_blank" rel="noopener noreferrer">Solitaire Laboratory 的编号发牌说明</a>.</p>`,
};

function boardSVG(state, target, moved = -1) {
  const size = 25;
  const body = state.cells.map((cell, index) => {
    const x = (index % state.width) * size;
    const y = Math.floor(index / state.width) * size;
    const marked = index === target || index === moved;
    return `<g transform="translate(${x} ${y})"><rect x="1" y="1" width="23" height="23" fill="${cell.revealed ? '#fffef9' : '#d2d7c9'}" stroke="${marked ? '#2c6249' : '#aab59f'}" stroke-width="${marked ? '2' : '.6'}"/>${cell.mine ? '<circle cx="12.5" cy="12.5" r="4" fill="#526b47"/>' : cell.revealed && cell.adjacent ? `<text x="12.5" y="18" text-anchor="middle" font-size="16" font-weight="bold" font-family="monospace" fill="#3b6187">${cell.adjacent}</text>` : ''}</g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${state.width * size} ${state.height * size}" width="100%" role="img" aria-label="种子 ${state.seed} 的示意图。十颗地雷均可见。描边格是${state.cells[target].revealed ? "已翻开的安全格" : "第一次点击前埋有地雷的格子"}。">${body}</svg>`;
}

const suitNames = ['clubs', 'diamonds', 'hearts', 'spades'];
const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const suitPaths = [
  '<circle cx="0" cy="-5" r="4"/><circle cx="-4" cy="1" r="4"/><circle cx="4" cy="1" r="4"/><path d="M-3 8 0 0 3 8z"/>',
  '<path d="m0-10 7 10-7 10-7-10z"/>',
  '<path d="M0 8C-13 0-9-10-3-7L0-4 3-7C9-10 13 0 0 8Z"/>',
  '<path d="M0-10C-4-6-10 0-6 4-3 7 0 2 0 2S3 7 6 4C10 0 4-6 0-10Z"/><path d="m-3 10 3-9 3 9z"/>',
];

function cardsSVG(cards, deal) {
  const labels = cards.map((id) => `${suitNames[Math.floor(id / 13)]}${ranks[id % 13]}`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 536 100" width="100%" role="img" aria-label="第 ${deal} 局，第一排：${labels.join(', ')}。">${cards.map((id, i) => {
    const suit = Math.floor(id / 13);
    const color = suit === 1 || suit === 2 ? '#a35746' : '#344c38';
    return `<g transform="translate(${i * 67 + 1} 3)"><rect width="61" height="86" rx="3" fill="#fffef9" stroke="#b1bba7"/><text x="8" y="22" fill="${color}" font-family="Georgia,serif" font-size="18">${ranks[id % 13]}</text><g transform="translate(31 49)" fill="${color}">${suitPaths[suit]}</g><text x="30" y="97" text-anchor="middle" fill="var(--muted)" font-family="sans-serif" font-size="8">${i + 1}</text></g>`;
  }).join('')}</svg>`;
}

export async function renderSecret(slug, container, { showToast = () => {} } = {}) {
  const secret = secrets.find((item) => item.slug === slug);
  if (!secret) {
    container.innerHTML = "<article class=\"article\"><p class=\"eyebrow\">游戏掌故</p><h1>暂无这篇掌故</h1><p>该页面尚未收录。</p><a class=\"text-link\" href=\"/secrets\">浏览其他掌故</a></article>";
    return () => {};
  }
  container.innerHTML = `<article class="article"><p class="eyebrow">游戏掌故 · ${secret.number}</p><h1>${secret.title}</h1>${articles[slug]}${linkBack}</article>`;
  const controller = new AbortController();
  const on = (element, type, listener) => element.addEventListener(type, listener, { signal: controller.signal });
  const find = (selector) => container.querySelector(selector);

  if (slug === 'first-click') {
    const { createMinesweeper } = await import('./minesweeper-core.js');
    const game = await createMinesweeper({ seed: 1 });
    let target;
    function reset() {
      const seed = Number(find('#inspection-seed').value);
      if (!Number.isInteger(seed) || seed < 0 || seed > 0xffff_ffff) {
        showToast("请输入 0 到 4294967295 之间的种子。");
        return;
      }
      const state = game.newGame({ level: 'beginner', seed });
      target = state.cells.findIndex((cell) => cell.mine);
      find('[data-board-diagram]').innerHTML = boardSVG(state, target);
      find('[data-click-result]').textContent = `点击前，第 ${target % state.width + 1} 列第 ${Math.floor(target / state.width) + 1} 行有一颗地雷。`;
      find('[data-first-reveal]').disabled = false;
    }
    on(find('[data-seed-form]'), 'submit', (event) => { event.preventDefault(); reset(); });
    on(find('[data-first-reset]'), 'click', reset);
    on(find('[data-first-reveal]'), 'click', () => {
      const before = game.state();
      const after = game.reveal(target % before.width, Math.floor(target / before.width));
      const moved = after.cells.findIndex((cell, index) => cell.mine && !before.cells[index].mine);
      find('[data-board-diagram]').innerHTML = boardSVG(after, target, moved);
      find('[data-click-result]').textContent = `现在安全了。地雷已移到第 ${moved % after.width + 1} 列第 ${Math.floor(moved / after.width) + 1} 行，雷区仍有 ${after.mines} 颗地雷。`;
      find('[data-first-reveal]').disabled = true;
    });
    reset();
  }

  if (slug === 'xyzzy') {
    const input = find('#latch-input');
    const sample = find('[data-sample-cell]');
    let enabled = false;
    let mine = false;
    function refresh() {
      find('[data-latch-pixel]').style.background = enabled ? mine ? '#20291e' : '#fffef9' : '#bbc3b1';
      find('[data-latch-state]').textContent = enabled ? `已触发。示例方格：${mine ? "地雷 · 黑色提示点" : "安全 · 白色提示点"}。` : `等待输入五个字母。${input.value.length ? `已输入 ${Math.min(input.value.length, 5)}。` : ''}`;
      sample.disabled = !enabled;
      sample.textContent = `示例方格：${mine ? 'mine' : 'safe'}`;
    }
    function check() {
      if (input.value.toUpperCase().endsWith('XYZZY')) enabled = true;
      refresh();
    }
    on(input, 'input', check);
    container.querySelectorAll('[data-latch-key]').forEach((button) => on(button, 'click', () => {
      input.value = (input.value + button.dataset.latchKey).slice(-64);
      check();
    }));
    on(sample, 'click', () => { mine = !mine; refresh(); });
    on(find('[data-latch-reset]'), 'click', () => { enabled = false; mine = false; input.value = ''; refresh(); });
    refresh();
  }

  if (slug === 'deal-numbers') {
    const { createFreecell } = await import('./freecell-core.js');
    const game = await createFreecell({ deal: 1 });
    function deal() {
      const number = Number(find('#secret-deal').value);
      if (!Number.isInteger(number) || number < 1 || number > 2147483647) {
        showToast("请输入 1 到 2147483647 之间的牌局编号。");
        return;
      }
      const state = game.newGame(number);
      find('[data-deal-cards]').innerHTML = cardsSVG(state.columns.map((column) => column[0]), number);
      find('[data-deal-result]').textContent = `第 ${number} 局 · 八列的第一排 · 牌局共 52 张`;
      find('[data-play-deal]').href = `/freecell?deal=${number}`;
    }
    on(find('[data-deal-form]'), 'submit', (event) => { event.preventDefault(); deal(); });
    deal();
  }

  return () => controller.abort();
}

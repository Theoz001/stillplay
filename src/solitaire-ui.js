import { createSolitaire, loadSolitaireReplay } from './solitaire-core.js';
import { createCardTable } from './card-table.js';
import { dailyDeal } from './shared.js';
import { cardName } from './cards.js';

const SETTINGS_KEY = 'stillplay-solitaire-options';
const BANK_KEY = 'stillplay-solitaire-bank';
const DEFAULTS = { draw: 1, scoring: 'standard', timed: true, cumulative: false, autoFlip: true, autoPlay: false };
const FOUNDATIONS = ['h0', 'h1', 'h2', 'h3'];
const COLUMNS = ['t0', 't1', 't2', 't3', 't4', 't5', 't6'];

const capital = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const plural = (count, word) => `${count} ${({card:'张牌',move:'步',run:'组',deal:'排',heart:'张红心',point:'分',hand:'手',选中的牌:'张选中的牌'})[word] || word}`;
const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
const money = (value) => `${value < 0 ? '−' : ''}$${Math.abs(value)}`;
const validDeal = (value) => Number.isInteger(value) && value >= 1 && value <= 2147483647;

function readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage is optional. */ }
}
function loadSettings() {
  const saved = readJSON(SETTINGS_KEY, {});
  const settings = { ...DEFAULTS };
  if (saved.draw === 1 || saved.draw === 3) settings.draw = saved.draw;
  if (['standard', 'vegas', 'none'].includes(saved.scoring)) settings.scoring = saved.scoring;
  for (const key of ['timed', 'cumulative', 'autoFlip', 'autoPlay']) if (typeof saved[key] === 'boolean') settings[key] = saved[key];
  return settings;
}
function randomDeal() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] % 1000000 + 1;
}

/** The keyboard and mouse sheet the site shows for this game (the shell reads it from the handle). */
const SHORTCUTS = [["点击或拖动", "移动一张牌"], ["双击或 Shift+回车", "将牌移入回收区"], ['D', "从牌库翻牌"], ['Ctrl / ⌘ + Z', "撤销"], ['H', "提示"], ['F', "所有牌翻开后自动收牌"], ["方向键 · 回车", "选牌、放牌"], ['F2', "重新发牌"], ['F1', "玩法说明"]];

function injectStyles() {
  if (document.querySelector('link[data-solitaire-styles]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./solitaire.css', import.meta.url).href;
  link.dataset.solitaireStyles = '';
  document.head.append(link);
}

const pileLabel = (id) => id === 's' ? "牌库" : id === 'w' ? "翻牌区" : id[0] === 'h' ? `第 ${Number(id[1]) + 1} 个回收区` : `第 ${Number(id[1]) + 1} 列`;

const ICONS = {
  window: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="2.5" width="12" height="17" rx="1.2" fill="#2c6249" stroke="#fff" stroke-width=".8"/><rect x="9" y="4.5" width="12" height="17" rx="1.2" fill="#fff" stroke="#142b64"/><path d="M15 9.2c-1.2-1.6-3.6-.4-2.6 1.6.6 1.1 2.6 2.6 2.6 2.6s2-1.5 2.6-2.6c1-2-1.4-3.2-2.6-1.6Z" fill="#b4232b"/></svg>',
  recycle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.5 12a6.5 6.5 0 1 1-2-4.7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M17.3 3.6v4.3H13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  done: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m7.6 16.4 8.8-8.8" stroke="currentColor" stroke-width="1.6"/></svg>',
};

function markup(daily, chrome) {
  const slot = (label, extra = '') => `<button type="button" class="sol-slot" data-ct-target aria-label="${label}">${extra}</button>`;
  return `<section class="sol-window" aria-label="经典接龙牌桌">
  <div class="sol-titlebar"><span class="sol-title-icon">${ICONS.window}</span><span class="sol-title">经典接龙</span><span class="sol-title-controls" aria-hidden="true"><i></i><i></i><i>×</i></span></div>
  <div class="sol-menubar">
    <div class="sol-menu-wrap"><button type="button" class="sol-menu-trigger" data-action="menu-game" aria-expanded="false" aria-haspopup="menu">游戏</button>
      <div class="sol-dropdown" role="menu" data-menu="game" hidden>
        <button role="menuitem" type="button" data-action="new">发牌 <span>F2</span></button>
        <button role="menuitem" type="button" data-action="deal">选择牌局…</button>
        <div class="sol-menu-separator" role="separator"></div>
        <button role="menuitem" type="button" data-action="undo">撤销 <span>Ctrl+Z</span></button>
        <button role="menuitem" type="button" data-action="hint">提示 <span>H</span></button>
        <button role="menuitem" type="button" data-action="finish">自动收牌 <span>F</span></button>
        <div class="sol-menu-separator" role="separator"></div>
        <button role="menuitem" type="button" data-action="options">选项…</button>
      </div></div>
    <div class="sol-menu-wrap"><button type="button" class="sol-menu-trigger" data-action="menu-help" aria-expanded="false" aria-haspopup="menu">帮助</button>
      <div class="sol-dropdown" role="menu" data-menu="help" hidden>
        <button role="menuitem" type="button" data-action="help">玩法说明 <span>F1</span></button>
        <button role="menuitem" type="button" data-action="about">关于此版本</button>
      </div></div>
    <span class="sol-menu-mode">${daily ? "每日牌局" : ''}</span>
  </div>
  <div class="sol-felt">
    <div class="sol-row sol-top">
      <div class="sol-pile sol-stock" data-pile-id="s">${slot("牌库已空", `<span class="sol-stock-icon">${ICONS.recycle}</span>`)}</div>
      <div class="sol-pile sol-waste" data-pile-id="w">${slot("翻牌区为空")}</div>
      <div class="sol-spacer" aria-hidden="true"></div>
      ${FOUNDATIONS.map((id, i) => `<div class="sol-pile sol-foundation" data-pile-id="${id}">${slot(`第 ${i + 1} 个回收区，空`, '<span class="sol-ace" aria-hidden="true">A</span>')}</div>`).join('')}
    </div>
    <div class="sol-row sol-tableau">
      ${COLUMNS.map((id, i) => `<div class="sol-pile sol-column" data-pile-id="${id}">${slot(`第 ${i + 1} 列为空，只能放 K。`)}</div>`).join('')}
    </div>
    <div class="sol-win" role="status" hidden></div>
  </div>
  <div class="sol-statusbar"><span class="sol-status-moves">0 步</span><span class="sol-status-score">得分：0</span><span class="sol-status-time">用时：0:00</span></div>
</section>
<div class="sol-below">
  <div class="sol-quick-actions">
    ${chrome ? '' : `<button type="button" data-action="undo">撤销</button><span aria-hidden="true">·</span>
    <button type="button" data-action="hint">提示</button><span aria-hidden="true">·</span>`}
    <button type="button" data-action="finish" class="sol-finish" hidden>自动收牌</button><span aria-hidden="true" class="sol-finish-dot" hidden>·</span>
    <button type="button" data-action="options">选项</button><span aria-hidden="true">·</span>
    <button type="button" data-action="deal">选择牌局</button>
  </div>
  <p class="sol-message" role="status" aria-live="polite"></p>
</div>
<dialog class="sol-dialog" data-dialog="deal" aria-labelledby="sol-deal-title"><form method="dialog" class="sol-dialog-form" data-form="deal">
  <h2 id="sol-deal-title">选择牌局</h2><p>相同的编号会生成同一局牌，朋友也能使用这个编号重玩。</p>
  <label for="sol-deal-input">牌局编号</label><input id="sol-deal-input" name="deal" type="number" min="1" max="2147483647" step="1" required>
  <p class="sol-dialog-error" data-deal-error aria-live="polite"></p>
  <div class="sol-dialog-actions"><button class="sol-classic-button" type="button" data-action="cancel-dialog">取消</button><button class="sol-classic-button sol-default-button" type="submit">发牌</button></div>
</form></dialog>
<dialog class="sol-dialog" data-dialog="options" aria-labelledby="sol-options-title"><form method="dialog" class="sol-dialog-form" data-form="options">
  <h2 id="sol-options-title">选项</h2>
  <div class="sol-option-groups">
    <fieldset><legend>翻牌方式</legend>
      <label><input type="radio" name="draw" value="1"> 翻一张</label>
      <label><input type="radio" name="draw" value="3"> 翻三张</label></fieldset>
    <fieldset><legend>计分方式</legend>
      <label><input type="radio" name="scoring" value="standard"> 标准</label>
      <label><input type="radio" name="scoring" value="vegas"> 拉斯维加斯</label>
      <label><input type="radio" name="scoring" value="none"> 不计分</label></fieldset>
  </div>
  <label class="sol-check"><input type="checkbox" name="timed"> 计时</label>
  <label class="sol-check"><input type="checkbox" name="cumulative"> 累计拉斯维加斯模式的得分</label>
  <label class="sol-check"><input type="checkbox" name="autoFlip"> 自动翻开露出的牌</label>
  <label class="sol-check"><input type="checkbox" name="autoPlay"> 自动收起不影响后续走法的牌</label>
  <p class="sol-dialog-note">更改翻牌或计分规则后，将使用当前编号重新发牌。</p>
  <div class="sol-dialog-actions"><button class="sol-classic-button" type="button" data-action="cancel-dialog">取消</button><button class="sol-classic-button sol-default-button" type="submit">确定</button></div>
</form></dialog>
<dialog class="sol-dialog" data-dialog="help" aria-labelledby="sol-help-title"><div class="sol-dialog-form">
  <h2 id="sol-help-title">经典接龙玩法</h2>
  <p>四种花色各有一个回收区，从 A 收到 K。牌列中按点数递减、红黑交替叠放。空列只能放 K 或以 K 开头的一组牌。</p>
  <p>可以拖动单张或整组牌，也可以先点牌，再点目标。双击可将牌移入回收区。点击牌库翻出新牌。</p>
  <p><strong>键盘操作</strong> 按 Tab 或方向键切换牌堆，回车或空格选牌、放牌，Shift+回车移入回收区，Esc 取消。 <strong>D</strong> 翻牌， <strong>H</strong> 显示提示， <strong>F</strong> 在牌全部翻开后自动收牌， <strong>F2</strong> 发牌， <strong>Ctrl+Z</strong> 撤销。</p>
  <div class="sol-dialog-actions"><button type="button" class="sol-classic-button sol-default-button" data-action="cancel-dialog">知道了</button></div>
</div></dialog>
<dialog class="sol-dialog" data-dialog="about" aria-labelledby="sol-about-title"><div class="sol-dialog-form">
  <h2 id="sol-about-title">关于经典接龙</h2>
  <p>本版沿用经典接龙的标准计分、拉斯维加斯计分和计时玩法。</p>
  <p>本项目自行绘制牌面、牌桌和通关动画。</p>
  <div class="sol-dialog-actions"><button type="button" class="sol-classic-button sol-default-button" data-action="cancel-dialog">关闭</button></div>
</div></dialog>`;
}

export async function mountSolitaire(container, { daily = false, onWin = () => {}, onStart = () => {}, sound = () => {}, chrome = false } = {}) {
  injectStyles();
  const params = new URLSearchParams(location.search);
  const settings = loadSettings();
  const requestedDraw = Number(params.get('draw'));
  if (!daily && (requestedDraw === 1 || requestedDraw === 3)) settings.draw = requestedDraw;
  const requestedDeal = Number(params.get('deal'));
  const firstDeal = daily ? dailyDeal() : validDeal(requestedDeal) ? requestedDeal : randomDeal();
  let engine = await createSolitaire({ seed: firstDeal, draw: settings.draw, scoring: settings.scoring, autoFlip: settings.autoFlip });

  let fidelity = 'crisp';
  let destroyed = false;
  let started = null;
  let finishedSeconds = null;
  let ticker = null;
  let wonReported = false;
  let openMenu = null;
  let running = null; // timer for finish/auto-play sequences
  let bankStart = settings.cumulative && settings.scoring === 'vegas' ? readJSON(BANK_KEY, 0) : 0;
  let message = daily ? "所有人今天使用同一局。" : "将各花色从 A 到 K 依次收齐。可以拖牌，也可以先点击牌，再点击目标位置。";

  const host = document.createElement('div');
  host.className = 'solitaire-root';
  host.dataset.fidelity = fidelity;
  host.innerHTML = markup(daily, chrome);
  container.replaceChildren(host);
  const $ = (selector) => host.querySelector(selector);
  const felt = $('.sol-felt');
  const messageEl = $('.sol-message');
  const winEl = $('.sol-win');

  function playSound(name) { try { sound(name); } catch { /* Sound is optional. */ } }
  function announce(text) { message = text; messageEl.textContent = text; }
  const elapsed = () => finishedSeconds ?? (started ? Math.floor((Date.now() - started) / 1000) : 0);

  const pileElement = (id) => host.querySelector(`[data-pile-id="${id}"]`);
  const table = createCardTable(felt, {
    cardClass: 'sol-card',
    piles: [
      { id: 's', element: pileElement('s'), row: 0, label: "牌库", depth: true },
      { id: 'w', element: pileElement('w'), row: 0, label: "翻牌区", fan: 'right', fanOffset: 0.2 },
      ...FOUNDATIONS.map((id) => ({ id, element: pileElement(id), row: 0, label: pileLabel(id) })),
      ...COLUMNS.map((id) => ({
        id, element: pileElement(id), row: 1, label: pileLabel(id), fan: 'down', compress: true,
        faceDownOffset: (height) => Math.max(4, height * 0.1), faceUpOffset: (height) => Math.max(12, height * 0.27),
      })),
    ],
    canPick(pile, index) {
      const state = engine.state();
      if (pile[0] === 't') return index >= state.hidden[Number(pile[1])];
      if (pile === 'w') return index === state.waste.length - 1;
      if (pile[0] === 'h') return index === state.foundations[Number(pile[1])].rank - 1;
      return false;
    },
    canDrop: (from, to) => engine.canMove(from.pile, to, from.count),
    drop: (from, to) => performMove(from.pile, to, from.count),
    activate(pile, index) {
      if (pile === 's') { turnStock(); return; }
      const state = engine.state();
      if (pile[0] === 't' && engine.state().tableau[Number(pile[1])].length && !state.autoFlip) {
        const column = Number(pile[1]);
        if (engine.flip(column)) { startClock(); after(); return; }
      }
      if (index < 0) announce(pile[0] === 't' ? "空列只能放 K 或以 K 开头的一组牌。" : pile[0] === 'h' ? "回收区从 A 开始。" : "翻牌区为空。请点击牌库翻牌。");
      else announce("这张牌尚未翻开。");
    },
    autoMove(pile, index) {
      const state = engine.state();
      const top = pile === 'w' ? state.waste.length - 1 : pile[0] === 't' ? state.tableau[Number(pile[1])].length - 1 : -2;
      if (index !== top) return false;
      const slot = FOUNDATIONS.find((id) => engine.canMove(pile, id, 1));
      return slot ? performMove(pile, slot, 1) : false;
    },
    cardLabel(card, faceUp, pile, index) {
      if (pile === 's') return stockLabel;
      if (!faceUp) return `盖住的牌，${pileLabel(pile)}`;
      return `${capital(cardName(card))}, ${pileLabel(pile)}${pile[0] === 't' ? `，第 ${index + 1} 张` : ''}`;
    },
    announce,
    sound: playSound,
    messages: {
      pick: (from) => {
        const card = cardAt(from.pile, from.index);
        return `已选中${capital(cardName(card))}${from.count > 1 ? ` 及其上的${plural(from.count - 1, 'card')}` : ''}，请选择目标位置。`;
      },
      cancel: () => "已取消选择。",
      illegal: (from, to) => to ? `${capital(cardName(cardAt(from.pile, from.index)))}不能放到${pileLabel(to)}上。` : "已放回原位。",
    },
  });

  function cardAt(pile, index) {
    const state = engine.state();
    if (pile === 'w') return state.waste[index];
    if (pile === 's') return state.stock[index];
    if (pile[0] === 'h') { const slot = state.foundations[Number(pile[1])]; return slot.suit * 13 + index; }
    return state.tableau[Number(pile[1])][index];
  }

  let stockLabel = '';
  function pileState(state) {
    // Worked out once per sync rather than once per stock card.
    stockLabel = `牌库还有${plural(state.stock.length, 'card')}，每次翻 ${state.draw} 张。`;
    const piles = {
      s: state.stock.map((card) => ({ card, faceUp: false })),
      w: { cards: state.waste, fan: Math.max(1, state.wasteFan) },
    };
    state.foundations.forEach((slot, i) => { piles[`h${i}`] = Array.from({ length: slot.rank }, (_, rank) => slot.suit * 13 + rank); });
    state.tableau.forEach((column, i) => { piles[`t${i}`] = column.map((card, row) => ({ card, faceUp: row >= state.hidden[i] })); });
    return piles;
  }
  function dealOrder(state) {
    const order = [];
    for (let row = 0; row < 7; row++) for (let column = row; column < 7; column++) order.push(state.tableau[column][row]);
    return order;
  }

  function score(state) {
    if (state.scoring === 'none') return null;
    if (state.scoring === 'vegas') return bankStart + state.score;
    return settings.timed ? engine.timedScore(elapsed()) : state.score;
  }
  // Writes only what changed, so the once-a-second clock never restyles the window.
  const setText = (el, text) => { if (el.textContent !== text) el.textContent = text; };
  let stockExhausted = null;
  function renderClock(state = engine.state()) {
    const value = score(state);
    const scoreEl = $('.sol-status-score');
    scoreEl.hidden = value === null;
    if (value !== null) setText(scoreEl, `得分：${state.scoring === 'vegas' ? money(value) : value.toLocaleString('en')}`);
    const timeEl = $('.sol-status-time');
    timeEl.hidden = !settings.timed;
    setText(timeEl, `用时：${clock(elapsed())}`);
  }
  function renderChrome(state = engine.state()) {
    if (destroyed) return;
    setText($('.sol-title'), `经典接龙 · 第 ${state.seed} 局`);
    setText($('.sol-menu-mode'), `${daily ? "每日挑战 · " : ''}每次翻 ${state.draw} 张 · ${({standard:'标准计分',vegas:'拉斯维加斯计分',none:'不计分'})[state.scoring]}`);
    for (const button of host.querySelectorAll('[data-action="undo"]')) button.disabled = state.moves === 0;
    for (const button of host.querySelectorAll('[data-action="finish"]')) button.disabled = !state.canAutoFinish;
    $('.sol-quick-actions .sol-finish').hidden = !state.canAutoFinish;
    $('.sol-finish-dot').hidden = !state.canAutoFinish;
    setText($('.sol-status-moves'), plural(state.moves, 'move'));
    renderClock(state);
    const stock = pileElement('s');
    const exhausted = !state.stock.length && !state.canRecycle;
    if (exhausted !== stockExhausted) {
      stockExhausted = exhausted;
      stock.classList.toggle('sol-stock-done', exhausted);
      stock.querySelector('.sol-stock-icon').innerHTML = exhausted ? ICONS.done : ICONS.recycle;
    }
    stock.querySelector('.sol-slot').setAttribute('aria-label', exhausted ? "本局不能再翻牌。" : state.waste.length ? "牌库已空，可将翻牌区翻回牌库。" : "牌库已空");
    if (state.scoring === 'vegas' && settings.cumulative) writeJSON(BANK_KEY, bankStart + state.score);
  }
  function update(animate = true) {
    const state = engine.state();
    renderChrome(state);
    return table.sync(pileState(state), { animate });
  }

  function startClock() {
    if (started || finishedSeconds !== null) return;
    started = Date.now();
    ticker = setInterval(() => { if (!destroyed) renderClock(); }, 1000);
  }
  function stopClock() {
    finishedSeconds = elapsed();
    clearInterval(ticker);
    ticker = null;
  }
  function resetClock() {
    clearInterval(ticker);
    ticker = null;
    started = null;
    finishedSeconds = null;
  }
  function stopRunning() { if (running) clearTimeout(running); running = null; }

  function performMove(from, to, count) {
    stopRunning();
    const before = engine.state();
    const length = from === 'w' ? before.waste.length : from[0] === 't' ? before.tableau[Number(from[1])].length : before.foundations[Number(from[1])].rank;
    const card = cardAt(from, length - count);
    if (!engine.move(from, to, count)) { playSound('invalid'); return false; }
    startClock();
    playSound(to[0] === 'h' ? 'foundation' : 'card-place');
    // Replace the "choose where it goes" prompt left by the first click of a double-click.
    announce(to[0] === 'h' ? `${capital(cardName(card))}已移入回收区。` : `${capital(cardName(card))}${count > 1 ? ` 及其上的${plural(count - 1, 'card')}` : ''}已移到${pileLabel(to)}。`);
    after();
    return true;
  }
  function turnStock() {
    stopRunning();
    const turned = engine.stock();
    if (!turned) {
      table.shake('s', -1);
      playSound('invalid');
      announce("本局的翻牌次数已用完。");
      return;
    }
    startClock();
    if (turned === 'recycle') {
      playSound('stock-recycle');
      const state = engine.state();
      announce(state.maxPasses ? `第 ${state.pass} 轮，共 ${state.maxPasses} 轮。` : "已将翻牌区翻回牌库。");
    }
    after();
  }
  function after() {
    const state = engine.state();
    const sync = update();
    if (state.status === 'won') { celebrate(sync); return; }
    if (state.canAutoFinish) announce("所有牌均已翻开。按 F 或选择“自动收牌”即可收齐。");
    if (settings.autoPlay) running = setTimeout(autoPlayStep, 170);
  }
  function autoPlayStep() {
    running = null;
    if (destroyed || !engine.autoMove()) return;
    playSound('foundation');
    after();
  }
  function finish() {
    stopRunning();
    if (!engine.state().canAutoFinish) { announce("自动收牌需要先翻开所有的牌。"); return; }
    startClock();
    announce("正在自动收牌…");
    const step = () => {
      running = null;
      if (destroyed) return;
      const done = engine.finishStep();
      if (!done) return;
      if (done === 'move') playSound('foundation');
      if (done === 'recycle') playSound('stock-recycle');
      const state = engine.state();
      if (state.status === 'won') { celebrate(update()); return; }
      if (table.reducedMotion) step();
      else { update(); running = setTimeout(step, done === 'move' ? 95 : 140); }
    };
    step();
  }
  async function celebrate(syncPromise) {
    if (wonReported) return;
    wonReported = true;
    stopClock();
    const state = engine.state();
    const seconds = finishedSeconds;
    const bonus = state.scoring === 'standard' && settings.timed ? engine.timeBonus(seconds) : 0;
    const final = score(state);
    renderChrome(state);
    playSound('win');
    announce("所有牌均已收齐。");
    await syncPromise;
    if (destroyed || engine.state().status !== 'won') return;
    await table.cascade({ piles: FOUNDATIONS });
    if (destroyed || engine.state().status !== 'won') return;
    const summary = {
      game: 'solitaire', seed: state.seed, deal: state.seed, daily, elapsedSeconds: seconds, moves: state.moves, score: final, bonus,
      draw: state.draw, scoring: state.scoring, variant: `每次翻 ${state.draw} 张`, params: { deal: state.seed, draw: state.draw },
    };
    announce(`你用了 ${plural(state.moves, 'move')} 赢得第 ${state.seed} 局。`);
    // In the site shell the win dialog is the one result screen.
    if (chrome) { onWin(summary); return; }
    const scoreLine = final === null ? '' : state.scoring === 'vegas' ? ` · ${money(final)}` : ` · ${final.toLocaleString('en')} 分`;
    winEl.innerHTML = `<span class="sol-win-kicker">${daily ? "已完成今日挑战。" : "所有牌均已收齐。"}</span><strong>你赢得了第 ${state.seed} 局。</strong><p>${plural(state.moves, 'move')} · ${clock(seconds)}${scoreLine}${bonus ? `<br>其中含时间奖励 ${bonus.toLocaleString('en')} 分。` : ''}</p><div class="sol-win-actions"><button type="button" class="sol-classic-button sol-default-button" data-action="new">再玩一局</button><button type="button" class="sol-text-button" data-action="same">重玩本局</button></div>`;
    winEl.hidden = false;
    winEl.querySelector('[data-action="new"]').focus({ preventScroll: true });
    onWin(summary);
  }

  async function newGame(deal = null, { keepDaily = false } = {}) {
    stopRunning();
    closeMenus();
    const seed = deal ?? (daily ? dailyDeal() : randomDeal());
    if (deal !== null && !keepDaily) daily = false;
    if (settings.scoring === 'vegas' && settings.cumulative) bankStart = readJSON(BANK_KEY, 0);
    else bankStart = 0;
    const state = engine.newGame(seed, { draw: settings.draw, scoring: settings.scoring, autoFlip: settings.autoFlip });
    resetClock();
    wonReported = false;
    winEl.hidden = true;
    announce(daily ? "所有人今天使用同一局。" : "已发新局。");
    renderChrome(state);
    onStart();
    playSound('card-shuffle');
    await table.deal(pileState(state), { from: 's', order: dealOrder(state), stagger: 26 });
  }
  /** Take back one move. Returns whether there was a move to take back. */
  function undo() {
    stopRunning();
    if (!engine.undo()) { announce("已回到本局开头。"); return false; }
    playSound('undo');
    if (wonReported) { wonReported = false; finishedSeconds = null; winEl.hidden = true; if (started) ticker = setInterval(() => { if (!destroyed) renderClock(); }, 1000); }
    announce("已撤销一步。");
    update();
    return true;
  }
  function hint() {
    const suggestion = engine.hint();
    const state = engine.state();
    if (!suggestion) { announce("暂无可提示的走法，可以撤销或开始新局。"); return false; }
    if (suggestion.action === 'draw' || suggestion.action === 'recycle') {
      table.showHint({ pile: 's', index: Math.max(0, state.stock.length - 1), count: 1 }, null);
      announce(suggestion.action === 'draw' ? "可以点击牌库翻牌。" : "可以将翻牌区翻回牌库。");
      return true;
    }
    if (suggestion.action === 'flip') {
      const id = `t${suggestion.column}`;
      table.showHint({ pile: id, index: state.tableau[suggestion.column].length - 1, count: 1 }, null);
      announce(`翻开${pileLabel(id)}的顶牌。`);
      return true;
    }
    const from = suggestion.from.type === 'waste' ? 'w' : `${suggestion.from.type[0] === 't' ? 't' : 'h'}${suggestion.from.index}`;
    const to = `${suggestion.to.type === 'tableau' ? 't' : 'h'}${suggestion.to.index}`;
    const length = from === 'w' ? state.waste.length : from[0] === 't' ? state.tableau[suggestion.from.index].length : state.foundations[suggestion.from.index].rank;
    const index = length - suggestion.count;
    table.showHint({ pile: from, index, count: suggestion.count }, to);
    announce(`可将${cardName(cardAt(from, index))}${suggestion.count > 1 ? " 及其上的牌" : ''}移到${to[0] === 'h' ? "回收区" : pileLabel(to)}。`);
    return true;
  }

  /* Menus, dialogs and keys. */
  function closeMenus() {
    openMenu = null;
    for (const menu of host.querySelectorAll('.sol-dropdown')) menu.hidden = true;
    for (const trigger of host.querySelectorAll('.sol-menu-trigger')) { trigger.setAttribute('aria-expanded', 'false'); trigger.classList.remove('sol-menu-active'); }
  }
  function toggleMenu(name) {
    const next = openMenu === name ? null : name;
    closeMenus();
    if (!next) return;
    openMenu = next;
    const trigger = host.querySelector(`[data-action="menu-${name}"]`);
    trigger.setAttribute('aria-expanded', 'true');
    trigger.classList.add('sol-menu-active');
    const menu = host.querySelector(`[data-menu="${name}"]`);
    menu.hidden = false;
    menu.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
  }
  function showDialog(name) {
    closeMenus();
    const dialog = host.querySelector(`[data-dialog="${name}"]`);
    if (name === 'deal') {
      dialog.querySelector('input').value = String(engine.state().seed);
      dialog.querySelector('[data-deal-error]').textContent = '';
    }
    if (name === 'options') {
      const form = dialog.querySelector('form');
      form.elements.draw.value = String(settings.draw);
      form.elements.scoring.value = settings.scoring;
      for (const key of ['timed', 'cumulative', 'autoFlip', 'autoPlay']) form.elements[key].checked = settings[key];
    }
    dialog.showModal();
    if (name === 'deal') { const input = dialog.querySelector('input'); input.focus(); input.select(); }
  }
  function action(name) {
    if (name === 'menu-game' || name === 'menu-help') { toggleMenu(name.slice(5)); return; }
    if (name === 'cancel-dialog') { host.querySelector('dialog[open]')?.close(); return; }
    closeMenus();
    if (name === 'new') newGame();
    else if (name === 'same') newGame(engine.state().seed, { keepDaily: true });
    else if (name === 'deal' || name === 'options' || name === 'help' || name === 'about') showDialog(name);
    else if (name === 'undo') undo();
    else if (name === 'hint') hint();
    else if (name === 'finish') finish();
  }
  function click(event) {
    const button = event.target.closest('[data-action]');
    if (button && host.contains(button)) { action(button.dataset.action); return; }
    if (openMenu && !event.target.closest('.sol-menu-wrap')) closeMenus();
  }
  function submit(event) {
    const form = event.target;
    if (form.dataset.form === 'deal') {
      event.preventDefault();
      const value = Number(form.elements.deal.value);
      if (!validDeal(value)) { form.querySelector('[data-deal-error]').textContent = "请输入 1 到 2,147,483,647 之间的整数。"; return; }
      form.closest('dialog').close();
      newGame(value);
    } else if (form.dataset.form === 'options') {
      event.preventDefault();
      const next = {
        draw: Number(form.elements.draw.value) === 3 ? 3 : 1,
        scoring: form.elements.scoring.value,
        timed: form.elements.timed.checked,
        cumulative: form.elements.cumulative.checked,
        autoFlip: form.elements.autoFlip.checked,
        autoPlay: form.elements.autoPlay.checked,
      };
      const redeal = next.draw !== settings.draw || next.scoring !== settings.scoring || next.autoFlip !== settings.autoFlip;
      if (!next.cumulative) writeJSON(BANK_KEY, 0);
      Object.assign(settings, next);
      writeJSON(SETTINGS_KEY, settings);
      form.closest('dialog').close();
      if (redeal) newGame(engine.state().seed, { keepDaily: true });
      else { bankStart = settings.cumulative && settings.scoring === 'vegas' ? bankStart : 0; renderChrome(); }
    }
  }
  function keydown(event) {
    if (destroyed || !host.isConnected || host.querySelector('dialog[open]') || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    if (openMenu && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      const items = [...host.querySelectorAll(`[data-menu="${openMenu}"] button:not(:disabled)`)];
      const at = items.indexOf(document.activeElement);
      items[(at + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
      return;
    }
    const key = event.key.toLowerCase();
    if (event.key === 'F2') { event.preventDefault(); newGame(); }
    else if (event.key === 'F1') { event.preventDefault(); showDialog('help'); }
    else if ((event.ctrlKey || event.metaKey) && !event.shiftKey && key === 'z') { event.preventDefault(); undo(); }
    else if (event.ctrlKey || event.metaKey || event.altKey) return;
    else if (key === 'h') { event.preventDefault(); hint(); }
    else if (key === 'f' && engine.state().canAutoFinish) { event.preventDefault(); finish(); }
    else if (key === 'd') { event.preventDefault(); turnStock(); }
    else if (event.key === 'Escape' && openMenu) { closeMenus(); }
  }
  host.addEventListener('click', click);
  host.addEventListener('submit', submit);
  document.addEventListener('keydown', keydown);

  renderChrome();
  onStart();
  const initial = engine.state();
  await table.deal(pileState(initial), { from: 's', order: dealOrder(initial), stagger: 26 }).catch(() => {});
  if (!destroyed) announce(message);

  return {
    destroy() {
      destroyed = true;
      stopRunning();
      clearInterval(ticker);
      document.removeEventListener('keydown', keydown);
      host.removeEventListener('click', click);
      host.removeEventListener('submit', submit);
      table.destroy();
      host.remove();
    },
    exportReplay() { return engine.replay(); },
    async loadReplay(replay) {
      stopRunning();
      engine = await loadSolitaireReplay(replay);
      const state = engine.state();
      Object.assign(settings, { draw: state.draw, scoring: state.scoring, autoFlip: state.autoFlip });
      daily = false;
      resetClock();
      wonReported = false;
      winEl.hidden = true;
      bankStart = 0;
      announce(chrome ? '' : "回放已载入，可以接着玩。");
      await update(false);
      if (state.status === 'won') celebrate(Promise.resolve());
    },
    newGame,
    undo,
    canUndo: () => engine.state().moves > 0,
    hint,
    state: () => engine.state(),
    shortcuts: SHORTCUTS,
    setFidelity(value) {
      fidelity = value === 'pixels' ? 'pixels' : 'crisp';
      host.dataset.fidelity = fidelity;
      table.relayout();
    },
    table,
  };
}

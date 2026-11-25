/**
 * Hearts: the table, the passing, the tricks and the score sheet.
 *
 * The rules and the three computer players live in the WASM core
 * (src/hearts-core.js). When you pass or play, the core has already played
 * every computer card up to your next decision; this file replays those cards
 * one at a time from the difference between the old and new state, so the
 * table always shows what happened, in order.
 *
 * Cards are drawn and moved by the shared card table (src/card-table.js).
 * Hearts asks different things of a hand than Solitaire asks of a pile, so the
 * hand's own input lives here: tap or Enter plays (or chooses a card to pass),
 * a card can be dragged up onto the table, and ←/→ walk along the hand.
 */
import { createHearts, loadHeartsReplay } from './hearts-core.js';
import { createCardTable } from './card-table.js';
import { dailyDeal } from './shared.js';
import { cardName, PATHS } from './cards.js';

const SETTINGS_KEY = 'stillplay-hearts-options';
const DEFAULTS = { difficulty: 1, speed: 'relaxed' };
const NAMES = ["你", "雷恩", "内尔", "埃斯梅"];
const OPPONENTS = [1, 2, 3];
const QUEEN = 50;
const TWO_OF_CLUBS = 1;
const HEARTS = 2;
const SUIT_WORDS = ['梅花', '方块', '红心', '黑桃'];
const SUIT_PLURALS = ['梅花', '方块', '红心', '黑桃'];
const DIRECTION_SEAT = { left: 1, across: 2, right: 3 };
/* Milliseconds for each beat of the computer turns. */
const PACES = {
  relaxed: { fly: 330, gap: 130, hold: 820, sweep: 430, pass: 480 },
  brisk: { fly: 190, gap: 45, hold: 460, sweep: 280, pass: 320 },
};
const STILL = { fly: 0, gap: 0, hold: 0, sweep: 0, pass: 0 };

const suitOf = (card) => Math.floor(card / 13);
const capital = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const plural = (count, word) => `${count} ${({card:'张牌',move:'步',run:'组',deal:'排',heart:'张红心',point:'分',hand:'手',选中的牌:'张选中的牌'})[word] || word}`;
const validDeal = (value) => Number.isInteger(value) && value >= 1 && value <= 2147483647;
const pointsOf = (card) => (card === QUEEN ? 13 : suitOf(card) === HEARTS ? 1 : 0);
const possessive = (seat) => (seat === 0 ? '你的' : `${NAMES[seat]}的`);
const listCards = (cards) => {
  const names = cards.map((card) => `${cardName(card)}`);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')}和${names.at(-1)}` : names[0] ?? '';
};
const ordinal = (n) => ['第一', '第二', '第三', '第四'][n] ?? `第 ${n + 1}`;

function readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage is optional. */ }
}
function loadSettings() {
  const saved = readJSON(SETTINGS_KEY, {});
  const settings = { ...DEFAULTS };
  if (saved.difficulty === 0 || saved.difficulty === 1) settings.difficulty = saved.difficulty;
  if (saved.speed in PACES) settings.speed = saved.speed;
  return settings;
}
function randomDeal() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] % 1000000 + 1;
}
function injectStyles() {
  if (document.querySelector('link[data-hearts-styles]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./hearts.css', import.meta.url).href;
  link.dataset.heartsStyles = '';
  document.head.append(link);
}
/** The table is measured from CSS, so wait for both stylesheets before the first layout. */
function stylesLoaded() {
  const links = [...document.querySelectorAll('link[data-hearts-styles], link[data-card-table-styles]')];
  return Promise.all(links.map((link) => (link.sheet ? null : new Promise((resolve) => {
    link.addEventListener('load', resolve, { once: true });
    link.addEventListener('error', resolve, { once: true });
    setTimeout(resolve, 4000);
  }))));
}

/** Every card played this hand, in order, with its trick number and position. */
function playsOf(state) {
  const plays = [];
  state.tricks.forEach((trick, t) => trick.plays.forEach((play, pos) => plays.push({ ...play, t, pos })));
  state.trick.forEach((play, pos) => plays.push({ ...play, t: state.tricks.length, pos }));
  return plays;
}

/** Plain words for why a card cannot be played, or null when it can. */
function illegalReason(card, state) {
  if (state.phase !== 'play') return "请先选三张牌传给对手。";
  if (state.turn !== 0) return "请等待你的回合。";
  if (state.legal.includes(card)) return null;
  const hand = state.cards;
  if (state.tricksPlayed === 0 && !state.trick.length) return "第一墩由梅花 2 先出。";
  if (state.trick.length) {
    const led = suitOf(state.trick[0].card);
    if (suitOf(card) !== led && hand.some((held) => suitOf(held) === led)) return `必须跟花色，请出一张${SUIT_WORDS[led]}。`;
  }
  if (state.tricksPlayed === 0) return "第一墩不能垫分。红心和黑桃 Q 请留到后面。";
  if (!state.trick.length && suitOf(card) === HEARTS && !state.heartsBroken) return "红心尚未破，暂时不能首引红心。";
  return "当前不能出这张牌。";
}

const heartGlyph = (cls = '') => `<svg class="hz-glyph ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${PATHS[2]}" fill="currentColor"/></svg>`;
const spadeGlyph = () => `<svg class="hz-glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="${PATHS[3]}" fill="currentColor"/></svg>`;
const ARROWS = {
  left: '<svg class="hz-arrow" viewBox="0 0 16 16" aria-hidden="true"><path d="M13 8H3.5M7.5 4 3.5 8l4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  right: '<svg class="hz-arrow" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9.5M8.5 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  across: '<svg class="hz-arrow" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13V3.5M4 7.5l4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
const MOON = '<svg class="hz-moon" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="none" stroke="currentColor" stroke-opacity=".18"/><path d="M40 10a22 22 0 1 0 14 34A18 18 0 0 1 40 10Z" fill="currentColor"/><circle cx="18" cy="18" r="1.2" fill="currentColor" opacity=".6"/><circle cx="50" cy="16" r=".9" fill="currentColor" opacity=".5"/><circle cx="12" cy="40" r=".8" fill="currentColor" opacity=".5"/></svg>';
const WINDOW_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="2.5" width="12" height="17" rx="1.2" fill="#2c6249" stroke="#fff" stroke-width=".8"/><rect x="9" y="4.5" width="12" height="17" rx="1.2" fill="#fff" stroke="#142b64"/><path d="M15 9.2c-1.2-1.6-3.6-.4-2.6 1.6.6 1.1 2.6 2.6 2.6 2.6s2-1.5 2.6-2.6c1-2-1.4-3.2-2.6-1.6Z" fill="#b4232b"/></svg>`;

function plate(seat) {
  return `<span class="hz-plate" data-seat="${seat}"><span class="hz-name">${NAMES[seat]}</span><span class="hz-total" title="得分">0</span><span class="hz-taken"></span></span>`;
}

function markup() {
  const pile = (id) => `<div class="hz-pile" data-pile-id="${id}"></div>`;
  return `<section class="hz-window" aria-label="红心大战牌桌">
  <div class="hz-titlebar"><span class="hz-title-icon">${WINDOW_ICON}</span><span class="hz-title">红心大战</span><span class="hz-title-controls" aria-hidden="true"><i></i><i></i><i>×</i></span></div>
  <div class="hz-menubar">
    <div class="hz-menu-wrap"><button type="button" class="hz-menu-trigger" data-action="menu-game" aria-expanded="false" aria-haspopup="menu">游戏</button>
      <div class="hz-dropdown" role="menu" data-menu="game" hidden>
        <button role="menuitem" type="button" data-action="new">新游戏 <span>F2</span></button>
        <button role="menuitem" type="button" data-action="deal">选择牌局…</button>
        <div class="hz-menu-separator" role="separator"></div>
        <button role="menuitem" type="button" data-action="hint">提示 <span>H</span></button>
        <button role="menuitem" type="button" data-action="scores">计分表 <span>T</span></button>
        <div class="hz-menu-separator" role="separator"></div>
        <button role="menuitem" type="button" data-action="options">选项…</button>
      </div></div>
    <div class="hz-menu-wrap"><button type="button" class="hz-menu-trigger" data-action="menu-help" aria-expanded="false" aria-haspopup="menu">帮助</button>
      <div class="hz-dropdown" role="menu" data-menu="help" hidden>
        <button role="menuitem" type="button" data-action="help">玩法说明 <span>F1</span></button>
        <button role="menuitem" type="button" data-action="about">关于此版本</button>
      </div></div>
    <span class="hz-menu-mode"></span>
  </div>
  <div class="hz-felt">
    <div class="hz-seat hz-seat-north" data-seat="2">${plate(2)}<div class="hz-fan">${pile('o2')}</div></div>
    <div class="hz-seat hz-seat-west" data-seat="1">${plate(1)}<div class="hz-fan">${pile('o1')}</div></div>
    <div class="hz-trick">
      ${pile('p2')}${pile('p1')}${pile('p3')}${pile('p0')}
      <div class="hz-pass" hidden>
        <p class="hz-pass-text"></p>
        <button type="button" class="hz-classic-button hz-pass-button" data-action="pass" disabled></button>
        <span class="hz-pass-count" aria-live="polite"></span>
      </div>
      <div class="hz-moment" aria-hidden="true" hidden></div>
    </div>
    <div class="hz-seat hz-seat-east" data-seat="3">${plate(3)}<div class="hz-fan">${pile('o3')}</div></div>
    <div class="hz-you" data-seat="0">${plate(0)}<span class="hz-prompt" aria-hidden="true"></span></div>
    <div class="hz-hand" role="group" aria-label="你的手牌">${pile('h0')}${pile('h1')}</div>
    <div class="hz-panel" role="status" hidden></div>
  </div>
  <div class="hz-statusbar"><span class="hz-status-hand">第 1 手</span><span class="hz-status-hearts"></span><span class="hz-status-score">你：0</span></div>
</section>
<div class="hz-below">
  <div class="hz-quick-actions">
    <button type="button" data-action="hint">提示</button><span aria-hidden="true">·</span>
    <button type="button" data-action="scores">计分表</button><span aria-hidden="true">·</span>
    <button type="button" data-action="options">选项</button><span aria-hidden="true">·</span>
    <button type="button" data-action="new">新游戏</button>
  </div>
  <p class="hz-message" role="status" aria-live="polite"></p>
</div>
<dialog class="hz-dialog" data-dialog="deal" aria-labelledby="hz-deal-title"><form method="dialog" class="hz-dialog-form" data-form="deal">
  <h2 id="hz-deal-title">选择牌局</h2><p>同一编号会生成相同的一系列牌局，可以将编号分享给朋友。</p>
  <label for="hz-deal-input">牌局编号</label><input id="hz-deal-input" name="deal" type="number" min="1" max="2147483647" step="1" required>
  <p class="hz-dialog-error" data-deal-error aria-live="polite"></p>
  <div class="hz-dialog-actions"><button class="hz-classic-button" type="button" data-action="cancel-dialog">取消</button><button class="hz-classic-button hz-default-button" type="submit">发牌</button></div>
</form></dialog>
<dialog class="hz-dialog" data-dialog="options" aria-labelledby="hz-options-title"><form method="dialog" class="hz-dialog-form" data-form="options">
  <h2 id="hz-options-title">选项</h2>
  <div class="hz-option-groups">
    <fieldset><legend>电脑对手的打法</legend>
      <label><input type="radio" name="difficulty" value="0"> 轻松</label>
      <label><input type="radio" name="difficulty" value="1"> 谨慎</label></fieldset>
    <fieldset><legend>出牌速度</legend>
      <label><input type="radio" name="speed" value="relaxed"> 舒缓</label>
      <label><input type="radio" name="speed" value="brisk"> 快速</label></fieldset>
  </div>
  <p class="hz-dialog-note">更改打法会重新开始本局。电脑出牌时点按牌桌可以加快速度。</p>
  <div class="hz-dialog-actions"><button class="hz-classic-button" type="button" data-action="cancel-dialog">取消</button><button class="hz-classic-button hz-default-button" type="submit">确定</button></div>
</form></dialog>
<dialog class="hz-dialog hz-scores-dialog" data-dialog="scores" aria-labelledby="hz-scores-title"><div class="hz-dialog-form">
  <h2 id="hz-scores-title">计分表</h2>
  <div class="hz-sheet"></div>
  <p class="hz-dialog-note">Running totals, with each hand’s points beneath. The game ends when someone reaches 100; the lowest total wins.</p>
  <div class="hz-dialog-actions"><button type="button" class="hz-classic-button hz-default-button" data-action="cancel-dialog">确定</button></div>
</div></dialog>
<dialog class="hz-dialog" data-dialog="help" aria-labelledby="hz-help-title"><div class="hz-dialog-form">
  <h2 id="hz-help-title">红心大战玩法</h2>
  <p>尽量少得分。每张红心计 1 分，黑桃 Q 计 13 分。有人达到 100 分时，得分最低者获胜。</p>
  <p>Before each hand, pass three cards: left, then right, then across, then keep your cards. The two of clubs leads. Follow the suit that was led if you can; the highest card of that suit takes the trick. No points on the first trick, and hearts can’t be led until one has been played.</p>
  <p>收齐所有红心和黑桃 Q，称为 <strong>全收</strong>：你得 0 分，其余每人得 26 分。</p>
  <p><strong>出牌</strong> 点击一张可出的牌，或向上拖到牌桌上。 <strong>键盘操作</strong> ←/→ choose a card, Enter plays it or picks it to pass; after the third card, focus moves to the Pass button. <strong>H</strong> 显示提示， <strong>T</strong> 打开计分表， <strong>F2</strong> 开始新局。红心大战不能撤销出牌。</p>
  <div class="hz-dialog-actions"><button type="button" class="hz-classic-button hz-default-button" data-action="cancel-dialog">知道了</button></div>
</div></dialog>
<dialog class="hz-dialog" data-dialog="about" aria-labelledby="hz-about-title"><div class="hz-dialog-form">
  <h2 id="hz-about-title">关于红心大战</h2>
  <p>本版在本机运行。三个电脑对手只能看到各自的手牌和已经打出的牌。</p>
  <p>牌面、牌桌与角色均由本项目制作。</p>
  <div class="hz-dialog-actions"><button type="button" class="hz-classic-button hz-default-button" data-action="cancel-dialog">关闭</button></div>
</div></dialog>`;
}

export async function mountHearts(container, { daily = false, onWin = () => {}, onStart = () => {}, onLose = () => {}, sound = () => {}, chrome = false } = {}) {
  injectStyles();
  const params = new URLSearchParams(location.search);
  const settings = loadSettings();
  const requestedDeal = Number(params.get('deal'));
  const firstDeal = daily ? dailyDeal() : validDeal(requestedDeal) ? requestedDeal : randomDeal();
  let engine = await createHearts({ seed: firstDeal, difficulty: settings.difficulty });

  let fidelity = 'crisp';
  let destroyed = false;
  let started = null;
  let finishedSeconds = null;
  let wonReported = false;
  let openMenu = null;
  let busy = false;
  let hurrying = false;
  let runToken = 0;
  let layout = null;
  let cursorCard = null;
  let drag = null;
  let hintTimer = 0;
  let receivedTimer = 0;
  const selected = new Set();
  const sleepers = new Set();
  /** What the table shows right now. It trails the core while cards are moving. */
  let view = null;
  /** The last thing that happened, said again with the prompt when your turn comes. */
  let lastEvent = '';

  const host = document.createElement('div');
  host.className = 'hearts-root';
  host.dataset.fidelity = fidelity;
  host.innerHTML = markup();
  // The site shell draws New game, Hint, Sound and Pixels around the window; only stand-alone pages need ours.
  if (chrome) host.querySelector('.hz-quick-actions').remove();
  container.replaceChildren(host);
  const $ = (selector) => host.querySelector(selector);
  const felt = $('.hz-felt');
  const handArea = $('.hz-hand');
  const messageEl = $('.hz-message');
  const promptEl = $('.hz-prompt');
  const panelEl = $('.hz-panel');
  const passEl = $('.hz-pass');
  const momentEl = $('.hz-moment');
  const pileEl = (id) => host.querySelector(`[data-pile-id="${id}"]`);
  const plateEl = (seat) => host.querySelector(`.hz-plate[data-seat="${seat}"]`);
  const seatEl = (seat) => (seat === 0 ? handArea : host.querySelector(`.hz-seat[data-seat="${seat}"] .hz-fan`));
  const isHandPile = (id) => id === 'h0' || id === 'h1';

  function playSound(name) { try { sound(name); } catch { /* Sound is optional. */ } }
  function notify(callback, ...args) { try { callback?.(...args); } catch (error) { console.error(error); } }
  function announce(text) { messageEl.textContent = text; }
  function prompt(text) { promptEl.textContent = text; }
  const elapsed = () => finishedSeconds ?? (started ? Math.floor((Date.now() - started) / 1000) : 0);
  function startClock() { if (!started && finishedSeconds === null) started = Date.now(); }

  /* ── the table ──────────────────────────────────────────────────────── */
  const table = createCardTable(felt, {
    cardClass: 'hz-card',
    piles: [
      { id: 'o2', element: pileEl('o2'), row: 0, label: "内尔的手牌", fan: 'right', fanOffset: () => layout?.oppX ?? 4 },
      { id: 'o1', element: pileEl('o1'), row: 0, label: "雷恩的手牌", fan: 'down', faceDownOffset: () => layout?.oppY ?? 3 },
      { id: 'o3', element: pileEl('o3'), row: 0, label: "埃斯梅的手牌", fan: 'down', faceDownOffset: () => layout?.oppY ?? 3 },
      ...[0, 1, 2, 3].map((seat) => ({ id: `p${seat}`, element: pileEl(`p${seat}`), row: 0, label: `${possessive(seat)}的牌` })),
      { id: 'h0', element: pileEl('h0'), row: 1, label: "你的手牌", fan: 'right', fanOffset: () => layout?.step ?? 20 },
      { id: 'h1', element: pileEl('h1'), row: 1, label: "你的手牌", fan: 'right', fanOffset: () => layout?.step ?? 20 },
    ],
    canPick: () => false,
    activate,
    autoMove: () => false,
    cardLabel(card, faceUp, pile) {
      if (pile[0] === 'o') return `${NAMES[Number(pile[1])]}手中的牌`;
      if (pile[0] === 'p') return `${Number(pile[1]) === 0 ? "你" : NAMES[Number(pile[1])]}打出了${cardName(card)}`;
      return capital(cardName(card));
    },
    announce,
    sound: playSound,
  });

  /* ── layout: card size comes from CSS; fans and the hand are placed here ── */
  function computeLayout() {
    const w = pileEl('p0').getBoundingClientRect().width || 60;
    const h = w * 1.4;
    const compact = felt.clientWidth < 520;
    const inner = handArea.clientWidth || felt.clientWidth;
    const n = view.hand.length;
    const maxStep = w * (compact ? 0.62 : 0.56);
    const rowsFor13 = (inner - w) / 12 < w * 0.4 ? 2 : 1;
    let rows = 1;
    let step = n > 1 ? Math.min(maxStep, (inner - w) / (n - 1)) : 0;
    if (rowsFor13 === 2 && n > 7 && step < w * 0.4) {
      rows = 2;
      step = Math.min(maxStep, (inner - w) / (Math.ceil(n / 2) - 1));
    }
    step = Math.max(1, Math.floor(step));
    const oppX = compact ? Math.max(2, Math.round(w * 0.06)) : Math.round(w * 0.16);
    const oppY = compact ? Math.max(2, Math.round(h * 0.035)) : Math.round(h * 0.085);
    const counts = OPPONENTS.map((seat) => view.opp[seat].length);
    const split = rows === 2 ? Math.ceil(n / 2) : n;
    const signature = [w, inner, compact, n, rows, step, ...counts].join(':');
    return { w, h, compact, inner, n, rows, rowsFor13, step, oppX, oppY, counts, split, signature };
  }
  function writeLayout() {
    const { w, h, inner, n, rows, rowsFor13, step, oppX, oppY, split } = layout;
    const lift = Math.round(h * 0.22);
    const rowGap = Math.round(h * 0.46);
    felt.dataset.compact = String(layout.compact);
    handArea.style.height = `${Math.ceil(h + lift + (rowsFor13 === 2 ? rowGap : 0) + 4)}px`;
    const width = (count) => (count ? w + (count - 1) * step : w);
    const rowTop = rows === 2 ? [lift, lift + rowGap] : [lift + (rowsFor13 === 2 ? rowGap / 2 : 0), lift];
    [split, n - split].forEach((count, row) => {
      const element = pileEl(`h${row}`);
      element.style.left = `${Math.round((inner - width(count)) / 2)}px`;
      element.style.top = `${Math.round(rowTop[row])}px`;
    });
    const north = seatEl(2);
    north.style.width = `${Math.ceil(w + Math.max(0, view.opp[2].length - 1) * oppX)}px`;
    north.style.height = `${Math.ceil(h)}px`;
    for (const seat of [1, 3]) {
      const fan = seatEl(seat);
      fan.style.width = `${Math.ceil(w)}px`;
      fan.style.height = `${Math.ceil(h + Math.max(0, view.opp[seat].length - 1) * oppY)}px`;
    }
  }
  function pileState() {
    const piles = {};
    const split = layout?.split ?? view.hand.length;
    piles.h0 = view.hand.slice(0, split);
    piles.h1 = view.hand.slice(split);
    for (const seat of OPPONENTS) piles[`o${seat}`] = view.opp[seat].map((entry) => ({ card: entry.card, faceUp: false, key: entry.key }));
    for (const seat of [0, 1, 2, 3]) {
      const at = view.trick.findIndex((play) => play.seat === seat);
      piles[`p${seat}`] = at >= 0 ? [view.trick[at].card] : [];
      pileEl(`p${seat}`).style.zIndex = at >= 0 ? String(10 + at) : '';
    }
    return piles;
  }
  /** Draw the view. Moves animate unless `duration` is 0 or motion is reduced. */
  async function render({ duration = null, animate = true } = {}) {
    if (destroyed) return;
    const next = computeLayout();
    const changed = next.signature !== layout?.signature;
    const options = duration === 0 || !animate ? { animate: false } : { duration };
    if (!layout) { layout = next; writeLayout(); }
    layout = { ...next, split: next.split };
    const piles = pileState();
    let motion = table.sync(piles, options);
    if (changed) {
      // The fans and the hand recentre: draw again from where the cards are now.
      writeLayout();
      motion = table.sync(piles, options);
    }
    afterSync();
    await motion;
  }
  function relayout() {
    if (!view || destroyed) return;
    layout = computeLayout();
    writeLayout();
    table.relayout();
    afterSync();
  }
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
    if (!layout || busy || drag) return;
    const next = computeLayout();
    if (next.w !== layout.w || next.inner !== layout.inner) relayout();
  }) : null;
  resizeObserver?.observe(felt);

  /* ── the hand: classes, labels and roving focus ─────────────────────── */
  const handCards = () => [...host.querySelectorAll('[data-pile-id="h0"] .ct-card, [data-pile-id="h1"] .ct-card')]
    .sort((a, b) => view.hand.indexOf(Number(a.dataset.card)) - view.hand.indexOf(Number(b.dataset.card)));
  const cardElement = (card) => felt.querySelector(`.ct-card[data-card="${card}"]`);

  function afterSync() {
    for (const el of felt.querySelectorAll('.ct-card')) {
      if (isHandPile(el.dataset.pile)) continue;
      el.tabIndex = -1;
      if (el.dataset.pile[0] === 'o') el.setAttribute('aria-hidden', 'true'); else el.removeAttribute('aria-hidden');
    }
    refreshHand();
  }
  function refreshHand() {
    if (!view) return;
    const state = engine.state();
    const playing = !busy && state.phase === 'play' && state.turn === 0;
    const passing = !busy && state.phase === 'pass';
    const legal = new Set(playing ? state.legal : []);
    const cards = handCards();
    if (!view.hand.includes(cursorCard)) cursorCard = (playing ? state.legal[0] : null) ?? view.hand[0] ?? null;
    felt.classList.toggle('hz-playing', playing);
    felt.classList.toggle('hz-passing', passing);
    for (const el of cards) {
      const card = Number(el.dataset.card);
      const chosen = passing && selected.has(card);
      el.classList.toggle('hz-legal', playing && legal.has(card));
      el.classList.toggle('hz-illegal', playing && !legal.has(card));
      el.classList.toggle('hz-chosen', chosen);
      el.tabIndex = card === cursorCard ? 0 : -1;
      if (passing) el.setAttribute('aria-pressed', String(chosen)); else el.removeAttribute('aria-pressed');
      const note = passing ? (chosen ? "，已选中传出" : '') : playing && !legal.has(card) ? "，当前无法出牌" : '';
      el.setAttribute('aria-label', `${capital(cardName(card))}${note}`);
    }
  }
  function focusHandCard(card) {
    cursorCard = card;
    refreshHand();
    cardElement(card)?.focus({ preventScroll: true });
  }
  function handKeydown(event) {
    const el = event.target.closest?.('.ct-card');
    if (!el || !isHandPile(el.dataset.pile)) return;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const order = view.hand;
    const at = order.indexOf(Number(el.dataset.card));
    let next = at;
    if (event.key === 'ArrowLeft') next = Math.max(0, at - 1);
    else if (event.key === 'ArrowRight') next = Math.min(order.length - 1, at + 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = order.length - 1;
    else if (layout?.rows === 2) next = event.key === 'ArrowDown' ? Math.min(order.length - 1, at + layout.split) : Math.max(0, at - layout.split);
    if (order[next] !== undefined) focusHandCard(order[next]);
  }
  felt.addEventListener('keydown', handKeydown, true);

  /* ── input: taps, Enter, and dragging a card up onto the table ──────── */
  function activate(pile, index) {
    if (destroyed || drag?.dragging) return;
    if (busy) { hurry(); return; }
    if (!isHandPile(pile) || index < 0) return;
    const card = Number(pileEl(pile).querySelectorAll('.ct-card')[index]?.dataset.card);
    if (!Number.isInteger(card)) return;
    cursorCard = card;
    const state = engine.state();
    if (state.phase === 'pass') {
      const fromKeyboard = felt.contains(document.activeElement) && document.activeElement.classList.contains('ct-card') && document.activeElement.matches(':focus-visible');
      toggleChosen(card);
      if (fromKeyboard && selected.size === 3) passEl.querySelector('.hz-pass-button').focus();
    }
    else if (state.phase === 'play') tryPlay(card);
  }
  function pointerdown(event) {
    if (destroyed) return;
    if (busy) {
      if (!event.target.closest('button:not(.ct-card), .hz-panel')) hurry();
      return;
    }
    // A lifted card whose release never arrived goes back before this press starts.
    if (drag?.dragging && event.pointerId === drag.id) { const stale = drag; drag = null; stale.el.classList.remove('ct-lifted', 'hz-dragging'); snapBack(stale); }
    const el = event.target.closest?.('.ct-card');
    if (!el || !isHandPile(el.dataset.pile) || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const state = engine.state();
    if (state.phase !== 'play' || state.turn !== 0) return;
    const match = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(el.style.transform);
    drag = { id: event.pointerId, el, card: Number(el.dataset.card), x0: event.clientX, y0: event.clientY, bx: Number(match?.[1] ?? 0), by: Number(match?.[2] ?? 0), dragging: false };
  }
  function pointermove(event) {
    if (!drag || event.pointerId !== drag.id) return;
    if (event.pointerType === 'mouse' && event.buttons === 0) { pointerup(event); return; } // the release went missing
    const dx = event.clientX - drag.x0, dy = event.clientY - drag.y0;
    if (!drag.dragging) {
      if (dy > -9 || Math.abs(dx) > Math.abs(dy) * 1.2) return;
      drag.dragging = true;
      drag.el.classList.add('ct-lifted', 'hz-dragging');
      drag.el.style.zIndex = '5000';
      playSound('card-pick');
    }
    drag.el.style.transform = `translate(${drag.bx + dx}px, ${drag.by + dy}px)`;
  }
  function pointerup(event) {
    if (!drag || event.pointerId !== drag.id) return;
    const current = drag;
    if (!current.dragging) { drag = null; return; }
    const handTop = handArea.getBoundingClientRect().top;
    current.el.classList.remove('ct-lifted', 'hz-dragging');
    // Keep `drag` set until the play is underway so the tap that ends the gesture is ignored.
    setTimeout(() => { if (drag === current) drag = null; }, 0);
    const released = event.type !== 'pointercancel';
    if (released && event.clientY < handTop - 6 && tryPlay(current.card)) return;
    if (released && event.clientY >= handTop - 6) announce("向上拖动或点按手牌即可出牌。");
    snapBack(current);
  }
  function snapBack(current) {
    const from = current.el.style.transform;
    const to = `translate(${current.bx}px, ${current.by}px)`;
    current.el.style.transform = to;
    if (table.reducedMotion) { current.el.style.zIndex = ''; return; }
    current.el.animate([{ transform: from }, { transform: to }], { duration: 280, easing: 'cubic-bezier(.3,1.35,.55,1)' })
      .finished.then(() => { current.el.style.zIndex = ''; }, () => {});
  }
  felt.addEventListener('pointerdown', pointerdown);
  felt.addEventListener('pointermove', pointermove);
  felt.addEventListener('pointerup', pointerup);
  felt.addEventListener('pointercancel', pointerup);

  /* ── pacing ─────────────────────────────────────────────────────────── */
  function pace() {
    if (hurrying) return STILL;
    const base = PACES[settings.speed] ?? PACES.relaxed;
    if (table.reducedMotion) return { fly: 0, gap: Math.round(base.gap * 0.6), hold: Math.round(base.hold * 0.7), sweep: 0, pass: 0 };
    return base;
  }
  function wait(ms) {
    if (hurrying || destroyed || ms <= 0) return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => { clearTimeout(timer); sleepers.delete(done); resolve(); };
      const timer = setTimeout(done, ms);
      sleepers.add(done);
    });
  }
  function wakeAll() { for (const done of [...sleepers]) done(); }
  function hurry() {
    if (!busy || hurrying) return;
    hurrying = true;
    wakeAll();
  }
  const alive = (token) => token === runToken && !destroyed;
  /** Run one stretch of animation. Input waits until it ends; a newer run cancels it. */
  async function run(steps) {
    const token = ++runToken;
    busy = true;
    hurrying = false;
    wakeAll();
    clearHint();
    hidePass();
    prompt('');
    refreshHand();
    try { await steps(token); } catch (error) { if (alive(token)) console.error(error); }
    if (!alive(token)) return;
    busy = false;
    hurrying = false;
    settle();
  }

  /* ── views of the core state ────────────────────────────────────────── */
  let placeholderCount = 0;
  const placeholder = (seat) => ({ card: -1, key: `o${seat}-${placeholderCount++}` });
  function viewOf(state, { fullHands = false } = {}) {
    const plays = playsOf(state);
    const opp = {};
    for (const seat of OPPONENTS) {
      const count = state.handSizes[seat] + (fullHands ? plays.filter((play) => play.seat === seat).length : 0);
      opp[seat] = Array.from({ length: count }, () => placeholder(seat));
    }
    const queenTrick = state.tricks.find((trick) => trick.plays.some((play) => play.card === QUEEN));
    return {
      hand: fullHands ? [...state.cards, ...plays.filter((play) => play.seat === 0).map((play) => play.card)].sort(handOrder) : [...state.cards],
      opp,
      trick: fullHands ? [] : state.trick.map((play) => ({ ...play })),
      handPoints: fullHands ? [0, 0, 0, 0] : [...state.handPoints],
      scores: [...state.scores],
      heartsBroken: fullHands ? false : state.heartsBroken,
      queenSeat: fullHands || !queenTrick ? null : queenTrick.winner,
      handNumber: state.handNumber,
    };
  }
  const handKey = (card) => suitOf(card) * 13 + (card % 13 + 12) % 13;
  const handOrder = (a, b) => handKey(a) - handKey(b);

  /* ── chrome: title, plates and status bar ───────────────────────────── */
  function renderChrome() {
    if (destroyed || !view) return;
    const state = engine.state();
    $('.hz-title').textContent = `红心大战 · 第 ${state.seed} 局`;
    $('.hz-menu-mode').textContent = `${daily ? "每日挑战 · " : ''}${state.difficulty === 0 ? "轻松" : "标准"}`;
    const passing = state.passDirection === 'hold' ? "本轮不传牌" : `向${({left:'左',across:'对面',right:'右',hold:'不传'})[state.passDirection]}传牌`;
    $('.hz-status-hand').textContent = `第 ${state.handNumber + 1} 手 · ${passing}`;
    const hearts = $('.hz-status-hearts');
    hearts.innerHTML = `${heartGlyph(view.heartsBroken ? 'hz-glyph-on' : 'hz-glyph-off')} ${view.heartsBroken ? "红心已破" : "红心未破"}`;
    $('.hz-status-score').textContent = `你：${view.scores[0]}`;
    for (const seat of [0, 1, 2, 3]) {
      const el = plateEl(seat);
      el.querySelector('.hz-total').textContent = String(view.scores[seat]);
      const points = view.handPoints[seat];
      const hearts = points - (view.queenSeat === seat ? 13 : 0);
      el.querySelector('.hz-taken').innerHTML = `${hearts > 0 ? `<span class="hz-chip hz-chip-hearts">${heartGlyph()}${hearts}</span>` : ''}${view.queenSeat === seat ? `<span class="hz-chip hz-chip-queen">Q${spadeGlyph()}</span>` : ''}`;
      el.setAttribute('aria-label', `${NAMES[seat]}：${view.scores[seat]} 分${points ? `，本手 ${points} 分` : ''}`);
    }
  }
  function markTurn(seat) {
    for (const s of [0, 1, 2, 3]) plateEl(s).classList.toggle('hz-active', s === seat);
  }

  /* ── passing ────────────────────────────────────────────────────────── */
  function showPass(state) {
    const target = DIRECTION_SEAT[state.passDirection];
    passEl.hidden = false;
    passEl.querySelector('.hz-pass-text').innerHTML = `选三张牌传给 <strong>${NAMES[target]}</strong>.`;
    updatePassButton(state);
  }
  function hidePass() { passEl.hidden = true; }
  function updatePassButton(state = engine.state()) {
    const button = passEl.querySelector('.hz-pass-button');
    button.innerHTML = `传出${({left:'左',across:'对面',right:'右',hold:'不传'})[state.passDirection]} ${ARROWS[state.passDirection] ?? ''}`;
    button.disabled = selected.size !== 3;
    button.setAttribute('aria-label', `将${plural(selected.size, "选中的牌")} ${({left:'左',across:'对面',right:'右',hold:'不传'})[state.passDirection]}传给${NAMES[DIRECTION_SEAT[state.passDirection]]}`);
    passEl.querySelector('.hz-pass-count').textContent = `已选 ${selected.size}/3 张`;
  }
  function toggleChosen(card) {
    if (selected.has(card)) {
      selected.delete(card);
      playSound('card-place');
    } else if (selected.size >= 3) {
      const at = view.hand.indexOf(card);
      table.shake(at < (layout?.split ?? 99) ? 'h0' : 'h1', at < (layout?.split ?? 99) ? at : at - layout.split);
      playSound('invalid');
      announce("已选三张。可以先点一张取消选择。");
      return;
    } else {
      selected.add(card);
      playSound('card-pick');
    }
    clearHint();
    refreshHand();
    updatePassButton();
    const state = engine.state();
    announce(selected.size === 3
      ? `将把${listCards([...selected].sort(handOrder))}传给${NAMES[DIRECTION_SEAT[state.passDirection]]}。`
      : `${capital(cardName(card))}${selected.has(card) ? '已选中' : "已放回"}，已选 ${plural(selected.size, 'card')}/3 张。`);
  }
  function passCards() {
    const before = engine.state();
    if (busy || before.phase !== 'pass') return;
    if (selected.size !== 3) { announce("请选满三张再传牌。"); playSound('invalid'); return; }
    const cards = [...selected].sort(handOrder);
    if (!engine.pass(cards)) { announce("这些牌不能传出。"); playSound('invalid'); return; }
    selected.clear();
    startClock();
    const after = engine.state();
    run(async (token) => {
      await animatePass(before, after, cards, token);
      if (!alive(token)) return;
      await animatePlays(0, after, token);
    });
  }
  async function animatePass(before, after, cards, token) {
    const direction = before.passDirection;
    const shift = { left: 1, right: 3, across: 2 }[direction];
    const target = DIRECTION_SEAT[direction];
    const source = (4 - target) % 4 || 2;
    const received = after.received;
    // The card backs that will come to you become the real cards (still face down).
    const sourceList = view.opp[source];
    const spots = [2, 6, 10].map((at) => Math.min(at, sourceList.length - 1));
    received.forEach((card, i) => { sourceList[spots[i]] = { card, key: card }; });
    await render({ animate: false });
    if (!alive(token)) return;
    // Everyone passes at once.
    const outgoing = {};
    for (const seat of OPPONENTS) {
      if (seat === source) { outgoing[seat] = sourceList.filter((entry) => received.includes(entry.key)); continue; }
      const list = view.opp[seat];
      outgoing[seat] = [2, 6, 10].map((at) => list[Math.min(at, list.length - 1)]);
    }
    for (const seat of OPPONENTS) view.opp[seat] = view.opp[seat].filter((entry) => !outgoing[seat].includes(entry));
    for (const seat of OPPONENTS) {
      const to = (seat + shift) % 4;
      if (to !== 0) view.opp[to].push(...outgoing[seat]);
    }
    view.opp[target].push(...cards.map((card) => ({ card, key: card })));
    view.hand = after.cards.slice();
    playSound('card-deal');
    await render({ duration: pace().pass });
    if (!alive(token)) return;
    playSound('card-place');
    lastEvent = `你将${listCards(cards)}传给${NAMES[target]}；${NAMES[source]}传给你${listCards(received)}。`;
    announce(lastEvent);
    markReceived(received);
    await wait(pace().hold * 0.6);
  }
  function markReceived(cards) {
    clearTimeout(receivedTimer);
    for (const el of felt.querySelectorAll('.hz-received')) el.classList.remove('hz-received');
    for (const card of cards) cardElement(card)?.classList.add('hz-received');
    receivedTimer = setTimeout(() => { for (const el of felt.querySelectorAll('.hz-received')) el.classList.remove('hz-received'); }, 2600);
  }

  /* ── playing ────────────────────────────────────────────────────────── */
  function refuse(card, reason) {
    const at = view.hand.indexOf(card);
    const split = layout?.split ?? view.hand.length;
    table.shake(at < split ? 'h0' : 'h1', at < split ? at : at - split);
    playSound('invalid');
    announce(reason);
    prompt(reason);
  }
  function tryPlay(card) {
    const before = engine.state();
    const reason = illegalReason(card, before);
    if (reason) { refuse(card, reason); return false; }
    if (!engine.play(card)) { refuse(card, "当前不能出这张牌。"); return false; }
    startClock();
    const after = engine.state();
    const from = playsOf(before).length;
    run((token) => animatePlays(from, after, token));
    return true;
  }
  /** Replay every card from `from` onwards, then end the hand if it is over. */
  async function animatePlays(from, state, token) {
    const plays = playsOf(state);
    for (let i = from; i < plays.length; i++) {
      if (!alive(token)) return;
      const play = plays[i];
      if (play.seat !== 0) {
        markTurn(play.seat);
        await wait(pace().gap);
        if (!alive(token)) return;
      }
      await showPlay(play, token);
      if (!alive(token)) return;
      if (play.pos === 3) await takeTrick(state.tricks[play.t], token);
    }
    if (!alive(token)) return;
    markTurn(null);
    if (state.phase === 'handOver' || state.phase === 'gameOver') await endHand(state, token);
  }
  async function showPlay({ seat, card }, token) {
    if (seat === 0) {
      view.hand = view.hand.filter((held) => held !== card);
    } else {
      const list = view.opp[seat];
      let at = list.findIndex((entry) => entry.key === card);
      if (at < 0) {
        const spare = list.map((entry, index) => (typeof entry.key === 'string' ? index : -1)).filter((index) => index >= 0);
        at = spare[(card * 7 + list.length) % spare.length] ?? list.length - 1;
        list[at] = { card, key: card };
        await render({ animate: false });
        if (!alive(token)) return;
      }
      list.splice(at, 1);
    }
    view.trick.push({ seat, card });
    await render({ duration: pace().fly });
    if (!alive(token)) return;
    playSound('card-place');
    if (suitOf(card) === HEARTS && !view.heartsBroken) {
      view.heartsBroken = true;
      renderChrome();
      heartsBroken(seat);
    }
  }
  async function takeTrick(trick, token) {
    const winner = trick.winner;
    const winningCard = trick.plays.find((play) => play.seat === winner).card;
    cardElement(winningCard)?.classList.add('hz-winner');
    markTurn(winner);
    await wait(pace().hold);
    if (!alive(token)) return;
    const elements = trick.plays.map((play) => cardElement(play.card)).filter(Boolean);
    const sweep = pace().sweep;
    if (sweep && !table.reducedMotion) {
      const target = seatEl(winner).getBoundingClientRect();
      const tx = target.left + target.width / 2, ty = target.top + Math.min(target.height, layout.h) / 2;
      await Promise.all(elements.map((el, i) => {
        const rect = el.getBoundingClientRect();
        const dx = tx - (rect.left + rect.width / 2), dy = ty - (rect.top + rect.height / 2);
        const base = el.style.transform || 'translate(0px, 0px)';
        return el.animate([
          { transform: base, opacity: 1 },
          { transform: `${base} translate(${dx * 0.7}px, ${dy * 0.7}px) scale(.82)`, opacity: 1, offset: 0.6 },
          { transform: `${base} translate(${dx}px, ${dy}px) scale(.64)`, opacity: 0 },
        ], { duration: sweep, delay: i * 26, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'forwards' }).finished.catch(() => {});
      }));
      if (!alive(token)) return;
    }
    const hasQueen = trick.plays.some((play) => play.card === QUEEN);
    view.trick = [];
    view.handPoints[winner] += trick.points;
    if (hasQueen) view.queenSeat = winner;
    await render({ animate: false });
    renderChrome();
    playSound(hasQueen ? 'queen-of-spades' : 'trick-take');
    if (trick.points) floatPoints(winner, trick.points, hasQueen);
    const who = winner === 0 ? "你收下" : `${NAMES[winner]}收下`;
    lastEvent = hasQueen ? `${who}黑桃 Q${trick.points > 13 ? ` 和${plural(trick.points - 13, 'heart')}` : ''}。`
      : `${who}这一墩${trick.points ? ` 和${plural(trick.points, 'point')}` : ''}。`;
    announce(lastEvent);
  }
  function floatPoints(seat, points, queen) {
    if (table.reducedMotion) return;
    const anchor = plateEl(seat).getBoundingClientRect();
    const base = felt.getBoundingClientRect();
    const tag = document.createElement('span');
    tag.className = `hz-float${queen ? ' hz-float-queen' : ''}`;
    tag.setAttribute('aria-hidden', 'true');
    tag.textContent = `+${points}`;
    tag.style.left = `${anchor.right - base.left + 4}px`;
    tag.style.top = `${anchor.top - base.top - 2}px`;
    felt.append(tag);
    tag.addEventListener('animationend', () => tag.remove());
  }
  function heartsBroken(seat) {
    playSound('hearts-broken');
    announce(`${seat === 0 ? "你率先打出了" : `${NAMES[seat]}率先打出了`}红心。`);
    showMoment(`${heartGlyph()}<span>红心已破</span>`, 'hz-moment-hearts', 1500);
  }
  let momentTimer = 0;
  function showMoment(html, kind, ms) {
    clearTimeout(momentTimer);
    momentEl.className = `hz-moment ${kind}`;
    momentEl.innerHTML = html;
    momentEl.hidden = false;
    momentTimer = setTimeout(() => { momentEl.hidden = true; }, ms);
  }

  /* ── end of a hand, end of a game ───────────────────────────────────── */
  async function endHand(state, token) {
    view.scores = [...state.scores];
    view.handPoints = [...state.lastHand.points];
    renderChrome();
    await wait(pace().gap);
    if (!alive(token)) return;
    if (state.lastHand.moon !== null) playSound('shoot-the-moon');
    if (state.phase === 'gameOver') showGameOver(state);
    else showSummary(state);
  }
  function standingsRows(state, withHand) {
    const order = [0, 1, 2, 3].sort((a, b) => state.scores[a] - state.scores[b] || a - b);
    return order.map((seat) => {
      const hand = state.lastHand?.points[seat] ?? 0;
      return `<tr${seat === 0 ? ' class="hz-row-you"' : ''}><th scope="row">${NAMES[seat]}</th>${withHand ? `<td class="hz-col-hand${hand ? '' : ' hz-zero'}">${hand ? `+${hand}` : '0'}</td>` : ''}<td>${state.scores[seat]}</td></tr>`;
    }).join('');
  }
  function showSummary(state) {
    const last = state.lastHand;
    const handNumber = state.history.length;
    const queenSeat = view.queenSeat;
    let kicker = `第 ${handNumber} 手结束`;
    let headline;
    let art = '';
    if (last.moon !== null) {
      headline = last.moon === 0 ? "你全收了！" : `${NAMES[last.moon]}全收了！`;
      kicker = last.moon === 0 ? "收齐全部红心和黑桃 Q" : "一手收齐全部 26 分";
      art = MOON;
    } else if (last.points[0] === 0) headline = "本手零分。";
    else if (queenSeat === 0) headline = "这次你收到了黑桃 Q。";
    else if (queenSeat !== null) headline = `${NAMES[queenSeat]}收到了黑桃 Q。`;
    else headline = `本手你收下${plural(last.points[0], 'point')}。`;
    const leader = Math.max(...state.scores);
    showPanel(`${art}<span class="hz-kicker">${kicker}</span><strong>${headline}</strong>
      <table class="hz-mini"><thead><tr><th scope="col"><span class="hz-visually-hidden">玩家</span></th><th scope="col">本手</th><th scope="col">总分</th></tr></thead><tbody>${standingsRows(state, true)}</tbody></table>
      <p>有人达到 100 分即结束${leader >= 75 ? `，${NAMES[state.scores.indexOf(leader)]}已接近 100 分` : ''}。总分最低者获胜。</p>
      <div class="hz-panel-actions"><button type="button" class="hz-classic-button hz-default-button" data-action="next-hand">发下一手</button><button type="button" class="hz-text-button" data-action="scores">计分表</button></div>`,
    last.moon !== null ? 'hz-panel-moon' : '');
    announce(`${headline} ${state.scores.map((score, seat) => `${NAMES[seat]} ${score}`).join(', ')}.`);
    prompt('');
  }
  function showGameOver(state) {
    finishedSeconds = elapsed();
    const winners = state.winners;
    const won = winners.includes(0);
    const best = state.scores[winners[0]];
    let headline;
    if (won && winners.length === 1) headline = `你以 ${best} 分获胜。`;
    else if (won) headline = `你与${winners.filter((seat) => seat !== 0).map((seat) => NAMES[seat]).join('和')}并列获胜。`;
    else headline = `${winners.map((seat) => NAMES[seat]).join('和')} ${winners.length > 1 ? "并列获胜" : `以 ${best} 分获胜`}.`;
    const place = [0, 1, 2, 3].filter((seat) => state.scores[seat] < state.scores[0]).length;
    const sub = won
      ? `${plural(state.history.length, 'hand')}，全场最低。${daily ? " 今日挑战结束。" : ''}`
      : `You finished ${ordinal(place)} with ${state.scores[0]}. Every deal is a fresh start; another game?`;
    // In the site shell a win gets the page's result dialog instead; a loss keeps this panel.
    if (!(chrome && won)) showPanel(`${state.lastHand?.moon !== null && state.lastHand?.moon !== undefined ? MOON : ''}<span class="hz-kicker">对局结束 · ${plural(state.history.length, 'hand')}</span><strong>${headline}</strong>
      <table class="hz-mini"><thead><tr><th scope="col"><span class="hz-visually-hidden">玩家</span></th><th scope="col">上一手</th><th scope="col">总分</th></tr></thead><tbody>${standingsRows(state, true)}</tbody></table>
      <p>${sub}</p>
      <div class="hz-panel-actions"><button type="button" class="hz-classic-button hz-default-button" data-action="new">新游戏</button><button type="button" class="hz-text-button" data-action="same">重玩本局</button><button type="button" class="hz-text-button" data-action="scores">计分表</button></div>`,
    won ? 'hz-panel-won' : 'hz-panel-lost');
    announce(`对局结束。${headline}`);
    prompt('');
    if (wonReported) return;
    wonReported = true;
    playSound(won ? 'win' : 'lose');
    const summary = { game: 'hearts', seed: state.seed, deal: state.seed, daily, elapsedSeconds: finishedSeconds, scores: [...state.scores], hands: state.history.length, difficulty: state.difficulty, replay: engine.replay(), params: { deal: state.seed } };
    notify(won ? onWin : onLose, summary);
  }
  function showPanel(html, kind = '') {
    panelEl.className = `hz-panel ${kind}`.trim();
    panelEl.innerHTML = html;
    panelEl.hidden = false;
    requestAnimationFrame(() => { if (!panelEl.hidden) panelEl.querySelector('.hz-default-button')?.focus({ preventScroll: true }); });
  }
  function hidePanel() { panelEl.hidden = true; panelEl.innerHTML = ''; }

  /* ── what to show when nothing is moving ────────────────────────────── */
  function settle() {
    if (destroyed || busy) return;
    const state = engine.state();
    renderChrome();
    refreshHand();
    if (state.phase === 'pass') {
      markTurn(0);
      showPass(state);
      prompt(`选择 3 张牌向${({left:'左',across:'对面',right:'右',hold:'不传'})[state.passDirection]}传出`);
    } else if (state.phase === 'play' && state.turn === 0) {
      markTurn(0);
      hidePass();
      const led = state.trick.length ? suitOf(state.trick[0].card) : null;
      const canFollow = led !== null && state.cards.some((card) => suitOf(card) === led);
      const text = state.tricksPlayed === 0 && !state.trick.length ? "首出梅花 2"
        : led === null ? "由你首出"
          : canFollow ? `轮到你，请跟${SUIT_PLURALS[led]}` : `轮到你。没有${SUIT_PLURALS[led]}，可以垫其他牌`;
      prompt(text);
      announce(`${lastEvent ? `${lastEvent} ` : ''}${text}.`);
      lastEvent = '';
      if (felt.contains(document.activeElement) && document.activeElement?.classList.contains('ct-card')) focusHandCard(cursorCard ?? state.legal[0]);
    } else {
      markTurn(null);
      hidePass();
      if (state.phase === 'gameOver' && panelEl.hidden) showGameOver(state);
      else if (state.phase === 'handOver' && panelEl.hidden) showSummary(state);
    }
  }

  /* ── dealing, new games and the next hand ───────────────────────────── */
  async function dealHand(state, token) {
    hidePanel();
    selected.clear();
    lastEvent = '';
    view = viewOf(state, { fullHands: true });
    layout = computeLayout();
    writeLayout();
    renderChrome();
    markTurn(null);
    const order = [];
    const keys = { 0: view.hand };
    for (const seat of OPPONENTS) keys[seat] = view.opp[seat].map((entry) => entry.key);
    for (let i = 0; i < 13; i++) for (const seat of [1, 2, 3, 0]) if (keys[seat][i] !== undefined) order.push(keys[seat][i]);
    const trick = $('.hz-trick').getBoundingClientRect();
    const base = felt.getBoundingClientRect();
    const from = { x: trick.left - base.left + trick.width / 2 - layout.w / 2, y: trick.top - base.top + trick.height / 2 - layout.h / 2 };
    const motion = table.deal(pileState(), { from, order, stagger: hurrying ? 0 : settings.speed === 'brisk' ? 12 : 18 });
    afterSync();
    await motion;
    afterSync();
    if (!alive(token)) return;
    if (state.passDirection === 'hold') {
      showMoment("<span>本手不传牌</span>", 'hz-moment-note', 1700);
      announce("本手所有人保留自己的牌。");
      await wait(pace().hold);
    }
  }
  function newGame(deal = null, { keepDaily = false, quiet = false } = {}) {
    closeMenus();
    const seed = deal ?? (daily ? dailyDeal() : randomDeal());
    if (deal !== null && !keepDaily) daily = false;
    engine.newGame({ seed, difficulty: settings.difficulty });
    started = null;
    finishedSeconds = null;
    wonReported = false;
    hidePanel();
    if (!quiet) playSound('new-game');
    notify(onStart);
    announce(daily ? "所有人今天使用同一局。先传出三张牌。" : `第 ${seed} 局。先选三张牌传出。`);
    const state = engine.state();
    return run(async (token) => {
      await dealHand(state, token);
      if (alive(token)) await animatePlays(0, state, token);
    });
  }
  function nextHand() {
    if (busy || engine.state().phase !== 'handOver') return;
    if (!engine.nextHand()) return;
    hidePanel();
    const state = engine.state();
    announce(state.passDirection === 'hold' ? `第 ${state.handNumber + 1} 手，不传牌。` : `第 ${state.handNumber + 1} 手，向${({left:'左',across:'对面',right:'右',hold:'不传'})[state.passDirection]}传三张。`);
    run(async (token) => {
      await dealHand(state, token);
      if (alive(token)) await animatePlays(0, state, token);
    });
  }

  /* ── hints ──────────────────────────────────────────────────────────── */
  function clearHint() {
    clearTimeout(hintTimer);
    for (const el of felt.querySelectorAll('.hz-hint')) el.classList.remove('hz-hint');
  }
  function hint() {
    if (busy) { announce("请稍候，其他玩家正在出牌。"); return; }
    const suggestion = engine.hint();
    if (!suggestion) { announce(engine.state().phase === 'play' ? "请等待你的回合。" : "暂无提示。"); return; }
    clearHint();
    const cards = suggestion.type === 'pass' ? suggestion.cards : [suggestion.card];
    for (const card of cards) {
      const el = cardElement(card);
      if (!el) continue;
      void el.offsetWidth;
      el.classList.add('hz-hint');
    }
    hintTimer = setTimeout(clearHint, 2400);
    announce(suggestion.type === 'pass' ? `建议传出${listCards(cards)}。` : `建议打出${cardName(cards[0])}。`);
    if (cards.length) focusHandCardQuietly(cards[0]);
  }
  function focusHandCardQuietly(card) {
    cursorCard = card;
    refreshHand();
    if (felt.contains(document.activeElement)) cardElement(card)?.focus({ preventScroll: true });
  }

  /* ── score sheet ────────────────────────────────────────────────────── */
  function renderSheet() {
    const state = engine.state();
    const totals = [0, 0, 0, 0];
    const rows = state.history.map((hand, index) => {
      hand.forEach((points, seat) => { totals[seat] += points; });
      const moon = hand.filter((points) => points === 26).length === 3 && hand.includes(0) ? hand.indexOf(0) : -1;
      return `<tr><th scope="row">${index + 1}</th>${totals.map((total, seat) => `<td${seat === moon ? ' class="hz-moon-cell" title="Shot the moon"' : ''}><span class="hz-sheet-total">${total}</span><span class="hz-sheet-hand">${hand[seat] ? `+${hand[seat]}` : '0'}</span></td>`).join('')}</tr>`;
    });
    const best = Math.min(...state.scores);
    const body = rows.length ? rows.join('') : `<tr><td colspan="5" class="hz-sheet-empty">暂无已结束的手牌。每手结束后会在这里计分。</td></tr>`;
    host.querySelector('.hz-sheet').innerHTML = `<table class="hz-sheet-table"><thead><tr><th scope="col">本手</th>${NAMES.map((name, seat) => `<th scope="col"${rows.length && state.scores[seat] === best ? ' class="hz-leader"' : ''}>${name}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>`;
  }

  /* ── menus, dialogs and keys ────────────────────────────────────────── */
  function closeMenus() {
    openMenu = null;
    for (const menu of host.querySelectorAll('.hz-dropdown')) menu.hidden = true;
    for (const trigger of host.querySelectorAll('.hz-menu-trigger')) { trigger.setAttribute('aria-expanded', 'false'); trigger.classList.remove('hz-menu-active'); }
  }
  function toggleMenu(name) {
    const next = openMenu === name ? null : name;
    closeMenus();
    if (!next) return;
    openMenu = next;
    const trigger = host.querySelector(`[data-action="menu-${name}"]`);
    trigger.setAttribute('aria-expanded', 'true');
    trigger.classList.add('hz-menu-active');
    const menu = host.querySelector(`[data-menu="${name}"]`);
    menu.hidden = false;
    menu.querySelector('button:not(:disabled)')?.focus();
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
      form.elements.difficulty.value = String(settings.difficulty);
      form.elements.speed.value = settings.speed;
    }
    if (name === 'scores') renderSheet();
    if (!dialog.open) dialog.showModal();
    if (name === 'deal') { const input = dialog.querySelector('input'); input.focus(); input.select(); }
  }
  function action(name) {
    if (name === 'menu-game' || name === 'menu-help') { toggleMenu(name.slice(5)); return; }
    if (name === 'cancel-dialog') { host.querySelector('dialog[open]')?.close(); return; }
    closeMenus();
    if (name === 'new') newGame();
    else if (name === 'same') newGame(engine.state().seed, { keepDaily: true });
    else if (name === 'next-hand') nextHand();
    else if (name === 'pass') passCards();
    else if (name === 'hint') hint();
    else if (['deal', 'options', 'help', 'about', 'scores'].includes(name)) showDialog(name);
  }
  function click(event) {
    const button = event.target.closest('[data-action]');
    if (button && host.contains(button)) { action(button.dataset.action); return; }
    if (openMenu && !event.target.closest('.hz-menu-wrap')) closeMenus();
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
      const difficulty = Number(form.elements.difficulty.value) === 0 ? 0 : 1;
      const speed = form.elements.speed.value in PACES ? form.elements.speed.value : 'relaxed';
      const restart = difficulty !== settings.difficulty;
      Object.assign(settings, { difficulty, speed });
      writeJSON(SETTINGS_KEY, settings);
      form.closest('dialog').close();
      if (restart) newGame(engine.state().seed, { keepDaily: true });
      else renderChrome();
    }
  }
  function keydown(event) {
    // The card table already acted on this key (for example Enter on a card that was just played).
    if (event.defaultPrevented) return;
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
    else if ((event.ctrlKey || event.metaKey) && key === 'z') { event.preventDefault(); announce("红心大战不能撤销出牌。"); }
    else if (event.ctrlKey || event.metaKey || event.altKey) return;
    else if (event.key === 'Escape' && openMenu) closeMenus();
    else if (busy && (event.key === ' ' || event.key === 'Enter' || event.key === 'Escape')) hurry();
    else if (key === 'h') { event.preventDefault(); hint(); }
    else if (key === 't') { event.preventDefault(); showDialog('scores'); }
  }
  host.addEventListener('click', click);
  host.addEventListener('submit', submit);
  document.addEventListener('keydown', keydown);

  /* ── first deal ─────────────────────────────────────────────────────── */
  await stylesLoaded();
  view = viewOf(engine.state(), { fullHands: true });
  layout = computeLayout();
  writeLayout();
  renderChrome();
  announce(daily ? "所有人今天使用同一局。先传出三张牌。" : "小心红心和黑桃 Q。先选三张牌传出。");
  const first = engine.state();
  notify(onStart);
  await run(async (token) => {
    await dealHand(first, token);
    if (alive(token)) await animatePlays(0, first, token);
  });

  return {
    destroy() {
      destroyed = true;
      runToken += 1;
      wakeAll();
      clearTimeout(hintTimer);
      clearTimeout(receivedTimer);
      clearTimeout(momentTimer);
      resizeObserver?.disconnect();
      document.removeEventListener('keydown', keydown);
      host.removeEventListener('click', click);
      host.removeEventListener('submit', submit);
      table.destroy();
      host.remove();
    },
    exportReplay() { return engine.replay(); },
    async loadReplay(replay) {
      const loaded = await loadHeartsReplay(replay);
      runToken += 1;
      wakeAll();
      busy = false;
      hurrying = false;
      engine = loaded;
      const state = engine.state();
      settings.difficulty = state.difficulty;
      daily = false;
      started = null;
      finishedSeconds = null;
      wonReported = false;
      selected.clear();
      hidePanel();
      hidePass();
      momentEl.hidden = true;
      view = viewOf(state);
      layout = null;
      await render({ animate: false });
      lastEvent = "已载入回放。";
      announce(chrome ? '' : "已载入回放，可以接着玩。");
      settle();
    },
    newGame: (deal = null) => newGame(deal, { quiet: true }),
    hint,
    state: () => engine.state(),
    shortcuts: [['← →', "选择一张牌"], ['Enter', "打出或选中传给对手"], ["向上拖动", "出牌"], ["空格或回车", "加快电脑出牌"], ['H', "提示"], ['T', "计分表"], ['F2', "新游戏"], ['F1', "玩法说明"]],
    setFidelity(value) {
      fidelity = value === 'pixels' ? 'pixels' : 'crisp';
      host.dataset.fidelity = fidelity;
      relayout();
    },
    table,
  };
}

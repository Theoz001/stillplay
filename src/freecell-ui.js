import { createFreecell, loadFreecellReplay } from './freecell-core.js';
import { createCardTable } from './card-table.js';
import { dailyDeal } from './shared.js';
import { SUIT_LABELS as SUITS, RANKS, PATHS, cardName } from './cards.js';

const locationName = ref => ref.type === 'column' ? `第 ${ref.index + 1} 列` : ref.type === 'freecell' ? `第 ${ref.index + 1} 个空当` : `${SUITS[ref.index]}回收区`;
const utcDeal = () => dailyDeal();
const KIND = { c: 'column', f: 'freecell', h: 'foundation' };
const toRef = pile => ({ type: KIND[pile[0]], index: Number(pile.slice(1)) });
const toPile = ref => `${ref.type[0] === 'c' ? 'c' : ref.type[0] === 'f' ? 'f' : 'h'}${ref.index}`;
const red = card => [1, 2].includes(Math.floor(card / 13));
const buildsOn = (card, below) => card % 13 + 1 === below % 13 && red(card) !== red(below);

/** The keyboard and mouse sheet the site shows for this game (the shell reads it from the handle). */
const SHORTCUTS = [["先点牌，再点目标位置", "移动选中的牌"], ["双击", "自动移入回收区或空当"], ['Ctrl / ⌘ + Z', "撤销"], ['H', "提示"], ["方向键 · 回车", "选牌、放牌"], ['Esc', "取消选牌"], ['F2', "重新发牌"], ['F1', "玩法说明"]];

function injectStyles() {
  if (document.querySelector('link[data-freecell-styles]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./freecell.css', import.meta.url).href;
  link.dataset.freecellStyles = '';
  document.head.append(link);
}

/* The window is drawn once; cards live in the shared card table and only move. */
function frame(daily, chrome) {
  // In the site shell, Undo and Hint live in the page toolbar; only FreeCell's own extras stay below the window.
  const quick = chrome
    ? "<button type=\"button\" data-action=\"auto\">自动收牌</button><span aria-hidden=\"true\">·</span><button type=\"button\" data-action=\"deal\">选择牌局</button>"
    : "<button type=\"button\" data-action=\"undo\">撤销</button><span aria-hidden=\"true\">·</span><button type=\"button\" data-action=\"hint\">提示</button><span aria-hidden=\"true\">·</span><button type=\"button\" data-action=\"auto\">自动收牌</button><span aria-hidden=\"true\">·</span><button type=\"button\" data-action=\"deal\">选择牌局</button>";
  const freecells = [0, 1, 2, 3].map(index => `<div class="fc-slot fc-freecell-slot" data-fc-pile="f${index}"><button type="button" class="fc-empty-slot" data-ct-target data-loc="freecell" data-index="${index}" aria-label="第 ${index + 1} 个空当，空"><span class="fc-slot-outline"></span></button></div>`).join('');
  const foundations = [0, 1, 2, 3].map(index => `<div class="fc-slot fc-foundation-slot" data-fc-pile="h${index}"><button type="button" class="fc-foundation" data-ct-target data-loc="foundation" data-index="${index}" aria-label="${SUITS[index]}回收区，空"><svg class="fc-foundation-suit" viewBox="0 0 24 24" aria-hidden="true"><path d="${PATHS[index]}" fill="currentColor"/></svg></button></div>`).join('');
  const columns = [0, 1, 2, 3, 4, 5, 6, 7].map(index => `<div class="fc-column" data-fc-pile="c${index}" role="group" aria-label="第 ${index + 1} 列"><button type="button" class="fc-column-target" data-ct-target data-loc="column" data-index="${index}" aria-label="空的第 ${index + 1} 列"></button></div>`).join('');
  return `<section class="fc-window" aria-label="空当接龙牌桌"><div class="fc-titlebar"><span class="fc-title-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="2" y="3" width="13" height="18" rx="1" fill="#fff" stroke="#142b64"/><rect x="9" y="2" width="13" height="18" rx="1" fill="#fff" stroke="#142b64"/><path d="m15.5 5 4 6-4 6-4-6Z" fill="#b4232b"/></svg></span><span class="fc-title-text">空当接龙</span><span class="fc-title-controls" aria-hidden="true"><i></i><i></i><i>×</i></span></div>`
    + `<div class="fc-menubar"><div class="fc-menu-wrap"><button type="button" class="fc-menu-trigger" data-action="menu-game" aria-expanded="false" aria-haspopup="menu">游戏</button><div class="fc-dropdown" role="menu" data-menu="game" hidden><button role="menuitem" type="button" data-action="new">新游戏 <span>F2</span></button><button role="menuitem" type="button" data-action="deal">选择牌局…</button><div class="fc-menu-separator"></div><button role="menuitem" type="button" data-action="undo">撤销 <span>Ctrl+Z</span></button><button role="menuitem" type="button" data-action="hint">提示 <span>H</span></button><button role="menuitem" type="button" data-action="auto">自动收牌</button></div></div>`
    + `<div class="fc-menu-wrap"><button type="button" class="fc-menu-trigger" data-action="menu-help" aria-expanded="false" aria-haspopup="menu">帮助</button><div class="fc-dropdown" role="menu" data-menu="help" hidden><button role="menuitem" type="button" data-action="help">玩法说明 <span>F1</span></button><button role="menuitem" type="button" data-action="about">关于此版本</button></div></div><span class="fc-menu-deal">${daily ? "每日牌局" : "经典规则"}</span></div>`
    + `<div class="fc-felt"><div class="fc-cell-labels"><span>空当</span><span>FOUNDATIONS</span></div><div class="fc-top-row"><div class="fc-freecells">${freecells}</div><div class="fc-foundations">${foundations}</div></div><div class="fc-tableau">${columns}</div><div class="fc-win-panel" role="status" hidden></div></div>`
    + `<div class="fc-statusbar"><span class="fc-status-left">0 步</span><span class="fc-status-deal">第 1 局</span></div></section>`
    + `<div class="fc-below-game"><div class="fc-quick-actions">${quick}</div><p class="fc-message" role="status" aria-live="polite"></p></div>`
    + `<dialog class="fc-dialog" data-dialog="deal" aria-labelledby="fc-deal-title"><form method="dialog" class="fc-dialog-form"><h2 id="fc-deal-title">选择牌局</h2><p>请输入 1 到 32,000 之间的牌局编号。</p><label for="fc-deal-input">牌局编号</label><input id="fc-deal-input" name="deal" type="number" min="1" max="32000" step="1" required><p class="fc-dialog-error" data-deal-error aria-live="polite"></p><div class="fc-dialog-actions"><button class="fc-classic-button" type="button" data-action="cancel-dialog">取消</button><button class="fc-classic-button fc-default-button" type="submit">发牌</button></div></form></dialog>`
    + `<dialog class="fc-dialog" data-dialog="help" aria-labelledby="fc-help-title"><div class="fc-dialog-form"><h2 id="fc-help-title">空当接龙玩法</h2><p>将每种花色从 A 到 K 依次移入回收区。牌列中按点数递减、红黑交替叠放。</p><p>可以拖动一张牌或一组连续牌，也可以先选牌再点目标位置。双击可将牌移入回收区或空当。保留的空当和空列越多，一次能移动的牌越多。</p><p>按 Tab 或方向键切换牌堆，按回车选牌或放牌，按 Esc 取消。 <strong>F2</strong> 重新发牌。 <strong>Ctrl+Z</strong> 撤销。 <strong>H</strong> 显示下一步提示。自动收牌只会移动不影响后续走法的牌。</p><div class="fc-dialog-actions"><button type="button" class="fc-classic-button fc-default-button" data-action="cancel-dialog">知道了</button></div></div></dialog>`
    + `<dialog class="fc-dialog" data-dialog="about" aria-labelledby="fc-about-title"><div class="fc-dialog-form"><h2 id="fc-about-title">关于空当接龙</h2><p>本版采用经典空当接龙规则，支持按编号选局。</p><p>所有牌面均由本项目绘制。</p><div class="fc-dialog-actions"><button type="button" class="fc-classic-button fc-default-button" data-action="cancel-dialog">关闭</button></div></div></dialog>`;
}

export async function mountFreecell(container, { daily = false, onWin = () => {}, onStart = () => {}, sound = () => {}, chrome = false } = {}) {
  injectStyles();
  const requestedDeal = Number(new URLSearchParams(location.search).get('deal'));
  let engine = await createFreecell({ deal: daily ? utcDeal() : Number.isInteger(requestedDeal) && requestedDeal >= 1 && requestedDeal <= 2147483647 ? requestedDeal : 1 });
  let openMenu = null;
  let message = "将所有牌按花色从 A 到 K 依次移入回收区。";
  let fidelity = 'crisp';
  let started = Date.now();
  let wonReported = false;
  let destroyed = false;
  let autofinishTimer = null;
  const host = document.createElement('div');
  host.className = 'freecell-root';
  host.dataset.fidelity = fidelity;
  host.innerHTML = frame(daily, chrome);
  container.replaceChildren(host);
  const felt = host.querySelector('.fc-felt');

  function getState() { return typeof engine.state === 'function' ? engine.state() : engine.getState(); }
  function playSound(name) { try { sound(name); } catch { /* Sound is optional. */ } }
  function cancelAuto() { if (autofinishTimer) clearTimeout(autofinishTimer); autofinishTimer = null; }
  const rowOffset = () => {
    const style = getComputedStyle(host);
    const offset = Number.parseFloat(style.getPropertyValue('--fc-row-offset')) || 23;
    const scale = Number.parseFloat(style.getPropertyValue('--table-scale')) || 1;
    return offset * scale;
  };

  const table = createCardTable(felt, {
    cardClass: 'fc-card',
    piles: [
      ...[0, 1, 2, 3].map(index => ({ id: `f${index}`, element: host.querySelector(`[data-fc-pile="f${index}"]`), row: 0, label: `第 ${index + 1} 个空当` })),
      ...[0, 1, 2, 3].map(index => ({ id: `h${index}`, element: host.querySelector(`[data-fc-pile="h${index}"]`), row: 0, label: `${SUITS[index]}回收区` })),
      ...[0, 1, 2, 3, 4, 5, 6, 7].map(index => ({ id: `c${index}`, element: host.querySelector(`[data-fc-pile="c${index}"]`), row: 1, label: `第 ${index + 1} 列`, fan: 'down', grow: true, faceUpOffset: rowOffset })),
    ],
    canPick(pile, index) {
      const state = getState();
      if (pile[0] === 'f') return true;
      if (pile[0] !== 'c') return false;
      const cards = state.columns[Number(pile.slice(1))];
      for (let row = index + 1; row < cards.length; row++) if (!buildsOn(cards[row], cards[row - 1])) return false;
      return true;
    },
    canDrop: (from, to) => engine.canMove(from.pile, to, from.count),
    drop: (from, to) => applyMove({ from: toRef(from.pile), count: from.count }, toRef(to)),
    activate(pile, index) {
      if (getState().status === 'won') return;
      if (pile[0] === 'c' && index >= 0) announce("只有点数连续递减、红黑交替的牌才能整组移动。");
      else announce(pile[0] === 'h' ? "每个回收区只收一种花色，从 A 开始。" : "先选一张牌，再选目标位置。");
    },
    autoMove(pile, index) {
      const state = getState();
      const ref = toRef(pile);
      const cards = ref.type === 'column' ? state.columns[ref.index] : ref.type === 'freecell' ? [state.freecells[ref.index]] : [];
      if (ref.type === 'foundation' || index !== cards.length - 1) return false;
      const card = cards[index];
      const home = { type: 'foundation', index: Math.floor(card / 13) };
      if (engine.canMove(ref, home, 1)) return applyMove({ from: ref, count: 1 }, home);
      if (ref.type === 'freecell') return false;
      const free = state.freecells.findIndex(cell => cell === null);
      return free >= 0 ? applyMove({ from: ref, count: 1 }, { type: 'freecell', index: free }) : false;
    },
    cardLabel: (id, faceUp, pile, index) => `${RANKS[id % 13]}, ${cardName(id)}, ${locationName(toRef(pile))}${pile[0] === 'c' ? `，第 ${index + 1} 张` : ''}`,
    decorate(el, info) {
      const ref = toRef(info.pile);
      el.dataset.loc = ref.type;
      el.dataset.index = String(ref.index);
      if (ref.type === 'column') el.dataset.cardIndex = String(info.index); else delete el.dataset.cardIndex;
      el.dataset.focusKey = `${ref.type}-${ref.index}-${ref.type === 'column' ? info.index : 'top'}`;
    },
    announce,
    sound: playSound,
    messages: {
      pick: from => {
        const id = cardAt(from.pile, from.index);
        return `已选中${cardName(id)}${from.count > 1 ? ` 及其下方的 ${from.count - 1} 张牌` : ''}，请选择目标位置。`;
      },
      cancel: () => "已取消选牌。",
      illegal: () => "请更换目标位置，或先腾出更多空当。",
    },
  });

  function cardAt(pile, index) {
    const state = getState();
    const ref = toRef(pile);
    if (ref.type === 'column') return state.columns[ref.index][index];
    if (ref.type === 'freecell') return state.freecells[ref.index];
    return ref.index * 13 + index;
  }
  function pileState(state) {
    const piles = {};
    state.freecells.forEach((id, index) => { piles[`f${index}`] = id === null ? [] : [id]; });
    state.foundations.forEach((rank, index) => { piles[`h${index}`] = Array.from({ length: rank }, (_, r) => index * 13 + r); });
    state.columns.forEach((cards, index) => { piles[`c${index}`] = cards; });
    return piles;
  }
  function dealOrder(state) {
    const order = [];
    for (let row = 0; row < 7; row++) state.columns.forEach(cards => { if (cards[row] !== undefined) order.push(cards[row]); });
    return order;
  }
  function dealPoint() {
    const width = felt.clientWidth, height = felt.clientHeight;
    const card = host.querySelector('.fc-column')?.clientWidth ?? 60;
    return { x: width / 2 - card / 2, y: height + 8 };
  }

  function renderChrome(state = getState()) {
    if (destroyed) return;
    const elapsed = Math.floor((Date.now() - started) / 1000);
    host.dataset.fidelity = fidelity;
    host.querySelector('.fc-title-text').textContent = `空当接龙 · 第 ${state.deal} 局`;
    host.querySelector('.fc-menu-deal').textContent = daily ? "每日牌局" : "经典规则";
    for (const button of host.querySelectorAll('[data-action="undo"]')) button.disabled = !state.moves;
    host.querySelector('.fc-status-left').textContent = `${state.moves} 步`;
    host.querySelector('.fc-status-deal').textContent = `第 ${state.deal} 局`;
    state.foundations.forEach((rank, index) => host.querySelector(`.fc-foundation[data-index="${index}"]`)
      .setAttribute('aria-label', `${SUITS[index]}回收区，${rank ? cardName(index * 13 + rank - 1) : '空'}`));
    const panel = host.querySelector('.fc-win-panel');
    // In the site shell the win dialog is the one result screen.
    if (state.status === 'won' && !chrome) {
      panel.innerHTML = `<span class="fc-win-kicker">全部收齐。</span><strong>你赢得了第 ${state.deal} 局。</strong><p>${state.moves} 步 · ${elapsed} 秒${daily ? " · 已完成每日挑战" : ''}</p><button type="button" class="fc-classic-button" data-action="new">${daily ? "重玩本局" : "再玩一局"}</button>`;
      panel.hidden = false;
    } else panel.hidden = true;
    host.querySelector('.fc-message').textContent = message;
    if (state.status === 'won' && !wonReported) {
      wonReported = true;
      announce(`你用了 ${state.moves} 步赢得第 ${state.deal} 局。`);
      playSound('win');
      onWin({ game: 'freecell', deal: state.deal, seed: state.deal, moves: state.moves, daily, elapsedSeconds: elapsed, params: { deal: state.deal } });
    }
  }
  function render(animate = true) {
    if (destroyed) return Promise.resolve();
    const state = getState();
    const motion = table.sync(pileState(state), { animate });
    renderChrome(state);
    return motion;
  }

  function announce(text) { message = text; host.querySelector('.fc-message').textContent = text; }
  function applyMove(selection, to) {
    cancelAuto();
    const ok = engine.move(selection.from, to, selection.count);
    if (ok) {
      message = "移动成功。";
      playSound(to.type === 'foundation' ? 'foundation' : 'card-place');
    } else {
      message = "请更换目标位置，或先腾出更多空当。";
      playSound('invalid');
    }
    render();
    return ok;
  }
  async function newGame(deal = null) {
    cancelAuto();
    const number = deal ?? (daily ? utcDeal() : Math.floor(Math.random() * 32000) + 1);
    if (deal !== null) daily = false;
    if (typeof engine.newGame === 'function') await engine.newGame(number);
    else engine = await createFreecell({ deal: number });
    table.select(null);
    closeMenus();
    started = Date.now();
    wonReported = false;
    message = daily ? "所有人今天使用同一局。" : "已发新局，全部牌均为明牌。";
    const state = getState();
    renderChrome(state);
    onStart();
    await table.deal(pileState(state), { from: dealPoint(), order: dealOrder(state), stagger: 14 });
  }
  function showDialog(name) {
    closeMenus();
    const dialog = host.querySelector(`[data-dialog="${name}"]`);
    if (name === 'deal') {
      dialog.querySelector('input').value = String(getState().deal);
      dialog.querySelector('[data-deal-error]').textContent = '';
    }
    dialog.showModal();
    if (name === 'deal') { const input = dialog.querySelector('input'); input.focus(); input.select(); }
  }
  function autoFinish() {
    cancelAuto();
    table.select(null);
    closeMenus();
    let moved = 0;
    const step = () => {
      if (destroyed) return;
      if (engine.autoMove()) {
        moved += 1;
        message = "正在将可安全收起的牌移入回收区…";
        playSound('foundation');
        render();
        autofinishTimer = setTimeout(step, fidelity === 'pixels' ? 90 : 150);
      } else {
        autofinishTimer = null;
        announce(getState().status === 'won' ? "所有牌均已收齐。" : moved ? "已自动收牌，请继续。" : "暂时没有可安全收起的牌，请先腾出位置。");
      }
    };
    step();
  }
  function closeMenus() {
    openMenu = null;
    for (const menu of host.querySelectorAll('.fc-dropdown')) menu.hidden = true;
    for (const trigger of host.querySelectorAll('.fc-menu-trigger')) { trigger.setAttribute('aria-expanded', 'false'); trigger.classList.remove('fc-menu-active'); }
  }
  function action(name) {
    if (name === 'menu-game' || name === 'menu-help') {
      const next = openMenu === name.slice(5) ? null : name.slice(5);
      closeMenus();
      if (next) {
        openMenu = next;
        const trigger = host.querySelector(`[data-action="${name}"]`);
        trigger.setAttribute('aria-expanded', 'true');
        trigger.classList.add('fc-menu-active');
        const menu = host.querySelector(`[data-menu="${next}"]`);
        menu.hidden = false;
        menu.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
      }
      return;
    }
    if (name === 'cancel-dialog') { host.querySelector('dialog[open]')?.close(); return; }
    if (name === 'new') { newGame(); return; }
    if (name === 'deal' || name === 'help' || name === 'about') { showDialog(name); return; }
    cancelAuto();
    closeMenus();
    if (name === 'undo') undo();
    else if (name === 'hint') hint();
    else if (name === 'auto') autoFinish();
  }
  /** Take back one move. Returns whether there was a move to take back. */
  function undo() {
    cancelAuto();
    closeMenus();
    const ok = engine.undo();
    if (ok) { table.select(null); wonReported = false; message = "已撤销一步。"; playSound('undo'); }
    else message = "已回到本局开头。";
    render();
    return ok;
  }
  /** Point at a useful move from the core. Returns whether there was one. */
  function hint() {
    cancelAuto();
    closeMenus();
    table.select(null);
    const suggestion = engine.hint();
    if (!suggestion) { announce("暂无合法走法。可撤销一步试试其他路线。"); return false; }
    const from = toPile(suggestion.from);
    const count = suggestion.count ?? 1;
    const length = suggestion.from.type === 'column' ? getState().columns[suggestion.from.index].length : 1;
    const index = suggestion.from.type === 'column' ? length - count : 0;
    table.showHint({ pile: from, index, count }, toPile(suggestion.to));
    announce(`可将${cardName(cardAt(from, index))}${count > 1 ? " 及其牌组" : ''}移到${locationName(suggestion.to)}。`);
    return true;
  }
  function click(event) {
    const button = event.target.closest('[data-action]');
    if (button && host.contains(button)) { action(button.dataset.action); return; }
    if (openMenu && !event.target.closest('.fc-menu-wrap')) closeMenus();
  }
  function keydown(event) {
    if (destroyed || host.querySelector('dialog[open]') || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && openMenu) {
      event.preventDefault();
      const items = Array.from(host.querySelectorAll(`[data-menu="${openMenu}"] button:not(:disabled)`));
      const current = items.indexOf(document.activeElement);
      items[(current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
    }
    else if (event.key === 'F2') { event.preventDefault(); newGame(); }
    else if (event.key === 'F1') { event.preventDefault(); showDialog('help'); }
    else if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z') { event.preventDefault(); undo(); }
    else if (event.key.toLowerCase() === 'h' && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); action('hint'); }
    else if (event.key === 'Escape') { table.select(null); closeMenus(); announce("已取消选牌。"); }
  }
  function submit(event) {
    if (!event.target.matches('.fc-dialog-form')) return;
    event.preventDefault();
    const value = Number(event.target.elements.deal.value);
    if (!Number.isInteger(value) || value < 1 || value > 32000) {
      event.target.querySelector('[data-deal-error]').textContent = "请输入 1 到 32,000 之间的整数。";
      return;
    }
    event.target.closest('dialog').close();
    newGame(value);
  }
  host.addEventListener('click', click);
  host.addEventListener('submit', submit);
  document.addEventListener('keydown', keydown);
  renderChrome();
  onStart();
  const first = getState();
  await table.deal(pileState(first), { from: dealPoint(), order: dealOrder(first), stagger: 14 });

  return {
    destroy() { destroyed = true; cancelAuto(); table.destroy(); document.removeEventListener('keydown', keydown); host.removeEventListener('click', click); host.removeEventListener('submit', submit); host.remove(); },
    exportReplay() { return typeof engine.replay === 'function' ? engine.replay() : engine.exportReplay(); },
    async loadReplay(replay) { cancelAuto(); engine = await loadFreecellReplay(replay); daily = false; table.select(null); closeMenus(); started = Date.now(); wonReported = false; message = chrome ? '' : "回放已载入，可以接着玩。"; render(false); },
    newGame,
    undo,
    canUndo: () => getState().moves > 0,
    hint,
    state: () => getState(),
    shortcuts: SHORTCUTS,
    setFidelity(value) { fidelity = value === 'pixels' ? 'pixels' : 'crisp'; host.dataset.fidelity = fidelity; table.relayout(); },
    table,
  };
}

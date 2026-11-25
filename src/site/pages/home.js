/**
 * Home: play first. The hero boots straight into a playable game (no splash), with a
 * switcher across every playable game. Below: today's dailies, the collection and secrets.
 */
import { siteGames, playable, findGame } from '../registry.js';
import { mountStage } from '../play/stage.js';
import { getStats } from '../play/stats.js';
import { escape, readStore, writeStore, formatDate, formatTime, todayUTC, prefersReducedMotion } from '../ui/dom.js';
import { icon, gameGlyph } from '../ui/icons.js';

const HERO_KEY = 'stillplay-hero-game';

export function untilReset(now = new Date()) {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const minutes = Math.max(1, Math.round((next - now.getTime()) / 60000));
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} 小时 ${minutes % 60} 分钟` : `${minutes} 分钟`;
}

function heroChoice(games) {
  const fromQuery = new URLSearchParams(location.search).get('game');
  const wanted = fromQuery || readStore(HERO_KEY, null);
  return games.find((game) => game.id === wanted) || games[0];
}

function switcher(games, current) {
  if (games.length < 2) return '';
  return `<div class="switcher" role="tablist" aria-label="选择游戏">${games.map((game) => `<button type="button" role="tab" id="tab-${game.id}" class="switcher-tab" data-game="${game.id}" aria-selected="${game.id === current.id}" aria-controls="hero-panel" tabindex="${game.id === current.id ? 0 : -1}">${gameGlyph(game.icon, 'switcher-glyph')}<span>${escape(game.title)}</span></button>`).join('')}</div>`;
}

function dailyCard(game) {
  const stats = getStats(game.id);
  const result = stats.daily.results[todayUTC()];
  const solved = result !== undefined;
  return `<a class="daily-card${solved ? ' is-solved' : ''}" href="${game.dailyPath}">
    ${gameGlyph(game.icon, 'daily-glyph')}
    <span class="daily-card-text"><strong>每日挑战 · ${escape(game.title)}</strong><small>${solved ? `已完成${result === null ? '' : ` ，用时 ${escape(formatTime(result))}`}` : `今日挑战等你来玩`}</small></span>
    <span class="daily-card-meta">${stats.currentStreak ? `<span class="streak" title="当前每日连胜">${icon('streak', { size: 14 })}${stats.currentStreak}</span>` : ''}${solved ? icon('check', { size: 18, className: 'icon daily-check' }) : icon('arrowRight', { size: 18, className: 'icon daily-arrow' })}</span>
  </a>`;
}

function collectionCard(game) {
  const actions = game.playable
    ? `<div class="game-card-actions"><a class="text-link" href="${game.dailyPath}">每日挑战 · ${icon('arrow', { size: 12 })}</a></div>`
    : `<p class="game-card-status">${escape(game.statusLabel)}</p>`;
  const title = game.routable
    ? `<a class="game-card-link" href="${game.path}">${escape(game.title)}</a>`
    : escape(game.title);
  return `<article class="game-card${game.playable ? '' : ' is-future'}" data-game="${game.id}">
    <div class="game-card-art" data-mini="${game.id}" aria-hidden="true"></div>
    <div class="game-card-body">
      <p class="game-card-number">${game.number}</p>
      <h3>${title}</h3>
      <p class="game-card-tagline">${escape(game.tagline)}</p>
      ${actions}
    </div>
  </article>`;
}

/** Run `task` once `element` comes near the viewport. */
function whenNear(element, task, signal) {
  if (!('IntersectionObserver' in window)) { task(); return; }
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) { observer.disconnect(); if (!signal.aborted) task(); }
  }, { rootMargin: '200px 0px' });
  observer.observe(element);
  signal.addEventListener('abort', () => observer.disconnect());
}

export function render(main) {
  const controller = new AbortController();
  const { signal } = controller;
  const games = playable();
  let current = heroChoice(games);
  let stage = null;
  const all = siteGames();
  const today = todayUTC();

  main.innerHTML = `
  <section class="hero wrap">
    <div class="hero-copy">
      <p class="eyebrow">经典小游戏</p>
      <h1>闲来一局<br><em>随时开玩</em></h1>
      <p class="hero-lede">重温 Windows XP 的经典小游戏。直接选择下方游戏即可开局。</p>
      <p class="hero-note">${icon('lock', { size: 15 })}数据保存在本机。</p>
    </div>
    <div class="hero-play">
      ${switcher(games, current)}
      <div class="hero-stage" id="hero-panel" ${games.length > 1 ? `role="tabpanel" aria-labelledby="tab-${current.id}"` : `aria-label="Play ${escape(current.title)}"`}></div>
      <p class="stage-caption"><span data-caption-number>${current.number} / ${String(all.length).padStart(2, '0')} · ${escape(current.title)}</span><span data-caption-tagline>${escape(current.tagline)}</span></p>
    </div>
  </section>

  <section class="dailies wrap" id="daily" aria-labelledby="daily-heading">
    <div class="section-heading">
      <div><p class="section-kicker">${escape(formatDate(today, { weekday: 'long', day: 'numeric', month: 'long' }))}</p><h2 id="daily-heading">今日挑战</h2></div>
      <p class="section-aside">所有人使用相同的牌局或雷区。距离下次更新还有 <span data-reset>${untilReset()}</span>.</p>
    </div>
    <div class="daily-list">${games.map(dailyCard).join('')}</div>
  </section>

  <section class="collection wrap" id="collection" aria-labelledby="collection-heading">
    <div class="section-heading">
      <div><p class="section-kicker">游戏合集</p><h2 id="collection-heading">五款经典游戏</h2></div>
      <p class="section-aside">${games.length === all.length ? "五款游戏都可以直接玩，各有每日挑战。" : `目前可玩 ${games.length} 款，其他游戏将陆续加入。`}</p>
    </div>
    <div class="game-grid">${all.map(collectionCard).join('')}</div>
  </section>

  <section class="secrets-teaser wrap" aria-labelledby="secrets-heading">
    <div class="section-heading">
      <div><p class="section-kicker">游戏掌故</p><h2 id="secrets-heading">规则里的小秘密</h2></div>
      <a class="text-link" href="/secrets">查看全部掌故 ${icon('arrow', { size: 12 })}</a>
    </div>
    <div class="secrets-grid" data-secrets></div>
  </section>`;

  const panel = main.querySelector('#hero-panel');

  async function play(game, { animate = false } = {}) {
    current = game;
    writeStore(HERO_KEY, game.id);
    for (const tab of main.querySelectorAll('.switcher-tab')) {
      const selected = tab.dataset.game === game.id;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    }
    if (main.querySelector('.switcher')) panel.setAttribute('aria-labelledby', `tab-${game.id}`);
    panel.dataset.game = game.id;
    main.querySelector('[data-caption-number]').textContent = `${game.number} / ${String(all.length).padStart(2, '0')} · ${game.title}`;
    main.querySelector('[data-caption-tagline]').textContent = game.tagline;
    const mountNext = () => mountStage(panel, game, { variant: 'hero', gameElementId: 'hero-game' });
    if (animate && document.startViewTransition && !prefersReducedMotion()) {
      await game.mount().catch(() => {}); // fetch the module first so the swap is quick
      if (signal.aborted || current !== game) return;
      document.documentElement.dataset.transition = 'game-switch';
      const transition = document.startViewTransition(() => Promise.race([mountNext().then((next) => { stage = next; }), new Promise((done) => setTimeout(done, 400))]));
      transition.finished.finally(() => delete document.documentElement.dataset.transition);
      await transition.updateCallbackDone.catch(() => {});
    } else {
      stage = await mountNext();
    }
    if (signal.aborted) stage?.destroy();
  }

  const tabs = main.querySelector('.switcher');
  tabs?.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-game]');
    if (!tab || tab.dataset.game === current.id) return;
    play(findGame(tab.dataset.game), { animate: true }).catch(console.error);
  }, { signal });
  tabs?.addEventListener('keydown', (event) => {
    const list = [...tabs.querySelectorAll('[role="tab"]')];
    const index = list.indexOf(document.activeElement);
    if (index < 0) return;
    const next = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: list.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const tab = list[(next + list.length) % list.length];
    tab.focus();
    tab.click();
  }, { signal });

  play(current).catch((error) => {
    panel.innerHTML = `<div class="loading-game" role="alert">游戏启动失败。${escape(error.message || '')}</div>`;
    console.error(error);
  });

  // Below-the-fold sections load their extras only when they come close.
  whenNear(main.querySelector('.game-grid'), () => {
    import('../minis.js').then(({ drawMini }) => {
      for (const art of main.querySelectorAll('[data-mini]')) art.innerHTML = drawMini(art.dataset.mini);
    }).catch(() => {});
  }, signal);
  whenNear(main.querySelector('[data-secrets]'), () => {
    import('../../secrets.js').then(({ secrets }) => {
      main.querySelector('[data-secrets]').innerHTML = secrets.slice(0, 3).map(secretCard).join('');
    }).catch(() => {});
  }, signal);

  return () => {
    controller.abort();
    stage?.destroy();
  };
}

export function secretCard(secret) {
  return `<a class="secret-link" href="/secrets/${secret.slug}"><div class="secret-art">${secret.art}</div><span class="secret-number">掌故 ${escape(secret.number)}</span><h3>${escape(secret.title)}</h3><p>${escape(secret.description)}</p></a>`;
}

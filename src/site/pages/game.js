/**
 * A game's own page: title, the game in its chrome, then how to play and replay tools.
 * Works for every playable registry entry, regular or daily.
 */
import { parseReplay } from '../../shared.js';
import { mountStage } from '../play/stage.js';
import { escape, download, formatDate, todayUTC } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { showToast } from '../ui/toast.js';

function decodeReplay(encoded) {
  const binary = atob(decodeURIComponent(encoded));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return parseReplay(new TextDecoder().decode(bytes));
}

export function render(main, { game, daily }) {
  const controller = new AbortController();
  const { signal } = controller;
  let stage = null;
  const today = todayUTC();

  main.innerHTML = `
  <section class="play-head wrap">
    <nav class="crumbs" aria-label="导航路径"><a href="/#collection">游戏</a><span aria-hidden="true">/</span>${daily ? `<a href="${game.path}">${escape(game.title)}</a><span aria-hidden="true">/</span><span aria-current="page">每日挑战</span>` : `<span aria-current="page">${escape(game.title)}</span>`}</nav>
    <div class="play-title">
      <h1>${daily ? `每日挑战 · ${escape(game.title)}` : escape(game.title)}</h1>
      <p>${daily ? `${escape(formatDate(today, { weekday: 'long', day: 'numeric', month: 'long' }))}。所有玩家今天使用同一局，每天北京时间 8 点更新。` : escape(game.intro)}</p>
    </div>
  </section>
  <section class="play-area" aria-label="${escape(game.title)}" data-game-stage="${game.id}"></section>
  <section class="play-notes wrap">
    <div class="howto">
      <p class="section-kicker">玩法说明</p>
      ${game.howTo.map((paragraph) => `<p>${escape(paragraph)}</p>`).join('')}
      <p class="howto-small">按 <kbd>?</kbd> 可查看键盘快捷键。游戏规则在本机运行。</p>
    </div>
    <aside class="replay-tools" aria-label="回放">
      <p class="section-kicker">回放</p>
      <p>每一步都会被记录。你可以将牌局保存为文件，或载入回放逐步查看。</p>
      <div class="replay-buttons">
        <button type="button" class="button" id="export-replay">${icon('download', { size: 16 })}保存回放</button>
        <button type="button" class="button" id="import-replay">${icon('upload', { size: 16 })}载入回放</button>
        <input id="replay-input" type="file" accept=".json,application/json" hidden>
      </div>
      <p class="replay-daily"><a class="text-link" href="${daily ? game.path : game.dailyPath}">${daily ? `玩普通局 · ${escape(game.title)}` : `试试今日挑战`} ${icon('arrow', { size: 12 })}</a></p>
    </aside>
  </section>`;

  const area = main.querySelector('.play-area');
  const ready = mountStage(area, game, { daily, variant: 'page', gameElementId: 'full-game' }).then(async (mounted) => {
    stage = mounted;
    if (signal.aborted) { stage.destroy(); return; }
    if (location.hash.startsWith('#replay=')) {
      try {
        const replay = decodeReplay(location.hash.slice(8));
        if (replay.game !== game.id) throw new Error(`请先打开 ${replay.game} 再载入这份回放。`);
        await stage.handle.loadReplay(replay);
        showToast("已载入回放，可以接着玩。");
      } catch {
        showToast("无法读取这个回放链接。");
      }
    }
  }).catch((error) => {
    area.innerHTML = `<div class="wrap loading-game" role="alert">${escape(game.title)} 启动失败。${escape(error.message || '')}</div>`;
    console.error(error);
  });

  main.querySelector('#export-replay').addEventListener('click', async () => {
    await ready;
    try {
      download(`stillplay-${game.id}-replay.json`, JSON.stringify(stage.handle.exportReplay(), null, 2));
    } catch { showToast("当前没有可以保存的回放。"); }
  }, { signal });
  const input = main.querySelector('#replay-input');
  main.querySelector('#import-replay').addEventListener('click', () => input.click(), { signal });
  input.addEventListener('change', async () => {
    try {
      const file = input.files[0];
      if (!file) return;
      if (file.size > 1024 * 1024) throw new Error("回放文件不能超过 1 MiB。");
      const replay = parseReplay(await file.text());
      if (replay.game !== game.id) throw new Error(`请先打开 ${replay.game} 再载入这份回放。`);
      await ready;
      if (typeof stage?.handle?.loadReplay !== 'function') throw new Error("此游戏暂不支持载入回放。");
      await stage.handle.loadReplay(replay);
      showToast("已恢复回放。");
    } catch (error) {
      showToast(error.message);
    } finally {
      input.value = '';
    }
  }, { signal });

  return () => {
    controller.abort();
    stage?.destroy();
  };
}

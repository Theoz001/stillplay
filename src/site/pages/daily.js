/** /daily: today's shared challenges, with your streaks. */
import { playable } from '../registry.js';
import { getStats } from '../play/stats.js';
import { escape, formatDate, formatTime, todayUTC } from '../ui/dom.js';
import { icon, gameGlyph } from '../ui/icons.js';
import { untilReset } from './home.js';

export function render(main) {
  const today = todayUTC();
  const rows = playable().map((game) => {
    const stats = getStats(game.id);
    const result = stats.daily.results[today];
    const solved = result !== undefined;
    return `<li class="daily-row${solved ? ' is-solved' : ''}">
      ${gameGlyph(game.icon, 'daily-glyph')}
      <div class="daily-row-text"><h2><a href="${game.dailyPath}">每日挑战 · ${escape(game.title)}</a></h2><p>${solved ? `今天已完成${result === null ? '' : ` ，用时 ${escape(formatTime(result))}`}。` : `今日挑战尚未完成。`}</p></div>
      <dl class="daily-row-stats"><div><dt>连胜</dt><dd>${stats.currentStreak}</dd></div><div><dt>最佳纪录</dt><dd>${stats.bestStreak}</dd></div></dl>
      <a class="button${solved ? '' : ' button-primary'}" href="${game.dailyPath}" tabindex="-1" aria-hidden="true">${solved ? "再玩一次" : "开始"} ${icon('arrowRight', { size: 16 })}</a>
    </li>`;
  }).join('');
  main.innerHTML = `<section class="page-intro wrap">
    <p class="eyebrow">${escape(formatDate(today, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</p>
    <h1>每日挑战<br><em>同一局，一起玩</em></h1>
    <p>每款游戏每天提供一局相同的挑战。连续完成可以累积连胜天数。距离下一次更新还有 ${untilReset()}；北京时间每天早上 8 点更新。</p>
  </section>
  <section class="wrap"><ul class="daily-rows">${rows}</ul>
  <p class="dialog-note">${icon('lock', { size: 14 })}连胜记录保存在本机。</p></section>`;
}

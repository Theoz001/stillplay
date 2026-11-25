/**
 * Dialogs loaded on demand: the win dialog with sharing, the stats sheet and the shortcut sheet.
 */
import { escape, download, formatTime, formatDate, todayUTC } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { openDialog } from '../ui/dialog.js';
import { showToast } from '../ui/toast.js';
import { getStats, recentDailies } from './stats.js';

const capitalise = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * A link that reproduces the exact game. Games list their own URL parameters on the win
 * summary (`params`, e.g. { deal, suits }); older summaries fall back to deal or seed plus level.
 */
export function gameLink(game, summary) {
  if (summary.daily) return new URL(game.dailyPath, 'https://stillplay.shiptiffin.app');
  const url = new URL(game.path, 'https://stillplay.shiptiffin.app');
  if (summary.params && typeof summary.params === 'object') {
    for (const [key, value] of Object.entries(summary.params)) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    }
    return url;
  }
  if (summary.deal !== undefined) url.searchParams.set('deal', summary.deal);
  else if (summary.seed !== undefined) url.searchParams.set('seed', summary.seed);
  if (summary.level) url.searchParams.set('level', summary.level);
  return url;
}

function detail(summary) {
  const parts = [];
  if (summary.level) parts.push(capitalise(summary.level));
  else if (typeof summary.variant === 'string') parts.push(capitalise(summary.variant));
  if (summary.deal !== undefined && !summary.daily) parts.push(`第 ${summary.deal} 局`);
  if (Number.isInteger(summary.moves)) parts.push(`${summary.moves} 步`);
  if (summary.game === 'minesweeper' && summary.flags === 0) parts.push("未插旗");
  return parts;
}

/** The headline result, in each game's own words: a field is cleared, a deal solved, a game of Hearts won. */
function resultLine(summary) {
  const time = formatTime(summary.elapsedSeconds);
  if (summary.game === 'minesweeper') return `用时 ${time}`;
  if (summary.game === 'hearts' && Array.isArray(summary.scores) && summary.scores.length > 1) {
    const [mine, ...others] = summary.scores;
    return `以 ${mine} 比 ${Math.min(...others)} 获胜${Number.isInteger(summary.hands) ? ` 共 ${summary.hands} 手` : ''}`;
  }
  return `通关用时 ${time}`;
}

export function shareText(game, summary, stats) {
  const heading = summary.daily ? `每日${game.title} · ${formatDate(todayUTC(), { day: 'numeric', month: 'short' })}` : game.title;
  const lines = [`Stillplay · ${heading}`];
  const result = [resultLine(summary), ...detail(summary)].join(' · ');
  lines.push(result);
  if (summary.daily && stats?.currentStreak > 1) lines.push(`每日连胜 ${stats.currentStreak} 天`);
  return lines.join('\n');
}

function encodeReplay(replay) {
  const bytes = new TextEncoder().encode(JSON.stringify(replay));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function copy(text, done, failed) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(done);
    return true;
  } catch {
    showToast(failed);
    return false;
  }
}

/** Seven small squares: which of the last seven dailies were solved. */
function week(game) {
  const days = recentDailies(game.id);
  const label = `每日${game.title}：近七天已完成 ${days.filter((day) => day.solved).length} 次`;
  return `<ol class="week" aria-label="${escape(label)}">${days.map((day) => `<li class="${day.solved ? 'is-solved' : ''}${day.today ? ' is-today' : ''}"><i>${day.solved ? icon('check', { size: 14 }) : ''}</i><span>${escape(formatDate(day.date, { weekday: 'narrow' }))}</span></li>`).join('')}</ol>`;
}

function statCells(stats, { daily }) {
  const cells = [
    ["已玩局数", stats.played],
    ["胜率", stats.winRate === null ? '—' : `${stats.winRate}%`],
    daily ? ["连胜", stats.currentStreak] : ["胜局", stats.won],
    ["最佳用时", formatTime(stats.bestTime)],
  ];
  return `<dl class="stat-row">${cells.map(([label, value]) => `<div><dt>${label}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl>`;
}

/** A 1200 × 630 PNG result card, drawn from SVG on a canvas. */
async function shareCard(game, summary, stats) {
  const text = shareText(game, summary, stats).split('\n');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#f7f5ef"/>
<g fill="#2c6249" transform="translate(80 72)"><path d="M0 0h22v22H0zM30 0h22v22H30zM0 30h22v22H0z"/><path d="M31 31h20v20H31z" fill="none" stroke="#2c6249" stroke-width="2"/></g>
<text x="152" y="113" font-family="Georgia, serif" font-size="40" fill="#2c6249">stillplay.</text>
<text x="80" y="290" font-family="Georgia, serif" font-size="92" letter-spacing="-3" fill="#282e29">你赢了！</text>
<text x="80" y="380" font-family="Helvetica, Arial, sans-serif" font-size="34" fill="#2c6249">${escape(text[1].replace('Stillplay · ', ''))}</text>
<text x="80" y="432" font-family="Helvetica, Arial, sans-serif" font-size="28" fill="#62695e">${escape(text[0].replace('Stillplay · ', ''))}${text[2] ? ` · ${escape(text[2])}` : ''}</text>
<path d="M80 520h1040" stroke="#dcded3" stroke-width="2"/>
<text x="80" y="566" font-family="Helvetica, Arial, sans-serif" font-size="24" fill="#62695e">${escape(gameLink(game, summary).host)}${escape(gameLink(game, summary).pathname)}</text>
</svg>`;
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 630;
  canvas.getContext('2d').drawImage(image, 0, 0);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

export function showWin({ game, summary, stats, handle, onAgain }) {
  const replay = summary.replay || (() => { try { return handle?.exportReplay?.(); } catch { return null; } })();
  const link = gameLink(game, summary).href;
  const text = shareText(game, summary, stats);
  const streak = summary.daily && stats.currentStreak
    ? `<p class="win-streak">${icon('streak', { size: 16 })}<span>${stats.currentStreak === 1 ? "连胜第 1 天。" : `已连续获胜 ${stats.currentStreak} 天。`}${stats.bestStreak > stats.currentStreak ? ` 最佳纪录：${stats.bestStreak}。` : stats.currentStreak > 1 ? " 刷新个人纪录。" : ''}</span></p>`
    : '';
  const facts = detail(summary);
  openDialog({
    title: summary.daily ? "已完成今日挑战" : "你赢了",
    className: 'dialog-win',
    html: `
      <div class="win-hero">
        <p class="win-kicker">${escape(summary.daily ? `每日挑战 · ${game.title}` : game.title)}</p>
        <p class="win-time"><span class="sr-only">用时： </span>${escape(formatTime(summary.elapsedSeconds))}</p>
        ${facts.length ? `<p class="win-facts">${escape(facts.join(' · '))}</p>` : ''}
        ${streak}
      </div>
      ${statCells(stats, { daily: summary.daily })}
      ${summary.daily ? week(game) : ''}
      <div class="share-preview" aria-label="分享文字">${escape(text)}<br><span>${escape(link)}</span></div>
      <div class="dialog-actions">
        <button type="button" class="button button-primary" data-share autofocus>${icon('share', { size: 16 })}分享成绩</button>
        ${typeof handle?.newGame === 'function' ? `<button type="button" class="button win-again" data-again>${icon('new', { size: 16 })}${summary.daily ? "再玩一次" : "新游戏"}</button>` : ''}
        <button type="button" class="button" data-copy-replay ${replay ? '' : 'hidden'}>${icon('link', { size: 16 })}复制回放链接</button>
        <button type="button" class="button" data-save-replay ${replay ? '' : 'hidden'}>${icon('download', { size: 16 })}保存回放</button>
        <button type="button" class="button" data-save-card>${icon('image', { size: 16 })}保存图片</button>
      </div>`,
    onOpen(dialog) {
      dialog.querySelector('[data-share]').onclick = async () => {
        const data = { title: `Stillplay · ${game.title}`, text, url: link };
        if (navigator.share && (!navigator.canShare || navigator.canShare(data))) {
          try { await navigator.share(data); return; } catch (error) { if (error?.name === 'AbortError') return; }
        }
        copy(`${text}\n${link}`, "已复制成绩。", "请选择上方文字并复制。");
      };
      dialog.querySelector('[data-copy-replay]').onclick = () => copy(`${link}#replay=${encodeReplay(replay)}`, "已复制回放链接。", "可以保存回放文件，分享这局游戏。");
      dialog.querySelector('[data-save-replay]').onclick = () => download(`stillplay-${game.id}-replay.json`, JSON.stringify(replay, null, 2));
      const again = dialog.querySelector('[data-again]');
      if (again) again.onclick = () => { dialog.close(); onAgain?.(); };
      dialog.querySelector('[data-save-card]').onclick = async () => {
        try { download(`stillplay-${game.id}.png`, await shareCard(game, summary, stats)); } catch { showToast("此处无法生成图片。"); }
      };
    },
  });
}

export function showStats(game) {
  const stats = getStats(game.id);
  const variants = Object.entries(stats.best);
  const today = stats.daily.results[todayUTC()];
  openDialog({
    title: `${game.title}统计`,
    className: 'dialog-stats',
    html: `
      ${statCells(stats, { daily: false })}
      <div class="stat-streaks">
        <div>${icon('streak', { size: 18 })}<strong>${stats.currentStreak}</strong><span>当前每日连胜</span></div>
        <div>${icon('daily', { size: 18 })}<strong>${stats.bestStreak}</strong><span>最高每日连胜</span></div>
      </div>
      ${week(game)}
      <p class="stat-today">${today === undefined ? `今日挑战等你来玩。` : `今日挑战已完成${today === null ? '' : ` ，用时 ${escape(formatTime(today))}`}。`}${game.dailyPath ? ` <a class="text-link" href="${game.dailyPath}">${today === undefined ? "开始挑战" : "再玩一次"} ${icon('arrow', { size: 12 })}</a>` : ''}</p>
      ${variants.length > 1 ? `<table class="stat-table"><caption>最佳用时</caption><tbody>${variants.map(([variant, time]) => `<tr><th scope="row">${escape(variant === 'default' ? "全部" : capitalise(variant))}</th><td>${escape(formatTime(time))}</td></tr>`).join('')}</tbody></table>` : ''}
      <p class="dialog-note">${icon('lock', { size: 14 })}数据保存在这台设备上。</p>`,
  });
}

const SHELL_KEYS = [['?', "查看快捷键"], ['M', "开关音效"], ['S', "游戏统计"], ['Z', "专注模式"], ['P', "切换像素或清晰牌面"], ['Esc', "退出专注模式"]];

/** The shell's own keys, minus any the game has claimed (the game's meaning wins on its page). */
export function shellKeys(claimed = new Set()) {
  return SHELL_KEYS.filter(([key]) => !claimed.has(key.toLowerCase()));
}

export function showShortcuts(game, handle, claimed = new Set()) {
  const own = Array.isArray(handle?.shortcuts) ? handle.shortcuts : game.shortcuts;
  const shell = shellKeys(claimed);
  const clicksOnly = SHELL_KEYS.filter(([key]) => claimed.has(key.toLowerCase())).map(([, label]) => label.toLowerCase());
  const isKey = (token) => /^([A-Z0-9?]|F\d{1,2}|Esc|Enter|Space|Tab|Shift|Ctrl.*|⌘.*|Arrow keys)$/.test(token);
  const keyMarkup = (token) => token.split(' + ').map((part) => (isKey(part) ? `<kbd>${escape(part)}</kbd>` : `<span>${escape(part)}</span>`)).join(' + ');
  const list = (rows) => `<dl class="key-list">${rows.map(([keys, label]) => `<div><dt>${keys.split(/ · | or /).map(keyMarkup).join('<span class="key-or">or</span>')}</dt><dd>${escape(label)}</dd></div>`).join('')}</dl>`;
  openDialog({
    title: "键盘快捷键",
    className: 'dialog-keys',
    html: `${own.length ? `<h3>${escape(game.title)}</h3>${list(own)}` : ''}<h3>通用</h3>${list(shell)}${clicksOnly.length ? `<p class="dialog-note">在${escape(game.title)}中，${escape(clicksOnly.join(' and '))}和${clicksOnly.length > 1 ? 'are' : 'is'}可在工具栏操作。</p>` : ''}`,
  });
}

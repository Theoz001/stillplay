/**
 * Page titles, descriptions and Open Graph copy. The router uses it for document.title
 * and scripts/build.mjs uses it to write per-route HTML, OG images, the sitemap and JSON-LD.
 * Pure data and string work only: it must run in Node as well as the browser.
 */
import { siteGames } from './registry.js';

export const SITE_NAME = 'Stillplay';
export const TAGLINE = "经典小游戏";
const suffix = ` — ${SITE_NAME}`;

const fixed = {
  '/': {
    title: `${SITE_NAME} · 经典小游戏`,
    description: "重温 Windows XP 上的扫雷、蜘蛛纸牌、空当接龙等游戏，支持每日挑战。",
    og: { kicker: "经典小游戏", heading: "闲来一局", accent: "随时开玩", art: 'home' },
  },
  '/daily': {
    title: `今日挑战${suffix}`,
    description: "每天都有相同的牌局或雷区，连续获胜可以累积连胜天数。",
    og: { kicker: "每日挑战", heading: "每日挑战", accent: "同一局，一起玩", art: 'daily' },
  },
  '/about': {
    title: `关于${suffix}`,
    description: "了解 Stillplay 的制作、玩法和本地运行方式。",
    og: { kicker: "关于本项目", heading: "值得珍藏的", accent: "经典游戏", art: 'home' },
  },
  '/secrets': {
    title: `游戏掌故${suffix}`,
    description: "关于规则、牌局编号和经典游戏的小知识。",
    og: { kicker: "游戏掌故", heading: "小游戏", accent: "掌故", art: 'secrets' },
  },
};

function gamePage(game, daily) {
  if (!game.playable) {
    return {
      title: `${game.title}即将推出${suffix}`,
      description: `${game.title}即将加入 Stillplay。${game.tagline}`,
      og: { kicker: "即将推出", heading: game.title, accent: game.tagline, art: game.id },
    };
  }
  if (daily) {
    return {
      title: `每日挑战 · ${game.title}${suffix}`,
      description: `今天的${game.title}：${game.dailyNoun}。每天北京时间早上 8 点更新。`,
      og: { kicker: "每日挑战", heading: `每日挑战 · ${game.title}`, accent: "今日挑战人人相同", art: game.id },
      game,
    };
  }
  return {
    title: `${game.title}${suffix}`,
    description: game.description || `${game.title}。${game.tagline}`,
    og: { kicker: "本机免费畅玩", heading: game.title, accent: game.tagline, art: game.id },
    game,
  };
}

/** Metadata for one path, or null when the path is not a known page. */
export function pageMeta(path, { secrets = [] } = {}) {
  if (fixed[path]) return fixed[path];
  const games = siteGames();
  const game = games.find((item) => item.path === path);
  if (game) return gamePage(game, false);
  const daily = path.match(/^\/daily\/([\w-]+)$/);
  if (daily) {
    const dailyGame = games.find((item) => item.id === daily[1] && item.playable);
    if (dailyGame) return gamePage(dailyGame, true);
  }
  const secret = path.match(/^\/secrets\/([\w-]+)$/);
  if (secret) {
    const entry = secrets.find((item) => item.slug === secret[1]);
    if (entry) {
      return {
        title: `${entry.title.replace(/\.$/, '')}${suffix}`,
        description: entry.description,
        og: { kicker: `掌故 ${entry.number}`, heading: entry.title, accent: '', art: 'secrets' },
      };
    }
  }
  return null;
}

/** Every page the build writes, in sitemap order. */
export function allPaths({ secrets = [] } = {}) {
  const games = siteGames();
  return [
    '/',
    ...games.filter((game) => game.playable).map((game) => game.path),
    '/daily',
    ...games.filter((game) => game.playable).map((game) => game.dailyPath),
    ...games.filter((game) => !game.playable && game.routable).map((game) => game.path),
    '/secrets',
    ...secrets.map((secret) => `/secrets/${secret.slug}`),
    '/about',
  ];
}

/** Structured data for search engines. */
export function jsonLd(path, origin, meta) {
  const url = new URL(path, origin).href;
  if (path === '/') {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: SITE_NAME,
      url,
      description: meta.description,
      applicationCategory: 'GameApplication',
      operatingSystem: 'Any (runs in a web browser)',
      browserRequirements: 'Requires JavaScript and WebAssembly',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    };
  }
  if (meta.game) {
    return {
      '@context': 'https://schema.org',
      '@type': 'VideoGame',
      name: meta.game.title,
      url,
      description: meta.description,
      genre: meta.game.genre,
      gamePlatform: 'Web browser',
      applicationCategory: "游戏",
      operatingSystem: 'Any (runs in a web browser)',
      playMode: 'SinglePlayer',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      publisher: { '@type': 'Organization', name: SITE_NAME },
    };
  }
  return null;
}

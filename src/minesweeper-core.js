// Our own Minesweeper rules, executed by the same WebAssembly in browser and Node.

const LEVELS = ['beginner', 'intermediate', 'expert'];
const STATUSES = ['ready', 'playing', 'won', 'lost'];
const ACTIONS = new Set(['reveal', 'flag', 'chord']);
const MAX_ACTIONS = 100_000;
let compiledModule;

async function getModule() {
  if (!compiledModule) {
    compiledModule = (async () => {
      const url = new URL('../cores/minesweeper.wasm', import.meta.url);
      let bytes;
      if (typeof process !== 'undefined' && process.versions?.node) {
        const { readFile } = await import('node:fs/promises');
        bytes = await readFile(url);
      } else {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`无法载入扫雷（${response.status}）。`);
        bytes = await response.arrayBuffer();
      }
      return WebAssembly.compile(bytes);
    })().catch((error) => {
      compiledModule = undefined;
      throw error;
    });
  }
  return compiledModule;
}

function checkOptions(level, seed) {
  if (!LEVELS.includes(level)) throw new RangeError(`未知扫雷难度：${level}`);
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffff_ffff) {
    throw new RangeError("种子必须是 32 位无符号整数。");
  }
}

function validateReplay(replay) {
  if (!replay || replay.version !== 1 || replay.game !== 'minesweeper') {
    throw new TypeError("回放须为第 1 版扫雷回放。");
  }
  checkOptions(replay.level, replay.seed);
  if (!Array.isArray(replay.actions) || replay.actions.length > MAX_ACTIONS) {
    throw new RangeError(`最多支持 ${MAX_ACTIONS} 步的回放。`);
  }
  const width = replay.level === 'beginner' ? 9 : replay.level === 'intermediate' ? 16 : 30;
  const height = replay.level === 'beginner' ? 9 : 16;
  let previousTime = 0;
  for (const action of replay.actions) {
    if (!action || !ACTIONS.has(action.type) || !Number.isInteger(action.x) ||
        !Number.isInteger(action.y) || action.x < 0 || action.x >= width ||
        action.y < 0 || action.y >= height || !Number.isSafeInteger(action.t) ||
        action.t < previousTime) {
      throw new TypeError("回放必须包含有效格子，操作时间须按毫秒递增。");
    }
    previousTime = action.t;
  }
  return replay;
}

export async function createMinesweeper({ level = 'beginner', seed = 1 } = {}) {
  checkOptions(level, seed);
  const core = new WebAssembly.Instance(await getModule(), {}).exports;
  let actions = [];
  let startedAt = 0;
  let lastTime = 0;

  function state() {
    const width = core.ms_width();
    const height = core.ms_height();
    const cells = Array.from({ length: width * height }, (_, index) => {
      const value = core.ms_cell(index);
      return {
        mine: Boolean(value & 1),
        adjacent: value >> 3,
        revealed: Boolean(value & 2),
        flagged: Boolean(value & 4),
      };
    });
    return {
      width, height, mines: core.ms_mines(), status: STATUSES[core.ms_status()], cells,
      flags: core.ms_flags(), revealed: core.ms_revealed(), seed: core.ms_seed() >>> 0,
      level: LEVELS[core.ms_level()],
    };
  }

  function newGame({ level: nextLevel = LEVELS[core.ms_level()] ?? level,
    seed: nextSeed = core.ms_seed() >>> 0 } = {}) {
    checkOptions(nextLevel, nextSeed);
    core.ms_new_game(LEVELS.indexOf(nextLevel), nextSeed);
    actions = [];
    startedAt = Date.now();
    lastTime = 0;
    return state();
  }

  function perform(type, x, y, time) {
    const width = core.ms_width();
    const height = core.ms_height();
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= width || y < 0 || y >= height) {
      return state();
    }
    if (actions.length >= MAX_ACTIONS) throw new RangeError("已达到回放步数上限。");
    lastTime = time ?? Math.max(lastTime, Date.now() - startedAt);
    actions.push({ type, x, y, t: lastTime });
    core[`ms_${type}`](x, y);
    return state();
  }

  function replay() {
    return { version: 1, game: 'minesweeper', level: LEVELS[core.ms_level()],
      seed: core.ms_seed() >>> 0, actions: actions.map((action) => ({ ...action })) };
  }

  function restoreReplay(value) {
    // Validate the entire input before replacing an existing game.
    validateReplay(value);
    // Copy first, so callers may safely pass this instance's own exported replay.
    const copy = value.actions.map((action) => ({ ...action }));
    newGame({ level: value.level, seed: value.seed });
    for (const action of copy) perform(action.type, action.x, action.y, action.t);
    return state();
  }

  core.ms_new_game(LEVELS.indexOf(level), seed);
  startedAt = Date.now();
  return {
    newGame,
    reveal: (x, y) => perform('reveal', x, y),
    flag: (x, y) => perform('flag', x, y),
    chord: (x, y) => perform('chord', x, y),
    state, replay,
    loadReplay: restoreReplay,
  };
}

export async function loadReplay(replay) {
  validateReplay(replay);
  const game = await createMinesweeper({ level: replay.level, seed: replay.seed });
  game.loadReplay(replay);
  return game;
}

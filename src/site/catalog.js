/**
 * Site copy for each game, keyed by registry id. Pure data, so the build script can read it too.
 * The registry in src/games.js stays the source of truth for which games exist and which can be played.
 */
export const copy = {
  minesweeper: {
    intro: "根据数字推断地雷的位置。第一次点击一定安全。",
    loading: "正在布置雷区…",
    howTo: [
      "翻开所有没有地雷的方格。数字表示周围八格中埋有几颗地雷。",
      "右键、长按或按 F 标记地雷。某个数字周围已插够旗子时，点击它可以翻开相邻的其他方格。",
    ],
    dailyNoun: '雷区',
    description: "扫雷提供初级、中级、高级和每日挑战，支持保存回放。",
    genre: "益智游戏",
  },
  freecell: {
    intro: "八列明牌，四个可临时放牌的空位。几乎每一局都有解。",
    loading: "正在发牌…",
    howTo: [
      "把同花色的牌从 A 到 K 依次移入回收区。牌列中按点数递减、红黑交替叠放。",
      "每个空当可暂放一张牌。空当和空列越多，一次能移动的连续牌就越多。输入牌局编号可以重玩同一局。",
    ],
    dailyNoun: '牌局',
    description: "按编号选择空当接龙牌局，体验著名的第 11982 局。支持每日挑战、撤销、提示和回放。",
    genre: "纸牌游戏",
  },
  solitaire: {
    intro: "可选翻一张或翻三张。把四种花色分别从 A 到 K 收齐。",
    loading: "正在洗牌…",
    howTo: [
      "将同花色的牌从 A 到 K 依次移入回收区。七列牌按点数递减、红黑交替叠放。盖住的牌露出后就能翻开。",
      "只有 K 或以 K 开头的一组牌能移入空列。无牌可移时，点击牌库翻牌。",
    ],
    dailyNoun: '牌局',
    description: "经典接龙支持翻一张、翻三张和每日挑战。",
    genre: "纸牌游戏",
  },
  spider: {
    intro: "两副牌排成十列。同花色从 K 接到 A，即可收走整组。",
    loading: "正在发牌…",
    howTo: [
      "牌可以接在比它大一点的牌下方，花色不限。同花色的连续牌可以整组移动；从 K 接到 A 就能收走一组。",
      "十列都有牌时，点击牌库可给每列发一张牌。初玩可选单花色，之后再试双花色和四花色。",
    ],
    dailyNoun: '牌局',
    description: "蜘蛛纸牌提供单花色、双花色、四花色和每日挑战。",
    genre: "纸牌游戏",
  },
  hearts: {
    intro: "与三名电脑玩家对局。尽量少收红心，尤其要避开黑桃 Q。",
    loading: "正在准备对局…",
    howTo: [
      "有相同花色就必须跟牌。首引花色中点数最大的牌收走这一墩。每张红心计 1 分，黑桃 Q 计 13 分。",
      "一手收齐所有红心和黑桃 Q，另外三家各得 26 分。有人达到 100 分时结束，分数最低者胜。",
    ],
    dailyNoun: '牌局',
    description: "与三名电脑玩家玩红心大战，也可参加每日挑战。",
    genre: "纸牌游戏",
  },
};

export const fallbackCopy = {
  intro: '', loading: "正在准备…", howTo: [], shortcuts: [], dailyNoun: '游戏', description: '', genre: "游戏",
};

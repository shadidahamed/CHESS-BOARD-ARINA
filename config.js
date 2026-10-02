// config.js
export const PRODUCT_NAME = "CHESS ARENA";

export const SUPABASE_URL = "YOUR_SUPABASE_URL";
export const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

export const GAME_CONFIG = {
  max1v1: 2,
  max4p: 4,
  invitationExpiryHours: 24,
  debug: false
};

export const TIME_CONTROL_PRESETS = {
  "1+0":  { initial: 60,  increment: 0 },
  "3+2":  { initial: 180, increment: 2 },
  "5+0":  { initial: 300, increment: 0 },
  "5+3":  { initial: 300, increment: 3 },
  "10+0": { initial: 600, increment: 0 },
  "15+10":{ initial: 900, increment: 10 }
};

export const AI_DIFFICULTY = {
  Beginner:     { depth: 2,  multipv: 1 },
  Easy:         { depth: 4,  multipv: 1 },
  Casual:       { depth: 6,  multipv: 2 },
  Intermediate: { depth: 10, multipv: 2 },
  Advanced:     { depth: 14, multipv: 3 },
  Expert:       { depth: 18, multipv: 3 },
  Master:       { depth: 22, multipv: 4 },
  Maximum:      { depth: 28, multipv: 5 }
};

export const AI_STYLES = {
  Balanced:   { captureBias: 0.0, checkBias: 0.0, centerBias: 0.1, risk: 0.0 },
  Aggressive: { captureBias: 0.45, checkBias: 0.35, centerBias: 0.15, risk: 0.3 },
  Defensive:  { captureBias: -0.25, checkBias: -0.1, centerBias: -0.05, risk: -0.4 },
  Tactical:   { captureBias: 0.5, checkBias: 0.4, centerBias: 0.0, risk: 0.2 },
  Positional: { captureBias: -0.1, checkBias: 0.0, centerBias: 0.4, risk: -0.2 },
  Risky:      { captureBias: 0.15, checkBias: 0.2, centerBias: 0.0, risk: 0.7 }
};

export const FOUR_PLAYER_RULES = {
  boardSize: 14,
  playableSquares: 160,
  colors: ["red", "blue", "yellow", "green"],
  turnOrder: ["red", "blue", "yellow", "green"],
  scoring: {
    pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9,
    checkmate: 20, elimination: 10, survivalBonus: 5
  }
};

export const SCORING = {
  "1v1": { win: 12, draw: 4, loss: 0, ratingK: 32 },
  "4p":  { "1st": 30, "2nd": 15, "3rd": 6, "4th": 0 }
};

export const QUOTES = {
  queen: [
    "রানী নিজের জীবন দিয়েছে রাজার জন্য। The most precious piece falls so the king may live.",
    "Queen sacrificed. Some weights are heavier than any gym can measure.",
    "যে হাস্যেটা তোমার জন্য মেন্ট করা ছিল — সেটা এখন আর তোমার নয়।"
  ],
  rook: [
    "দুর্গ ভেঙে গেল। The fortress falls, yet the story continues.",
    "রুক চলে গেল। কখনো কখনো দেয়ালই সবচেয়ে বড় ত্যাগ।"
  ],
  knight: [
    "অশ্বারোহী পড়ে গেল। The knight’s leap ends in silence."
  ],
  bishop: [
    "বিশপের কর্ণার শেষ। The diagonal is broken."
  ],
  pawn: [
    "একটা সাধারণ সোলজার। রাজার জন্য জীবন দিল।",
    "Pawn falls. The smallest soldier carries the heaviest meaning."
  ],
  check: [
    "চেক। The king feels the weight."
  ],
  mate: [
    "চেকমেট। The story ends here — for now.",
    "খেলা শেষ। কিছু যুদ্ধ জেতা যায়, কিছু শুধু শেখা যায়।"
  ],
  start: [
    "প্রতিটি পদক্ষেপ একটা গল্প বলে।",
    "The board is quiet. The first move is always the heaviest."
  ]
};

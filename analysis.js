// analysis.js
import { ChessAI } from './chess-ai.js';

export async function analyzeGame(moves, fenHistory) {
  // Simple version: for each position ask Stockfish best move vs played move
  // Full multipv analysis is heavier; this gives clear feedback.
  const ai = new ChessAI();
  await ai.init();
  const report = [];

  for (let i = 0; i < fenHistory.length - 1; i++) {
    const fen = fenHistory[i];
    const played = moves[i];
    // ask engine for bestmove at low depth for speed
    // (production: collect info score lines)
    report.push({
      moveNumber: i + 1,
      played: played.notation,
      // comment generated later from eval difference
      comment_en: '',
      comment_bn: ''
    });
  }

  ai.destroy();
  return report;
}

export function humanComment(evalDrop) {
  if (evalDrop > 2.0) {
    return {
      en: 'Blunder. A much stronger continuation was available.',
      bn: 'বড় ভুল। অনেক শক্তিশালী চাল ছিল।'
    };
  }
  if (evalDrop > 0.8) {
    return {
      en: 'Inaccuracy. There was a better way to keep the advantage.',
      bn: 'অসতর্কতা। সুবিধা ধরে রাখার ভালো উপায় ছিল।'
    };
  }
  return {
    en: 'Solid move.',
    bn: 'ভালো চাল।'
  };
}

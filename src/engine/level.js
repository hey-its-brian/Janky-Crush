// Level setup and goal tracking. Pure logic, shared by the game and the
// level-tuning simulator.

import { Board } from './board.js';

// Layout characters, one per cell (9 strings of 9):
//   ' '  not part of the board
//   '.'  plain cell
//   '1'  one layer of jelly
//   '2'  two layers of jelly
export function parseLayout(layout) {
  const mask = layout.map((row) => [...row].map((ch) => ch !== ' '));
  const jelly = layout.map((row) => [...row].map((ch) => (ch === '1' ? 1 : ch === '2' ? 2 : 0)));
  return { rows: layout.length, cols: layout[0].length, mask, jelly };
}

export function setupBoard(level, rng) {
  const { rows, cols, mask, jelly } = parseLayout(level.layout);
  const board = new Board({ rows, cols, mask, colors: level.colors, rng });
  board.jelly = jelly;
  board.fillInitial();
  if (level.goal.type === 'ingredients') {
    const { count } = level.goal;
    const maxOnBoard = level.goal.maxOnBoard ?? Math.min(3, count);
    board.setExits();
    const first = Math.min(count, maxOnBoard);
    board.placeIngredients(first);
    board.spawner = { remaining: count - first, maxOnBoard, chance: 0.5 };
    // Ingredients replace candies, which can use up the only legal move.
    if (!board.findPossibleMove()) board.shuffle();
  }
  return board;
}

export class LevelState {
  constructor(level, board) {
    this.level = level;
    this.board = board;
    this.moves = level.moves;
    this.score = 0;
    this.collected = 0;
    // For the end-of-level review.
    this.stats = { striped: 0, wrapped: 0, bomb: 0, bestCascade: 0, foamCleared: 0, bonus: 0 };
    this.inBonus = false;
  }

  // Tally what a step did: specials made, the longest chain, jelly
  // cleared, and points earned in the end-of-level bonus.
  noteStep(step, cascade, points) {
    const st = this.stats;
    st.foamCleared += step.jellyHit.length;
    if (this.inBonus) {
      st.bonus += points;
      return;
    }
    st.bestCascade = Math.max(st.bestCascade, cascade);
    for (const m of step.created) {
      if (m.special === 'bomb') st.bomb++;
      else if (m.special === 'wrapped') st.wrapped++;
      else st.striped++;
    }
  }

  get goal() {
    return this.level.goal;
  }

  jellyLeft() {
    return this.board.jellyCount();
  }

  ingredientsLeft() {
    return this.goal.type === 'ingredients' ? this.goal.count - this.collected : 0;
  }

  // Jelly and ingredient levels end the moment the goal is met. Score
  // levels always play out every move.
  isComplete() {
    switch (this.goal.type) {
      case 'jelly':
        return this.jellyLeft() === 0;
      case 'ingredients':
        return this.ingredientsLeft() <= 0;
      default:
        return false;
    }
  }

  isOver() {
    return this.isComplete() || this.moves <= 0;
  }

  won() {
    return this.goal.type === 'score' ? this.score >= this.level.stars[0] : this.isComplete();
  }

  stars() {
    if (!this.won()) return 0;
    return Math.max(1, this.level.stars.filter((s) => this.score >= s).length);
  }
}

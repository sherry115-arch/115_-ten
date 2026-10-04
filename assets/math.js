(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NumberStage = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function createGame(target) {
    if (!Number.isInteger(target) || target < 10 || target > 18) throw new RangeError('Invalid target');
    const cards = Array.from({ length: 20 }, (_, id) => ({ id, value: id % 10 }));
    let selected = [], won = false, stars = 0;
    function snapshot() {
      const sum = selected.reduce((total, id) => total + cards[id].value, 0);
      return { target, cards: cards.map(card => ({ ...card })), selected: [...selected], sum, won, stars,
        status: won ? 'success' : !selected.length ? 'empty' : sum > target ? 'over' : 'under' };
    }
    function add(id) {
      if (won || !Number.isInteger(id) || id < 0 || id >= cards.length || selected.includes(id)) return false;
      selected.push(id);
      if (snapshot().sum === target) { won = true; stars++; }
      return true;
    }
    function remove(id) {
      if (won || !selected.includes(id)) return false;
      selected = selected.filter(value => value !== id);
      if (selected.length && snapshot().sum === target) { won = true; stars++; }
      return true;
    }
    function reset() { selected = []; won = false; }
    return { snapshot, add, remove, reset };
  }
  return { createGame };
});

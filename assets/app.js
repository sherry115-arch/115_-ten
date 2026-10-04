(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const soundButton = $('sound-toggle');
  let soundOn = true, fontStep = 0, audioContext, master;
  try { soundOn = localStorage.getItem('number-stage-sound') !== 'off'; fontStep = Number(localStorage.getItem('number-stage-font')) || 0; } catch (_) {}
  if (![0, 1, 2].includes(fontStep)) fontStep = 0;
  function settings() {
    soundButton.textContent = soundOn ? '♪ 音效開' : '♪ 音效關';
    soundButton.setAttribute('aria-pressed', String(soundOn));
    document.documentElement.style.setProperty('--font-scale', [1, 1.12, 1.24][fontStep]);
    $('font-toggle').textContent = ['字體：標準', '字體：大', '字體：更大'][fontStep];
    if (master) master.gain.value = soundOn ? 0.2 : 0;
    try { localStorage.setItem('number-stage-sound', soundOn ? 'on' : 'off'); localStorage.setItem('number-stage-font', String(fontStep)); } catch (_) {}
  }
  function unlockAudio() {
    if (!soundOn) return;
    try {
      const AudioClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioClass) return;
      if (!audioContext) { audioContext = new AudioClass(); master = audioContext.createGain(); master.gain.value = .2; master.connect(audioContext.destination); }
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    } catch (_) {}
  }
  function play(kind) {
    unlockAudio();
    if (!soundOn || !audioContext || !master) return;
    const notes = kind === 'success' ? [[523.25,0,.14],[659.25,.14,.14],[783.99,.28,.14],[1046.5,.42,.42]]
      : kind === 'over' ? [[293.66,0,.12],[261.63,.13,.2]]
      : kind === 'remove' ? [[392,0,.09]] : [[659.25,0,.09]];
    try {
      notes.forEach(([hz, delay, duration]) => {
        const oscillator = audioContext.createOscillator(), envelope = audioContext.createGain();
        const start = audioContext.currentTime + delay;
        oscillator.type = 'sine'; oscillator.frequency.value = hz;
        envelope.gain.setValueAtTime(0, start); envelope.gain.linearRampToValueAtTime(.7, start + .01);
        envelope.gain.exponentialRampToValueAtTime(.001, start + duration);
        oscillator.connect(envelope); envelope.connect(master);
        oscillator.start(start); oscillator.stop(start + duration + .02);
        oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
      });
    } catch (_) {}
  }
  soundButton.addEventListener('click', () => { soundOn = !soundOn; settings(); if (soundOn) play('add'); });
  $('font-toggle').addEventListener('click', () => { fontStep = (fontStep + 1) % 3; settings(); });
  settings();
  const target = Number(document.body.dataset.target);
  if (!target) return;
  const game = window.NumberStage.createGame(target);
  const dropZone = $('drop-zone'), stageCards = $('stage-cards');
  const bankButtons = [...document.querySelectorAll('.number-card')];
  let drag = null, blockClickUntil = 0, cleanupTimer;
  function render() {
    const state = game.snapshot();
    bankButtons.forEach(button => {
      const used = state.selected.includes(Number(button.dataset.cardId));
      button.disabled = used || state.won;
      button.classList.toggle('used', used);
      button.setAttribute('aria-label', `${button.dataset.value}，第${Number(button.dataset.cardId) < 10 ? '一' : '二'}組${used ? '，已在舞台上' : '，加入舞台'}`);
    });
    stageCards.replaceChildren();
    state.selected.forEach((id) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'stage-card'; button.dataset.cardId = id;
      button.textContent = state.cards[id].value;
      button.setAttribute('aria-label', `取回數字 ${state.cards[id].value}`);
      button.disabled = state.won; stageCards.append(button);
    });
    $('empty-stage').hidden = state.selected.length > 0;
    $('equation').textContent = state.selected.length ? `${state.selected.map(id => state.cards[id].value).join(' ＋ ')} ＝ ${state.sum}` : '？ ＋ ？ ＝ ' + target;
    $('current-total').textContent = state.sum;
    $('score').textContent = `已收集 ${state.stars} 顆星`;
    $('score-stars').textContent = '★'.repeat(Math.min(state.stars, 5)) + '☆'.repeat(Math.max(0, 5 - state.stars));
    $('clear-stage').disabled = !state.selected.length || state.won;
    $('undo').disabled = !state.selected.length || state.won;
    $('next-round').hidden = !state.won;
    dropZone.dataset.state = state.status;
    const messages = {
      empty: ['準備好了嗎？', '拖數字進舞台，也可以直接點一下。'],
      under: ['再找一找！', `現在是 ${state.sum}，再加 ${target - state.sum} 就到了。`],
      over: ['多了一點點！', `現在是 ${state.sum}，比 ${target} 多 ${state.sum - target}。點舞台上的數字取回，再試試。`],
      success: ['成功！你做到了！', `合起來剛好是 ${target}，得到一顆星！`]
    };
    $('feedback-title').textContent = messages[state.status][0];
    $('feedback-detail').textContent = messages[state.status][1];
    $('feedback').dataset.state = state.status;
    $('success-badge').hidden = !state.won;
    $('stage-caption').textContent = state.won ? '太棒了！換一種組合再挑戰。' : '點舞台上的數字，就能取回。';
  }
  function celebrate() {
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    $('confetti').replaceChildren();
    if (!reduced) {
      for (let i = 0; i < 30; i++) {
        const dot = document.createElement('span'); dot.className = 'confetti-piece';
        dot.textContent = i % 3 ? '●' : '★';
        dot.style.cssText = `--x:${Math.random()*100}%;--drift:${(Math.random()-.5)*200}px;--delay:${Math.random()*.35}s;--spin:${Math.random()*620-310}deg;color:${['#B2A3D4','#E8B264','#8ABDAF','#E9A7AE'][i%4]}`;
        $('confetti').append(dot);
      }
      clearTimeout(cleanupTimer); cleanupTimer = setTimeout(() => $('confetti').replaceChildren(), 2100);
    }
  }
  function update(action, id) {
    const before = game.snapshot();
    if (!game[action](id)) return;
    render();
    const state = game.snapshot();
    if (state.won && !before.won) { play('success'); celebrate(); $('next-round').focus({ preventScroll: true }); }
    else { play(state.status === 'over' && action === 'add' ? 'over' : action); if (action === 'remove') bankButtons[id].focus({ preventScroll: true }); }
  }
  document.addEventListener('click', (event) => {
    const card = event.target.closest('.number-card, .stage-card');
    if (!card || card.disabled) return;
    if (Date.now() < blockClickUntil && event.detail !== 0) { event.preventDefault(); return; }
    update(card.classList.contains('number-card') ? 'add' : 'remove', Number(card.dataset.cardId));
  });
  function reset() {
    game.reset(); $('confetti').replaceChildren(); render();
    bankButtons[0].focus({ preventScroll: true });
  }
  $('clear-stage').addEventListener('click', reset);
  $('next-round').addEventListener('click', reset);
  $('undo').addEventListener('click', () => { const ids = game.snapshot().selected; if (ids.length) update('remove', ids[ids.length-1]); });
  function isOverStage(x, y) {
    const box = dropZone.getBoundingClientRect();
    return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
  }
  document.addEventListener('pointerdown', (event) => {
    const card = event.target.closest('.number-card, .stage-card');
    if (!card || card.disabled || drag || event.isPrimary === false || event.button !== 0) return;
    unlockAudio();
    drag = { id: Number(card.dataset.cardId), origin: card.classList.contains('number-card') ? 'bank' : 'stage',
      card, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false, ghost: null };
    try { card.setPointerCapture(event.pointerId); } catch (_) {}
  });
  document.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (!drag.moved && Math.hypot(event.clientX-drag.startX, event.clientY-drag.startY) > 6) {
      drag.moved = true; drag.ghost = document.createElement('div'); drag.ghost.className = 'drag-ghost';
      drag.ghost.setAttribute('aria-hidden', 'true'); drag.ghost.textContent = drag.id % 10;
      document.body.append(drag.ghost); drag.card.classList.add('dragging');
    }
    if (!drag.moved) return;
    if (event.cancelable) event.preventDefault();
    drag.ghost.style.left = event.clientX + 'px'; drag.ghost.style.top = event.clientY + 'px';
    dropZone.classList.toggle('drag-ready', isOverStage(event.clientX, event.clientY));
  }, { passive: false });
  function endDrag(event, cancelled) {
    if (!drag || (event.pointerId !== undefined && event.pointerId !== drag.pointerId)) return;
    const current = drag; drag = null;
    try { if (current.card.hasPointerCapture(current.pointerId)) current.card.releasePointerCapture(current.pointerId); } catch (_) {}
    current.card.classList.remove('dragging'); dropZone.classList.remove('drag-ready');
    if (current.ghost) current.ghost.remove();
    if (current.moved) {
      blockClickUntil = Date.now() + 500;
      if (cancelled) return;
      const inside = isOverStage(event.clientX, event.clientY);
      if (current.origin === 'bank' && inside) update('add', current.id);
      else if (current.origin === 'stage' && !inside) update('remove', current.id);
    }
  }
  document.addEventListener('pointerup', event => endDrag(event, false));
  document.addEventListener('pointercancel', event => endDrag(event, true));
  window.addEventListener('blur', () => endDrag({}, true));
  document.addEventListener('dragstart', event => { if (event.target.closest('.number-card, .stage-card')) event.preventDefault(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && drag) endDrag({}, true); });
  render();
})();

import { DEFAULT_TRAINING, createTimeline, totalDuration, formatTime, validateTraining } from './timer.js';

const app = document.querySelector('#app');
const storageKey = 'pulse-trainings-v1';
let trainings = [structuredClone(DEFAULT_TRAINING)];
let selectedId = DEFAULT_TRAINING.id;
let session = null;
let wakeLock = null;
let audioContext;
let toastTimeout;
let updateWaiting = null;
let storageAvailable = true;
const soundEnabled = true;
const activeTones = new Set();
const bellSound = { name: 'Sino', wave: 'sine', frequency: 1047, duration: 0.4, finish: [784, 1047, 1568], volume: 0.4, bell: true };
let startingTraining = false;

try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if (Array.isArray(saved?.trainings)) {
    const valid = saved.trainings.filter(training => !validateTraining(training) && typeof training.id === 'string');
    trainings = valid;
    selectedId = trainings.some(t => t.id === saved.selectedId) ? saved.selectedId : trainings[0]?.id;
  }
} catch { storageAvailable = false; }

const icons = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7Z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zm6 0h4v14h-4z" fill="currentColor"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4zm13-1c3 2 3 6 0 8" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>'
};
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const selected = () => trainings.find(t => t.id === selectedId) || trainings[0];
function persist() {
  try { localStorage.setItem(storageKey, JSON.stringify({ trainings, selectedId })); }
  catch { storageAvailable = false; toast('Não foi possível salvar neste navegador. Seus treinos ficam apenas nesta sessão.'); }
}
function toast(message) {
  const element = document.querySelector('#toast');
  element.textContent = message;
  element.classList.add('visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => element.classList.remove('visible'), 4500);
}
async function confirmAction(title, description) {
  const dialog = document.querySelector('#confirm-dialog');
  document.querySelector('#confirm-title').textContent = title;
  document.querySelector('#confirm-description').textContent = description;
  dialog.returnValue = '';
  dialog.showModal();
  return new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true }));
}
function brand() { return '<a class="brand" href="#" aria-label="Timer, meus treinos">Timer<span>●</span></a>'; }
function home() {
  session = null;
  document.body.dataset.phase = 'home';
  const training = selected();
  if (!training) {
    app.innerHTML = `<div class="shell home-shell"><header>${brand()}</header><h1>Meus treinos</h1><p class="form-note">Nenhum treino salvo.</p><button class="button primary" id="new-training">${icons.plus} Criar treino</button></div>`;
    document.querySelector('#new-training').onclick = () => editor();
    return;
  }
  app.innerHTML = `
    <div class="shell home-shell">
      <header>${brand()}<span class="header-note">INTERVAL TRAINING</span></header>
      <div class="section-heading"><h2>Meus treinos <span class="count">${trainings.length}</span></h2><button class="button small secondary" id="new-training">${icons.plus} Novo treino</button></div>
      <div class="home-grid"><section class="training-list" aria-label="Treinos salvos">${trainings.map(t => `
        <article class="training-card ${t.id === selectedId ? 'selected' : ''}">
          <button class="training-select" data-select="${escape(t.id)}"><span class="card-top"><span class="eyebrow">INTERVALOS</span><span class="selection-dot"></span></span><h3>${escape(t.name)}</h3><div class="card-times"><strong>${formatTime(t.work)}</strong><span>/</span><strong class="muted">${formatTime(t.rest)}</strong></div><span class="card-bottom">${t.rounds} rounds <span>·</span> ${t.series} séries <span>·</span> ${formatTime(totalDuration(t))} total</span></button>
          <div class="card-actions"><button data-edit="${escape(t.id)}">Editar</button><button data-copy="${escape(t.id)}">Duplicar</button><button data-delete="${escape(t.id)}" aria-label="Excluir ${escape(t.name)}">Excluir</button></div>
        </article>`).join('')}</section>
      </div>
      <footer class="start-footer"><button class="button primary start-button" id="start">${icons.play} Iniciar treino</button></footer>
      <div class="update-banner" ${updateWaiting ? '' : 'hidden'}><span>Uma nova versão está disponível.</span><button id="apply-update">Atualizar agora</button></div>
      ${!storageAvailable ? '<p class="notice">Armazenamento indisponível. Os treinos podem não ser preservados ao fechar.</p>' : ''}
    </div>`;
  document.querySelector('#start').onclick = () => startTraining(training);
  document.querySelector('#new-training').onclick = () => editor();
  document.querySelector('#apply-update').onclick = applyUpdate;
  app.querySelectorAll('[data-select]').forEach(button => button.onclick = () => { selectedId = button.dataset.select; persist(); home(); });
  app.querySelectorAll('[data-edit]').forEach(button => button.onclick = () => editor(trainings.find(t => t.id === button.dataset.edit)));
  app.querySelectorAll('[data-copy]').forEach(button => button.onclick = () => { const copy = { ...trainings.find(t => t.id === button.dataset.copy), id: crypto.randomUUID() }; copy.name = `${copy.name} · cópia`; trainings.push(copy); selectedId = copy.id; persist(); home(); toast('Treino duplicado.'); });
  app.querySelectorAll('[data-delete]').forEach(button => button.onclick = async () => {
    if (await confirmAction('Excluir este treino?', 'A configuração será removida deste aparelho.')) {
      trainings = trainings.filter(t => t.id !== button.dataset.delete);
      if (!trainings.some(t => t.id === selectedId)) selectedId = trainings[0]?.id;
      persist(); home();
    }
  });
  app.querySelector('.brand').onclick = event => event.preventDefault();
}
function editor(existing) {
  const training = existing || { ...DEFAULT_TRAINING, id: crypto.randomUUID(), name: 'Novo treino' };
  document.body.dataset.phase = 'home';
  const fields = [ ['work', 'Exercício', 'Tempo de esforço em cada round', 1], ['rest', 'Descanso', 'Entre os exercícios · 0 para pular', 0], ['rounds', 'Rounds', 'Exercícios em cada série', 1], ['series', 'Séries', 'Quantas vezes repetir o bloco', 1], ['recovery', 'Entre séries', 'Substitui o descanso do último round', 0], ['preparation', 'Preparação', 'Tempo para se posicionar antes de começar', 0] ];
  app.innerHTML = `<div class="shell editor-shell"><header>${brand()}<button class="button small secondary" id="back">${icons.arrow} Voltar</button></header><span class="eyebrow">MONTE SEU RITMO</span><h1>${existing ? 'Editar' : 'Novo'} treino<span class="accent">.</span></h1><form id="training-form"><label class="name-field">Nome do treino<input name="name" maxlength="60" required value="${escape(training.name)}"></label><div class="field-grid">${fields.map(([key, label, hint, min]) => `<label class="field ${key === 'work' ? 'work-field' : ''}"><span>${label}</span><small>${hint}</small><div class="number-input"><input type="number" inputmode="numeric" name="${key}" min="${min}" max="${['rounds', 'series'].includes(key) ? 99 : 3599}" step="1" required value="${training[key]}"><span>${['rounds', 'series'].includes(key) ? 'vezes' : 'segundos'}</span></div></label>`).join('')}</div><p class="form-note">Bipes nos últimos 5 segundos. Em etapas mais curtas, a contagem acompanha o tempo disponível.</p><div class="editor-bottom"><div><span class="eyebrow">DURAÇÃO TOTAL</span><strong id="live-total">${formatTime(totalDuration(training))}</strong></div><button class="button primary" type="submit">Salvar treino ↗</button></div><p id="form-error" class="notice" role="alert"></p></form></div>`;
  const form = document.querySelector('#training-form');
  const read = () => { const data = new FormData(form); return { id: training.id, name: data.get('name').trim(), ...Object.fromEntries(fields.map(([key]) => [key, Number(data.get(key))])) }; };
  form.oninput = () => { const value = read(); document.querySelector('#live-total').textContent = validateTraining(value) ? '—' : formatTime(totalDuration(value)); };
  form.onsubmit = event => { event.preventDefault(); const value = read(); const error = validateTraining(value); if (error) { document.querySelector('#form-error').textContent = error; return; } if (existing) trainings = trainings.map(t => t.id === value.id ? value : t); else trainings.push(value); selectedId = value.id; persist(); home(); toast('Treino salvo.'); };
  document.querySelector('#back').onclick = home;
  app.querySelector('.brand').onclick = event => { event.preventDefault(); home(); };
}
function initAudio() {
  try { audioContext ||= new (window.AudioContext || window.webkitAudioContext)(); audioContext.resume().catch(() => toast('Não foi possível ativar o som. Teste o áudio no aparelho.')); } catch { toast('Este navegador não oferece os avisos sonoros.'); }
}
function tone(frequency, duration, time = audioContext?.currentTime, profile = bellSound) {
  if (!soundEnabled || !audioContext) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = profile.wave;
  oscillator.frequency.value = frequency;
  oscillator.connect(gain); gain.connect(audioContext.destination);
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(profile.volume ?? (profile.wave === 'square' ? 0.075 : 0.2), time + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
  activeTones.add(oscillator);
  oscillator.onended = () => { activeTones.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
  oscillator.start(time); oscillator.stop(time + duration + 0.01);
  if (profile.bell) tone(frequency * 2.76, duration * 0.6, time, { ...profile, bell: false, volume: (profile.volume ?? 0.2) * 0.25 });

}
function playCue(kind, time = audioContext?.currentTime, profile = bellSound) {
  if (profile.bell && kind === 'transition') {
    // Two lower, resonant strikes mark the boundary distinctly from the countdown.
    const transitionProfile = { ...profile, volume: (profile.volume ?? 0.2) * 0.7 };
    tone(784, 0.55, time, transitionProfile);
    tone(1047, 0.55, time + 0.18, transitionProfile);
    return;
  }
  if (kind === 'countdown') tone(profile.frequency, profile.duration, time, profile);
  else if (kind === 'transition') tone(profile.transition, profile.transitionDuration ?? Math.max(0.22, profile.duration), time, profile);
  else profile.finish.forEach((frequency, index) => tone(frequency, profile.finishDuration ?? (profile.bell ? 0.35 : 0.18), time + index * (profile.finishDuration ? profile.finishDuration + 0.07 : 0.19), profile));
}
function cancelSounds() {
  for (const oscillator of activeTones) { try { oscillator.stop(); } catch { /* Already ended. */ } }
  activeTones.clear();
}
function scheduleStepSounds() {
  if (!soundEnabled || !audioContext || !session || session.paused || session.finished) return;
  const now = performance.now();
  const audioNow = audioContext.currentTime;
  const remaining = (session.deadline - now) / 1000;
  // Schedule against the same deadline as the visual clock, rather than each UI tick.
  for (let seconds = Math.min(5, Math.ceil(remaining)); seconds >= 1; seconds--) {
    const offset = remaining - seconds;
    if (offset >= -0.1) playCue('countdown', audioNow + Math.max(0, offset));
  }
  if (session.index < session.timeline.length - 1 && remaining > 0) {
    playCue('transition', audioNow + remaining);
  }
}
function finishSound() {
  if (!soundEnabled || !audioContext) return;
  playCue('finish');
}
async function acquireWakeLock() {
  if (!session || session.paused || session.finished || document.hidden) return;
  if (!('wakeLock' in navigator)) return;
  try {
    if (wakeLock && !wakeLock.released) return;
    wakeLock = await navigator.wakeLock.request('screen');
    if (!session || session.paused || session.finished || document.hidden) { releaseWakeLock(); return; }
  } catch { /* The system can decline keeping the screen awake. */ }
}
function releaseWakeLock() { if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; } }

async function startTraining(training) {
  if (startingTraining) return;
  startingTraining = true;
  initAudio();
  try {
    if (audioContext) { await audioContext.resume(); }
  } catch { toast('Não foi possível ativar o som. Confira o áudio do aparelho e tente novamente.'); startingTraining = false; return; }
  startingTraining = false;
  if (document.hidden) return;
  selectedId = training.id; persist(); initAudio(); cancelSounds();
  const timeline = createTimeline(training);
  session = { training: { ...training }, timeline, index: 0, remaining: timeline[0].duration * 1000, deadline: performance.now() + timeline[0].duration * 1000, paused: false, finished: false };
  renderTimer(); acquireWakeLock(); scheduleStepSounds(); tick();
}
function renderTimer() {
  app.innerHTML = `<div class="timer-shell"><section class="timer-layout"><div class="timer-main"><div class="clock" id="clock" role="timer" aria-label="Tempo restante"></div></div><aside class="timer-side"><span id="paused-label" hidden>PAUSADO</span><div class="counter"><span>ROUND</span><strong><span id="round-current"></span><small> / ${session.training.rounds}</small></strong></div><div class="counter"><span>SÉRIE</span><strong><span id="series-current"></span><small> / ${session.training.series}</small></strong></div></aside></section><div class="timer-controls"><button class="button secondary" id="restart">↺ Reiniciar</button><button class="button primary pause-button" id="pause"></button><button class="button secondary" id="end">Encerrar ×</button></div></div>`;
  document.querySelector('#pause').onclick = () => session.paused ? resumeTraining() : pauseTraining();
  document.querySelector('#restart').onclick = async () => {
    const wasPaused = session.paused; pauseTraining();
    if (await confirmAction('Reiniciar o treino?', 'Você voltará à preparação e ao primeiro round.')) startTraining(session.training);
    else if (!wasPaused) resumeTraining();
  };
  document.querySelector('#end').onclick = async () => {
    const wasPaused = session.paused; pauseTraining();
    if (await confirmAction('Encerrar o treino?', 'O progresso desta sessão será descartado. Seus treinos salvos serão mantidos.')) { releaseWakeLock(); cancelSounds(); home(); }
    else if (!wasPaused) resumeTraining();
  };
  updateTimer();
}
function updateTimer() {
  if (!session || session.finished) return;
  const step = session.timeline[session.index];
  document.body.dataset.phase = step.type;
  document.querySelector('#clock').textContent = formatTime(session.remaining / 1000);
  document.querySelector('#round-current').textContent = step.round;
  document.querySelector('#series-current').textContent = step.series;
  document.querySelector('#paused-label').hidden = !session.paused;
  document.querySelector('#pause').innerHTML = session.paused ? `${icons.play} Continuar` : `${icons.pause} Pausar`;
}
function pauseTraining(reason) {
  if (!session || session.paused || session.finished) return;
  session.remaining = Math.max(0, session.deadline - performance.now()); session.paused = true;
  cancelSounds(); releaseWakeLock(); updateTimer();
  if (reason) toast(reason);
}
function resumeTraining() {
  if (!session || session.finished || document.hidden) return;
  initAudio(); session.deadline = performance.now() + session.remaining; session.paused = false;
  cancelSounds(); scheduleStepSounds();
  acquireWakeLock(); updateTimer();
}
function tick() {
  if (session && !session.paused && !session.finished) {
    const now = performance.now();
    const previousIndex = session.index;
    while (now >= session.deadline && session.index < session.timeline.length - 1) {
      session.index++; session.deadline += session.timeline[session.index].duration * 1000;
    }
    session.remaining = Math.max(0, session.deadline - now);
    if (session.index !== previousIndex) scheduleStepSounds();
    if (session.remaining <= 0) finishTraining();
    else {
      updateTimer();
    }
  }
}
setInterval(tick, 80);
function finishTraining() {
  session.finished = true; cancelSounds(); releaseWakeLock(); finishSound();
  document.body.dataset.phase = 'work';
  app.innerHTML = `<div class="finish-shell">${brand()}<div class="finish-check" aria-hidden="true">✓</div><span class="eyebrow">TREINO CONCLUÍDO</span><h1>Você fez<br><em>cada segundo valer.</em></h1><p>${escape(session.training.name)}</p><div class="finish-stats"><div><strong>${session.training.rounds * session.training.series}</strong><span>ROUNDS</span></div><div><strong>${session.training.series}</strong><span>SÉRIES</span></div><div><strong>${formatTime(totalDuration(session.training))}</strong><span>TEMPO TOTAL</span></div></div><button class="button primary" id="finish-home">Voltar aos treinos ↗</button></div>`;
  document.querySelector('#finish-home').onclick = home;
  app.querySelector('.brand').onclick = event => { event.preventDefault(); home(); };
}
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseTraining('Treino pausado ao sair. Toque em continuar para retomar.'); });
window.addEventListener('pagehide', () => pauseTraining());
function applyUpdate() { if (updateWaiting && !session) updateWaiting.postMessage({ type: 'SKIP_WAITING' }); }
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      const announce = () => { updateWaiting = registration.waiting; if (!session && updateWaiting) home(); };
      if (registration.waiting) announce();
      registration.addEventListener('updatefound', () => { const worker = registration.installing; worker?.addEventListener('statechange', () => { if (worker.state === 'installed' && navigator.serviceWorker.controller) announce(); }); });
      await navigator.serviceWorker.ready;
    } catch { toast('Modo offline ainda indisponível. Abra o timer publicado com internet.'); }
  });
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!refreshing && !session) { refreshing = true; location.reload(); } });
}
home();

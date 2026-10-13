import { parseNames, distributeTeams, getTeamSizes } from './team-utils.js';

const $ = (id) => document.getElementById(id);
const namesInput = $('names');
const teamInput = $('team-count');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const colors = ['#eee5fc', '#ffe3e7', '#fff0c5', '#dceee3', '#dfeafb', '#fbe5d9'];
const themes = [
  { icon: '🌷', name: '튤립', color: '#fbe5eb' },
  { icon: '🍀', name: '클로버', color: '#e0eee4' },
  { icon: '⭐', name: '별빛', color: '#fff1c9' },
  { icon: '🫧', name: '몽글', color: '#e6e2f6' },
  { icon: '🍑', name: '복숭아', color: '#fce6dc' },
  { icon: '☁️', name: '구름', color: '#e3ecf8' },
  { icon: '🌼', name: '데이지', color: '#f7efc9' },
  { icon: '🎀', name: '리본', color: '#f4e0ee' }
];
const sampleNames = ['김하은', '이서연', '박지우', '최유진', '정수빈', '강다은', '조민서', '윤서아', '장예린', '임채원', '한소윤', '오지민', '서나연', '신예은', '권수아', '황다인', '안유나', '송채린', '전아린', '홍시은', '문서현', '양하린', '고예서', '백다현'];
let phase = 'idle';
let duration = 8000;
let runId = 0;
let currentTeams = null;
let teamLabels = [];
let balls = [];
let soundEnabled = false;
let audioContext;
let soundPending = false;
let animationFrame;
let lastFrame = 0;
let shuffleStarted = 0;
let lastChime = 0;
let toastTimer;

function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', '#icon-' + name);
  svg.append(use);
  return svg;
}

function showToast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('is-visible'), 3000);
}

function clearError() {
  $('field-error').hidden = true;
  namesInput.removeAttribute('aria-invalid');
  teamInput.removeAttribute('aria-invalid');
}

function updateConfig() {
  const names = parseNames(namesInput.value);
  const count = Number(teamInput.value);
  $('participant-count').textContent = names.length;
  $('team-minus').disabled = phase === 'shuffling' || phase === 'revealing' || count <= 2;
  $('team-plus').disabled = phase === 'shuffling' || phase === 'revealing' || count >= 200;
  if (!names.length) $('team-estimate').textContent = '이름을 넣어 주세요';
  else if (Number.isSafeInteger(count) && count >= 2 && count <= names.length && names.length <= 200) {
    const sizes = getTeamSizes(names.length, count);
    const min = Math.min(...sizes);
    const max = Math.max(...sizes);
    $('team-estimate').textContent = '한 팀에 ' + min + (min === max ? '' : '–' + max) + '명';
  } else if (names.length > 200) $('team-estimate').textContent = '최대 200명까지 가능해요';
  else if (names.length < 2) $('team-estimate').textContent = '2명 이상 모아 주세요';
  else if (!Number.isSafeInteger(count) || count < 2) $('team-estimate').textContent = '2팀 이상 골라 주세요';
  else $('team-estimate').textContent = '친구보다 팀이 많아요';
}

function setBusy(busy) {
  for (const el of $('setup-form').querySelectorAll('button, input, textarea')) el.disabled = busy;
  if (!busy) updateConfig();
}

function resetStage() {
  runId += 1;
  phase = 'idle';
  currentTeams = null;
  $('result-panel').hidden = true;
  $('mixer-panel').hidden = false;
  $('mixer-panel').classList.remove('is-shuffling');
  $('stage-title').textContent = '오늘은 누구와 한 팀?';
  $('stage-eyebrow').textContent = 'A LITTLE MIX, A NEW CONNECTION';
  $('machine-caption').textContent = '이름을 넣으면, 작은 마법이 시작돼요.';
  $('stage-status').textContent = '';
  $('status-text').textContent = '만날 준비 중';
  $('status-pill').classList.remove('is-live');
  $('progress-track').hidden = true;
  $('progress-fill').style.width = '0%';
  $('progress-track').setAttribute('aria-valuenow', '0');
  $('stage-actions').hidden = true;
  $('team-preview').hidden = true;
  $('reveal-card').hidden = true;
  $('ball-container').style.opacity = '1';
  $('shuffle-button').querySelector('span').textContent = '두근두근, 팀 만들기';
  setBusy(false);
  createBalls();
}

function createBalls() {
  const names = parseNames(namesInput.value);
  const labels = names.length ? names.slice(0, 18) : ['나', '너', '우리', '짝꿍', '함께', '설렘', '친구', '반가워', '♡', '케미', '행운', '☺'];
  $('ball-container').replaceChildren();
  balls = labels.map((name, i) => {
    const el = document.createElement('span');
    el.className = 'name-ball';
    el.textContent = name;
    el.style.setProperty('--ball-color', colors[i % colors.length]);
    const width = Math.min(90, Math.max(35, [...name].length * 10 + 22));
    el.style.width = width + 'px';
    el.title = name;
    $('ball-container').append(el);
    const angle = i * 2.399963;
    const radius = 18 + Math.sqrt(i / labels.length) * 65;
    return { el, width, x: 124 + Math.cos(angle) * radius, y: 111 + Math.sin(angle) * radius,
      baseX: 124 + Math.cos(angle) * radius, baseY: 111 + Math.sin(angle) * radius,
      vx: (Math.random() - .5) * 7, vy: (Math.random() - .5) * 7, seed: i * 1.4 };
  });
  if (animationFrame) cancelAnimationFrame(animationFrame);
  lastFrame = 0;
  animate(performance.now());
}

function animate(now) {
  const step = lastFrame ? Math.min((now - lastFrame) / 16.67, 2) : 1;
  lastFrame = now;
  const active = phase === 'shuffling';
  for (let i = 0; i < balls.length; i++) {
    const ball = balls[i];
    let rotation = 0;
    if (active) {
      ball.vy += .055 * step;
      ball.x += ball.vx * step;
      ball.y += ball.vy * step;
      const dx = ball.x - 124, dy = ball.y - 109;
      const distance = Math.hypot(dx, dy);
      const boundary = 105 - ball.width * .3;
      if (distance > boundary) {
        const nx = dx / distance, ny = dy / distance;
        ball.x = 124 + nx * boundary;
        ball.y = 109 + ny * boundary;
        const dot = ball.vx * nx + ball.vy * ny;
        if (dot > 0) { ball.vx -= 2 * dot * nx; ball.vy -= 2 * dot * ny; }
      }
      // Soft collisions make the name balls visibly tumble past one another.
      for (let j = i + 1; j < balls.length; j++) {
        const other = balls[j];
        const dx = other.x - ball.x, dy = other.y - ball.y;
        const d = Math.hypot(dx, dy);
        if (d > 0 && d < 25) {
          const nx = dx / d, ny = dy / d;
          const speed = (ball.vx - other.vx) * nx + (ball.vy - other.vy) * ny;
          if (speed > 0) {
            ball.vx -= speed * nx; ball.vy -= speed * ny;
            other.vx += speed * nx; other.vy += speed * ny;
          }
          const offset = (25 - d) * .25;
          ball.x -= nx * offset; ball.y -= ny * offset;
          other.x += nx * offset; other.y += ny * offset;
        }
      }
      const speed = Math.hypot(ball.vx, ball.vy);
      if (speed > 6) { ball.vx *= 6 / speed; ball.vy *= 6 / speed; }
      rotation = Math.sin(now / 180 + ball.seed) * 17;
    } else {
      ball.x = ball.baseX + (reducedMotion.matches ? 0 : Math.sin(now / 1600 + ball.seed) * 4);
      ball.y = ball.baseY + (reducedMotion.matches ? 0 : Math.cos(now / 1300 + ball.seed) * 5);
      rotation = Math.sin(ball.seed) * 12;
    }
    ball.el.style.transform = 'translate(' + (ball.x - ball.width / 2) + 'px,' + (ball.y - 16) + 'px) rotate(' + rotation + 'deg)';
  }
  if (active) {
    const percent = Math.min(100, (now - shuffleStarted) / duration * 100);
    $('progress-fill').style.width = percent + '%';
    $('progress-track').setAttribute('aria-valuenow', String(Math.round(percent)));
    if (soundEnabled && now - lastChime > 390) { playTone(380 + Math.random() * 250, .04, .025); lastChime = now; }
  }
  if ((phase === 'idle' || active || phase === 'revealing') && !reducedMotion.matches) animationFrame = requestAnimationFrame(animate);
}

function playTone(frequency = 660, length = .12, volume = .06) {
  if (!soundEnabled || !audioContext || audioContext.state !== 'running') return;
  try {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, audioContext.currentTime);
    gain.gain.linearRampToValueAtTime(volume, audioContext.currentTime + .01);
    gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + length);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + length);
  } catch { /* Audio is optional. Team drawing remains available. */ }
}

async function startShuffle(event) {
  event?.preventDefault();
  if (phase === 'shuffling' || phase === 'revealing') return;
  clearError();
  const names = parseNames(namesInput.value);
  const count = Number(teamInput.value);
  try { currentTeams = distributeTeams(names, count); }
  catch (error) {
    $('field-error').textContent = error.message;
    $('field-error').hidden = false;
    const target = names.length < 2 || names.length > 200 ? namesInput : teamInput;
    target.setAttribute('aria-invalid', 'true');
    target.focus();
    return;
  }
  const token = ++runId;
  teamLabels = currentTeams.map((_, i) => (i + 1) + '팀 · ' + themes[i % themes.length].name);
  phase = 'shuffling';
  setBusy(true);
  $('result-panel').hidden = true;
  $('mixer-panel').hidden = false;
  $('mixer-panel').classList.add('is-shuffling');
  $('stage-title').textContent = '새로운 케미를 섞는 중!';
  $('stage-eyebrow').textContent = 'MIXING A LITTLE MAGIC';
  $('machine-caption').textContent = '이름 공들이 신나게 춤추고 있어요.';
  $('stage-status').textContent = names.length + '명의 친구들, ' + count + '개의 새로운 만남';
  $('status-text').textContent = '두근두근 셔플 중';
  $('status-pill').classList.add('is-live');
  $('stage-tips').hidden = true;
  $('progress-track').hidden = false;
  $('stage-actions').hidden = false;
  $('team-preview').hidden = true;
  $('reveal-card').hidden = true;
  $('ball-container').style.opacity = '1';
  $('shuffle-button').querySelector('span').textContent = '친구들을 섞고 있어요…';
  shuffleStarted = performance.now();
  createBalls();
  if (audioContext?.state === 'suspended' && soundEnabled) audioContext.resume().catch(() => {});
  if (reducedMotion.matches) { finishRun(); return; }
  $('skip-button').focus({ preventScroll: true });
  if (window.innerWidth < 761) $('mixer-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  await new Promise(resolve => setTimeout(resolve, duration));
  if (token !== runId) return;
  await revealTeams(token);
}

async function revealTeams(token) {
  const teams = currentTeams;
  phase = 'revealing';
  $('mixer-panel').classList.remove('is-shuffling');
  $('stage-title').textContent = '반가워, 우리 팀!';
  $('stage-eyebrow').textContent = 'A NEW CONNECTION IS HERE';
  $('status-text').textContent = '팀을 만나는 중';
  $('machine-caption').textContent = '한 명씩, 새로운 친구를 만나러 가요.';
  $('progress-track').hidden = true;
  $('ball-container').style.opacity = '.23';
  const preview = $('team-preview');
  preview.replaceChildren();
  preview.hidden = false;
  const shown = teams.map(() => 0);
  const counts = teams.map((team, i) => {
    const card = document.createElement('div');
    card.className = 'mini-team';
    const emoji = document.createElement('span');
    emoji.className = 'mini-team-icon';
    emoji.textContent = themes[i % themes.length].icon;
    const label = document.createElement('span');
    label.className = 'mini-team-title';
    label.textContent = (i + 1) + '팀';
    const count = document.createElement('span');
    count.className = 'mini-team-count';
    count.textContent = '0/' + team.length;
    card.append(emoji, label, count);
    preview.append(card);
    return count;
  });
  $('reveal-card').hidden = false;
  const max = Math.max(...teams.map(t => t.length));
  const total = teams.flat().length;
  // Keep a full classroom reveal under ten seconds, even for a large roster.
  const interval = Math.min(330, Math.max(32, 6500 / total));
  for (let round = 0; round < max; round++) {
    for (let i = 0; i < teams.length; i++) {
      if (token !== runId) return;
      const name = teams[i][round];
      if (name === undefined) continue;
      $('reveal-team').textContent = themes[i % themes.length].icon + ' ' + teamLabels[i];
      $('reveal-name').textContent = name;
      $('reveal-card').style.setProperty('--team-color', themes[i % themes.length].color);
      $('reveal-card').animate([{ opacity: .3, transform: 'translate(-50%, -50%) scale(.88)' }, { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' }], { duration: Math.min(interval, 200), easing: 'ease-out' });
      counts[i].textContent = ++shown[i] + '/' + teams[i].length;
      playTone(520 + (i % 8) * 65, .1, .035);
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
  if (token !== runId) return;
  finishRun();
}

function finishRun() {
  if (!currentTeams) return;
  runId += 1;
  phase = 'complete';
  cancelAnimationFrame(animationFrame);
  $('mixer-panel').classList.remove('is-shuffling');
  $('mixer-panel').hidden = true;
  $('result-panel').hidden = false;
  $('stage-tips').hidden = false;
  $('stage-actions').hidden = true;
  setBusy(false);
  $('shuffle-button').querySelector('span').textContent = '새로운 팀으로 다시 섞기';
  $('result-subtitle').textContent = currentTeams.flat().length + '명의 친구가 ' + currentTeams.length + '팀으로 모였어요. 오늘도 즐겁게, 함께!';
  const grid = $('results-grid');
  grid.replaceChildren();
  currentTeams.forEach((team, i) => {
    const theme = themes[i % themes.length];
    const card = document.createElement('article');
    card.className = 'team-card';
    card.style.setProperty('--team-color', theme.color);
    const header = document.createElement('div');
    header.className = 'team-card-header';
    const emoji = document.createElement('span');
    emoji.className = 'team-icon';
    emoji.textContent = theme.icon;
    emoji.setAttribute('aria-hidden', 'true');
    const label = document.createElement('input');
    label.className = 'team-name';
    label.value = teamLabels[i];
    label.maxLength = 40;
    label.setAttribute('aria-label', (i + 1) + '팀 이름 바꾸기');
    label.addEventListener('input', () => { teamLabels[i] = label.value.trim() || (i + 1) + '팀'; });
    label.addEventListener('blur', () => { label.value = teamLabels[i]; });
    const size = document.createElement('span');
    size.className = 'team-size';
    size.textContent = team.length + '명';
    header.append(emoji, label, size);
    const members = document.createElement('div');
    members.className = 'team-members';
    team.forEach(name => { const member = document.createElement('span'); member.className = 'member-chip'; member.textContent = name; members.append(member); });
    card.append(header, members);
    grid.append(card);
    if (!reducedMotion.matches) card.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 350, delay: Math.min(i * 65, 700), fill: 'backwards' });
  });
  $('result-panel').focus({ preventScroll: true });
  if (window.innerWidth < 761) $('result-panel').scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'start' });
  $('stage-status').textContent = '팀 만들기 완료';
  if (soundEnabled) [660, 830, 990].forEach((n, i) => setTimeout(() => playTone(n, .28), i * 110));
  if (!reducedMotion.matches) confetti();
  showToast('모두 모였어요! 새로운 팀과 인사해 볼까요?');
}

function confetti() {
  const container = $('confetti-container');
  container.replaceChildren();
  for (let i = 0; i < 50; i++) {
    const el = document.createElement('span');
    el.className = 'confetti-piece';
    el.style.left = Math.random() * 100 + '%';
    el.style.backgroundColor = colors[i % colors.length];
    el.style.animationDelay = Math.random() * .6 + 's';
    el.style.animationDuration = (2 + Math.random() * 1.6) + 's';
    el.style.setProperty('--drift', (Math.random() - .5) * 220 + 'px');
    el.style.borderRadius = i % 3 ? '2px' : '50%';
    container.append(el);
  }
  setTimeout(() => container.replaceChildren(), 4500);
}

function resultText() {
  if (!currentTeams) return '';
  return '모여모여 · 우리 반 팀 나누기\n' + currentTeams.flat().length + '명 / ' + currentTeams.length + '팀\n\n' + currentTeams.map((team, i) => teamLabels[i] + ' (' + team.length + '명)\n' + team.join(', ')).join('\n\n');
}

$('setup-form').addEventListener('submit', startShuffle);
$('reshuffle-button').addEventListener('click', startShuffle);
namesInput.addEventListener('input', () => { clearError(); if (phase === 'complete') resetStage(); else createBalls(); updateConfig(); });
teamInput.addEventListener('input', () => { clearError(); if (phase === 'complete') resetStage(); updateConfig(); });
$('team-minus').addEventListener('click', () => { teamInput.value = Math.max(2, Math.floor(Number(teamInput.value) || 2) - 1); teamInput.dispatchEvent(new Event('input')); });
$('team-plus').addEventListener('click', () => { teamInput.value = Math.min(200, Math.floor(Number(teamInput.value) || 1) + 1); teamInput.dispatchEvent(new Event('input')); });
$('sample-button').addEventListener('click', () => { namesInput.value = sampleNames.join('\n'); teamInput.value = '4'; clearError(); resetStage(); showToast('24명의 예시 친구들을 모았어요!'); });
$('clear-button').addEventListener('click', () => { namesInput.value = ''; clearError(); resetStage(); namesInput.focus(); });
for (const button of document.querySelectorAll('[data-duration]')) {
  button.addEventListener('click', () => {
    duration = Number(button.dataset.duration);
    for (const option of document.querySelectorAll('[data-duration]')) { option.classList.toggle('is-active', option === button); option.setAttribute('aria-pressed', String(option === button)); }
  });
}
$('skip-button').addEventListener('click', finishRun);
$('cancel-button').addEventListener('click', () => { resetStage(); $('stage-tips').hidden = false; $('shuffle-button').focus({ preventScroll: true }); showToast('잠깐 쉬어 갈게요. 준비되면 다시 섞어 주세요.'); });
$('copy-button').addEventListener('click', async () => {
  const text = resultText();
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else {
      const field = document.createElement('textarea');
      field.value = text; field.style.position = 'fixed'; field.style.opacity = '0';
      document.body.append(field); field.select();
      const ok = document.execCommand('copy'); field.remove();
      if (!ok) throw new Error('Clipboard unavailable');
    }
    showToast('팀 결과를 복사했어요. 원하는 곳에 붙여 넣어 주세요!');
  } catch { showToast('복사가 지원되지 않아요. 저장 버튼으로 파일을 받아 주세요.'); }
});
$('download-button').addEventListener('click', () => {
  const blob = new Blob(['\uFEFF', resultText()], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = '모여모여_팀결과_' + new Date().toLocaleDateString('sv-SE') + '.txt';
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('팀 결과를 파일로 저장했어요.');
});
$('sound-toggle').addEventListener('click', async () => {
  const button = $('sound-toggle');
  if (soundPending) return;
  if (!soundEnabled) {
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw new Error('Audio unavailable');
      audioContext ??= new Audio();
      soundPending = true;
      button.disabled = true;
      await audioContext.resume();
      soundEnabled = true;
    } catch { showToast('이 브라우저에서는 효과음을 사용할 수 없어요.'); return; }
    finally { soundPending = false; button.disabled = false; }
  } else soundEnabled = false;
  button.setAttribute('aria-pressed', String(soundEnabled));
  button.setAttribute('aria-label', soundEnabled ? '효과음 끄기' : '효과음 켜기');
  button.title = soundEnabled ? '효과음 끄기' : '효과음 켜기';
  button.querySelector('use').setAttribute('href', soundEnabled ? '#icon-sound' : '#icon-muted');
  button.querySelector('.sound-label').textContent = soundEnabled ? '소리 ON' : '소리 OFF';
  playTone(740, .16);
});
$('fullscreen-toggle').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    else { showToast('전체 화면이 지원되지 않아요. PC에서는 F11도 사용할 수 있어요.'); }
  } catch { showToast('전체 화면을 열지 못했어요. PC에서는 F11을 눌러 보세요.'); }
});
document.addEventListener('fullscreenchange', () => {
  const active = !!document.fullscreenElement;
  $('fullscreen-toggle').setAttribute('aria-label', active ? '전체 화면 닫기' : '전체 화면');
  $('fullscreen-toggle').title = active ? '전체 화면 닫기' : '전체 화면';
});
$('help-open').addEventListener('click', () => $('help-dialog').showModal());
$('help-close').addEventListener('click', () => $('help-dialog').close());
$('help-confirm').addEventListener('click', () => $('help-dialog').close());
$('help-dialog').addEventListener('click', (event) => { if (event.target === $('help-dialog')) { const rect = $('help-dialog').getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) $('help-dialog').close(); } });
reducedMotion.addEventListener('change', () => { if (reducedMotion.matches && (phase === 'shuffling' || phase === 'revealing')) finishRun(); else if (phase === 'idle') createBalls(); });
updateConfig();
createBalls();

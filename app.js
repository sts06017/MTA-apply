const FORM_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxS43nAO9P97duC8VEfgx94g-hGQwpZ_jCxQvxdPWFL7GhS229Xml0N9f-4n6xP7zo/exec';
const infoPage = document.getElementById('information-page');
const applicationPage = document.getElementById('application-page');
const completePage = document.getElementById('complete-page');
const responseFrame = document.getElementById('response-frame');
const form = document.getElementById('retreat-form');
const allSteps = ['youthGroup', 'cell', 'name', 'phone', 'rrn', 'attendance', 'days', 'transport', 'arrival', 'sleep', 'prayer', 'request', 'review'];
// 조건에 따라 나타나는 질문은 앞 질문의 하위 번호(예: 05-1)로 표시해 전체 개수가 변하지 않게 합니다.
const SUB_OF = { cell: 'youthGroup', days: 'attendance', arrival: 'transport' };
const mainSteps = allSteps.filter(key => !SUB_OF[key]);
const inputs = Object.fromEntries(['youthGroup', 'name', 'cell', 'phone', 'rrn', 'attendance', 'transport', 'arrival', 'sleep', 'prayer', 'request', 'consent'].map(id => [id, document.getElementById(id)]));
const dayInputs = [...document.querySelectorAll('input[name="days"]')];
const CELLS = {
  '에임홀리': ['관용셀', '희영셀', '서우셀', '설희셀', '하은셀', '병민셀', '프렌즈팀'],
  '에임하이': ['서영셀', '효성셀', '지민셀', '수빈셀', '프렌즈팀']
};
const customGroupInput = document.getElementById('custom-group');
let customGroup = false;
let returnToReview = false;
let allowUnload = false;
const status = document.getElementById('status');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let currentStep = 'youthGroup';
let inlineAvailable = false;
let pendingRequestId = null;
let responseTimer = null;
const probeId = crypto.randomUUID();

form.action = FORM_ENDPOINT;

function activeSteps() {
  const attendance = inputs.attendance.value;
  return allSteps.filter(key =>
    (key !== 'cell' || !customGroup) &&
    (key !== 'days' || attendance === '부분') &&
    (key !== 'arrival' || inputs.transport.value === '자차')
  );
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'instant' : 'smooth' });
}

function showView() {
  const applying = location.hash === '#apply';
  infoPage.hidden = applying;
  applicationPage.hidden = !applying;
  completePage.hidden = true;
  document.title = applying
    ? '신청서 작성 · 2027 More Than Able'
    : '2027 More Than Able · 동계수련회 신청';
  if (applying) renderStep();
  scrollToTop();
}

document.getElementById('apply-button').addEventListener('click', () => {
  if (location.hash === '#apply') showView();
  else location.hash = 'apply';
});
document.getElementById('back-to-info').addEventListener('click', () => {
  history.pushState(null, '', location.pathname + location.search);
  showView();
});
document.getElementById('complete-home').addEventListener('click', () => {
  history.pushState(null, '', location.pathname + location.search);
  showView();
});
window.addEventListener('hashchange', showView);
window.addEventListener('popstate', event => {
  if (location.hash === '#apply' && event.state && event.state.step) currentStep = event.state.step;
  showView();
});

function setSubmitting(active) {
  const button = document.getElementById('submit-button');
  button.disabled = active;
  button.classList.toggle('is-loading', active);
  button.textContent = active ? '제출 중…' : '신청서 제출하기 ↗';
}

function clearStatus() {
  status.className = 'status';
  status.textContent = '';
  document.querySelectorAll('[aria-invalid]').forEach(element => element.removeAttribute('aria-invalid'));
}
function showError(message) {
  status.className = 'status';
  status.textContent = message;
  if (reduceMotion.matches) return;
  const panel = document.querySelector('.step-panel:not([hidden])');
  const target = panel && panel.querySelector('.entry:not([type=hidden]), .option-grid, .time-picker');
  [status, target].forEach(element => {
    if (!element) return;
    element.classList.remove('shake');
    void element.offsetWidth;
    element.classList.add('shake');
  });
  const field = panel && panel.querySelector('input.entry:not([type=hidden])');
  if (field && field.offsetParent !== null) { field.setAttribute('aria-invalid', 'true'); field.focus({ preventScroll: true }); }
}

function trustedScriptOrigin(origin) {
  return origin === 'https://script.google.com' ||
    origin === 'https://script.googleusercontent.com' ||
    /^https:\/\/[a-z0-9-]+-script\.googleusercontent\.com$/.test(origin);
}

function showCompletion() {
  clearTimeout(responseTimer);
  pendingRequestId = null;
  form.reset();
  ['prayer', 'request'].forEach(name => { document.getElementById(name + '-count').textContent = '0'; });
  clearArrival();
  customGroup = false;
  customGroupInput.value = '';
  document.getElementById('custom-group-wrap').hidden = true;
  renderCellOptions();
  setSubmitting(false);
  returnToReview = false;
  document.querySelectorAll('.option.selected').forEach(button => button.classList.remove('selected'));
  document.querySelectorAll('.option[aria-pressed]').forEach(button => button.setAttribute('aria-pressed', 'false'));
  document.getElementById('review-summary').replaceChildren();
  currentStep = 'youthGroup';
  infoPage.hidden = true;
  applicationPage.hidden = true;
  completePage.hidden = false;
  history.replaceState(null, '', location.pathname + location.search + '#complete');
  document.title = '신청 완료 · 2027 More Than Able';
  scrollToTop();
  document.getElementById('complete-title').focus({ preventScroll: true });
  burstConfetti();
}

function burstConfetti() {
  if (reduceMotion.matches) return;
  const layer = document.createElement('div');
  layer.className = 'confetti';
  layer.setAttribute('aria-hidden', 'true');
  const colors = ['#ed5b49', '#f6e688', '#263839', '#ff755c', '#8fb98b'];
  for (let index = 0; index < 36; index += 1) {
    const piece = document.createElement('i');
    piece.style.setProperty('--x', (Math.random() * 100).toFixed(1) + 'vw');
    piece.style.setProperty('--dx', (Math.random() * 160 - 80).toFixed(0) + 'px');
    piece.style.setProperty('--r', (Math.random() * 720 - 360).toFixed(0) + 'deg');
    piece.style.setProperty('--d', (Math.random() * 500).toFixed(0) + 'ms');
    piece.style.background = colors[index % colors.length];
    layer.append(piece);
  }
  document.body.append(layer);
  setTimeout(() => layer.remove(), 2600);
}

window.addEventListener('beforeunload', event => {
  const dirty = !applicationPage.hidden && [inputs.name, inputs.phone, inputs.rrn].some(input => input.value.trim());
  if (dirty && !allowUnload) { event.preventDefault(); event.returnValue = ''; }
});

window.addEventListener('message', event => {
  if (!trustedScriptOrigin(event.origin)) return;
  const data = event.data;
  if (!data || data.type !== 'mta-apply-result') return;
  if (data.kind === 'ready' && data.requestId === probeId) {
    inlineAvailable = true;
    return;
  }
  if (!pendingRequestId || data.requestId !== pendingRequestId) return;
  clearTimeout(responseTimer);
  pendingRequestId = null;
  if (data.kind === 'success') showCompletion();
  else {
    showError('접수를 확인하지 못했습니다. 운영진에게 문의하거나 잠시 후 다시 시도해 주세요.');
    setSubmitting(false);
  }
});

if (FORM_ENDPOINT) responseFrame.src = FORM_ENDPOINT + '?mtaProbe=' + encodeURIComponent(probeId);

function renderCellOptions() {
  const container = document.getElementById('cell-options');
  container.replaceChildren(...(CELLS[inputs.youthGroup.value] || []).map(cell => {
    const button = document.createElement('button');
    button.className = 'option';
    button.type = 'button';
    button.dataset.value = cell;
    button.setAttribute('aria-pressed', 'false');
    const indicator = document.createElement('span');
    indicator.className = 'indicator';
    indicator.setAttribute('aria-hidden', 'true');
    button.append(indicator, cell);
    button.addEventListener('click', () => setChoice('cell', cell));
    return button;
  }));
}

const arrivalState = { hour: null, minute: null };
const pad2 = number => String(number).padStart(2, '0');

function syncArrival() {
  const { hour, minute } = arrivalState;
  document.querySelectorAll('#arrival-hours .chip').forEach(chip => {
    const selected = Number(chip.dataset.value) === hour;
    chip.classList.toggle('selected', selected);
    chip.setAttribute('aria-pressed', String(selected));
  });
  document.querySelectorAll('#arrival-minutes .chip').forEach(chip => {
    const selected = Number(chip.dataset.value) === minute;
    chip.classList.toggle('selected', selected);
    chip.setAttribute('aria-pressed', String(selected));
  });
  inputs.arrival.value = hour !== null && minute !== null ? pad2(hour) + ':' + pad2(minute) : '';
  const result = document.getElementById('arrival-result');
  if (hour === null && minute === null) result.textContent = '';
  else {
    const period = hour === null ? '' : (hour < 12 ? '오전 ' : '오후 ');
    const shown = hour === null ? '--시' : (hour % 12 === 0 ? 12 : hour % 12) + '시';
    result.textContent = period + shown + ' ' + (minute === null ? '--분' : minute + '분');
  }
}

function clearArrival() {
  arrivalState.hour = null;
  arrivalState.minute = null;
  syncArrival();
}

function buildChips(containerId, values, label, key) {
  document.getElementById(containerId).replaceChildren(...values.map(value => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.dataset.value = String(value);
    chip.textContent = pad2(value) + label;
    chip.addEventListener('click', () => {
      arrivalState[key] = value;
      syncArrival();
      clearStatus();
    });
    return chip;
  }));
}
buildChips('arrival-hours', Array.from({ length: 18 }, (_, index) => index + 6), '시', 'hour');
buildChips('arrival-minutes', [0, 10, 20, 30, 40, 50], '분', 'minute');

function setChoice(name, value) {
  if (name === 'youthGroup') {
    customGroup = value === '__custom__';
    document.getElementById('custom-group-wrap').hidden = !customGroup;
    inputs.cell.value = '';
    inputs.youthGroup.value = customGroup ? customGroupInput.value.trim() : value;
    document.querySelectorAll('[data-options-for="youthGroup"] .option').forEach(button => {
      const selected = button.dataset.value === value;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    renderCellOptions();
    clearStatus();
    if (customGroup) customGroupInput.focus();
    return;
  }
  inputs[name].value = value;
  document.querySelectorAll('[data-options-for="' + name + '"] .option').forEach(button => {
    const selected = button.dataset.value === value;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  clearStatus();
  if (name === 'attendance') updateAttendance();
  if (name === 'transport' && value !== '자차') clearArrival();
}

inputs.phone.addEventListener('input', () => {
  const d = inputs.phone.value.replace(/\D/g, '').slice(0, 11);
  const head = d.startsWith('02') ? 2 : 3;
  const parts = [d.slice(0, head), d.slice(head, head + 4), d.slice(head + 4)];
  inputs.phone.value = parts.filter(Boolean).join('-');
  clearStatus();
});
inputs.rrn.addEventListener('input', () => {
  const digits = inputs.rrn.value.replace(/\D/g, '').slice(0, 13);
  inputs.rrn.value = digits.length > 6 ? digits.slice(0, 6) + '-' + digits.slice(6) : digits;
  clearStatus();
});
customGroupInput.addEventListener('input', () => { inputs.youthGroup.value = customGroupInput.value.trim(); clearStatus(); });
document.querySelectorAll('[data-options-for] .option').forEach(button => {
  button.setAttribute('aria-pressed', 'false');
  button.addEventListener('click', () => {
    setChoice(button.closest('[data-options-for]').dataset.optionsFor, button.dataset.value);
  });
});

// 토요일(1/23)만 부분 참석하는 경우에는 버스를 이용할 수 없습니다.
function busBlocked() {
  return inputs.attendance.value === '부분' && dayInputs.some(input => input.checked && input.value === '2027-01-23');
}

function syncTransport() {
  const blocked = busBlocked();
  const bus = document.querySelector('[data-options-for="transport"] [data-value="버스"]');
  bus.disabled = blocked;
  bus.setAttribute('aria-disabled', String(blocked));
  document.getElementById('transport-note').hidden = !blocked;
  if (blocked && inputs.transport.value === '버스') {
    inputs.transport.value = '';
    bus.classList.remove('selected');
    bus.setAttribute('aria-pressed', 'false');
  }
}

function syncDayButtons() {
  document.querySelectorAll('[data-day]').forEach(button => {
    const selected = dayInputs.find(input => input.value === button.dataset.day)?.checked || false;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
}

function updateAttendance() {
  const value = inputs.attendance.value;
  if (value === '전') {
    dayInputs.forEach(input => { input.checked = true; });
  } else if (value === '부분' && dayInputs.filter(input => input.checked).length !== 1) {
    dayInputs.forEach(input => { input.checked = false; });
  }
  syncDayButtons();
  syncTransport();
}

document.querySelectorAll('[data-day]').forEach(button => {
  button.setAttribute('aria-pressed', 'false');
  button.addEventListener('click', () => {
    const input = dayInputs.find(item => item.value === button.dataset.day);
    const next = !input.checked;
    if (inputs.attendance.value === '부분') dayInputs.forEach(item => { item.checked = false; });
    input.checked = next;
    syncDayButtons();
    syncTransport();
    clearStatus();
  });
});

function renderSummary() {
  const attendanceLabels = { '전': '전 일정', '부분': '부분 참석' };
  const rows = [
    ['소속', inputs.youthGroup.value, 'youthGroup'],
    ...(customGroup ? [] : [['소속 셀', inputs.cell.value, 'cell']]),
    ['이름', inputs.name.value.trim(), 'name'],
    ['연락처', inputs.phone.value.trim(), 'phone'],
    ['주민등록번호', inputs.rrn.value.replace(/^(\d{6}-\d)\d{6}$/, '$1******'), 'rrn'],
    ['참석 구분', attendanceLabels[inputs.attendance.value] || '', 'attendance']
  ];
  rows.push(['참석 날짜', dayInputs.filter(input => input.checked).map(input => Number(input.value.slice(-2)) + '일').join(', '), inputs.attendance.value === '부분' ? 'days' : 'attendance']);
  rows.push(['이동 수단', inputs.transport.value, 'transport']);
  if (inputs.transport.value === '자차') rows.push(['도착 예정', inputs.arrival.value, 'arrival']);
  rows.push(['취침 여부', inputs.sleep.value, 'sleep']);
  rows.push(['기도제목', inputs.prayer.value.trim() || '입력 안 함', 'prayer']);
  rows.push(['요청사항', inputs.request.value.trim() || '입력 안 함', 'request']);
  const target = document.getElementById('review-summary');
  target.replaceChildren(...rows.map(([label, value, step]) => {
    const row = document.createElement('div');
    row.className = 'review-row';
    const title = document.createElement('span');
    title.textContent = label;
    const answer = document.createElement('strong');
    answer.textContent = value;
    if (step === 'prayer' || step === 'request') answer.classList.add('multiline');
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'review-edit';
    edit.textContent = '수정';
    edit.setAttribute('aria-label', label + ' 수정');
    edit.addEventListener('click', () => { returnToReview = true; goTo(step); });
    row.append(title, answer, edit);
    return row;
  }));
}

// 선택 질문은 비어 있으면 "건너뛰기"로 표시합니다.
function updateNextLabel() {
  const next = document.getElementById('next-step');
  const skip = (currentStep === 'prayer' || currentStep === 'request') && !inputs[currentStep].value.trim();
  next.textContent = skip ? '건너뛰기 →' : '다음 →';
}

['prayer', 'request'].forEach(name => {
  inputs[name].addEventListener('input', () => {
    document.getElementById(name + '-count').textContent = String(inputs[name].value.length);
    updateNextLabel();
  });
});

function stepLabel(key, sequence) {
  const parent = SUB_OF[key] || key;
  const number = String(mainSteps.indexOf(parent) + 1).padStart(2, '0');
  if (!SUB_OF[key]) return number;
  const sub = sequence.filter(item => SUB_OF[item] === parent).indexOf(key) + 1;
  return number + '-' + sub;
}

function renderStep() {
  syncTransport();
  const sequence = activeSteps();
  if (!sequence.includes(currentStep)) currentStep = sequence[0];
  const position = sequence.indexOf(currentStep);
  document.querySelectorAll('.step-panel').forEach(panel => {
    const visible = panel.dataset.step === currentStep;
    panel.hidden = !visible;
    if (visible && panel.dataset.step !== 'review') panel.querySelector('.step-kicker').textContent = 'QUESTION ' + stepLabel(currentStep, sequence);
    if (visible && !reduceMotion.matches) {
      panel.classList.remove('is-entering');
      void panel.offsetWidth;
      panel.classList.add('is-entering');
    }
  });
  document.getElementById('step-counter').textContent =
    stepLabel(currentStep, sequence) + ' / ' + String(mainSteps.length).padStart(2, '0');
  const percent = Math.round((position + 1) / sequence.length * 100);
  document.getElementById('progress-fill').style.width = percent + '%';
  document.querySelector('.progress').setAttribute('aria-valuenow', String(percent));
  const previous = document.getElementById('previous-step');
  previous.hidden = position === 0;
  previous.textContent = returnToReview ? '← 확인 화면으로' : '← 이전';
  document.getElementById('next-step').hidden = currentStep === 'review';
  document.getElementById('submit-button').hidden = currentStep !== 'review';
  if (currentStep === 'review') renderSummary();
  clearStatus();
  if (!applicationPage.hidden) {
    const panel = document.querySelector('.step-panel:not([hidden])');
    const field = panel.querySelector('input.entry:not([type=hidden])');
    (field && field.offsetParent !== null ? field : panel.querySelector('.step-title')).focus({ preventScroll: true });
    updateNextLabel();
  }
}

function validateStep(key) {
  if (key === 'youthGroup') {
    if (customGroup) { if (!inputs.youthGroup.value) return '소속을 입력해 주세요.'; }
    else if (!CELLS[inputs.youthGroup.value]) return '소속을 선택해 주세요.';
  }
  if (key === 'cell' && !(CELLS[inputs.youthGroup.value] || []).includes(inputs.cell.value)) return '소속 셀을 선택해 주세요.';
  if (key === 'name' && !inputs.name.value.trim()) return '이름을 입력해 주세요.';
  if (key === 'attendance' && !['전', '부분'].includes(inputs.attendance.value)) return '참석 구분을 선택해 주세요.';
  if (key === 'days') {
    const count = dayInputs.filter(input => input.checked).length;
    if (count !== 1) return '부분 참석 날짜를 하나 선택해 주세요.';
  }
  if (key === 'transport') {
    if (!['자차', '버스'].includes(inputs.transport.value)) return '이동 수단을 선택해 주세요.';
    if (inputs.transport.value === '버스' && busBlocked()) return '토요일 부분 참석은 버스를 이용할 수 없습니다.';
  }
  if (key === 'rrn' && !/^\d{6}-\d{7}$/.test(inputs.rrn.value)) return '주민등록번호 13자리를 확인해 주세요.';
  if (key === 'arrival' && !/^\d{2}:\d{2}$/.test(inputs.arrival.value)) return '도착 예정 시간을 입력해 주세요.';
  if (key === 'sleep' && !['취침', '취침 안 함'].includes(inputs.sleep.value)) return '취침 여부를 선택해 주세요.';
  if (key === 'phone' && !/^[0-9+() -]{9,20}$/.test(inputs.phone.value.trim())) return '연락처를 확인해 주세요.';
  if (key === 'review' && !inputs.consent.checked) return '개인정보 수집·이용 동의가 필요합니다.';
  return '';
}

function goTo(step) {
  currentStep = step;
  if (step === 'review') returnToReview = false;
  history.pushState({ step }, '', '#apply');
  renderStep();
  applicationPage.scrollIntoView({ behavior: reduceMotion.matches ? 'instant' : 'smooth', block: 'start' });
}

function goNext() {
  const error = validateStep(currentStep);
  if (error) { showError(error); return; }
  const sequence = activeSteps();
  if (returnToReview) {
    const invalid = sequence.find(key => key !== 'review' && validateStep(key));
    goTo(invalid || 'review');
    return;
  }
  goTo(sequence[sequence.indexOf(currentStep) + 1]);
}

document.getElementById('next-step').addEventListener('click', goNext);
document.getElementById('previous-step').addEventListener('click', () => {
  if (returnToReview) { goTo('review'); return; }
  const sequence = activeSteps();
  goTo(sequence[sequence.indexOf(currentStep) - 1]);
});
[inputs.name, inputs.phone, inputs.rrn, customGroupInput].forEach(input => {
  input.setAttribute('enterkeyhint', 'next');
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); document.getElementById('next-step').click(); }
  });
});

form.addEventListener('submit', event => {
  for (const key of activeSteps()) {
    const error = validateStep(key);
    if (error) {
      event.preventDefault();
      currentStep = key;
      renderStep();
      showError(error);
      return;
    }
  }
  if (!FORM_ENDPOINT) {
    event.preventDefault();
    showError('접수 주소가 설정되지 않았습니다. 운영진에게 문의해 주세요.');
    return;
  }
  inputs.name.value = inputs.name.value.trim();
  inputs.phone.value = inputs.phone.value.trim();
  if (inlineAvailable) {
    const requestId = crypto.randomUUID();
    pendingRequestId = requestId;
    document.getElementById('request-id').value = requestId;
    form.target = responseFrame.name;
    status.className = 'status pending';
    status.textContent = '신청 내용을 저장하고 있습니다…';
    responseTimer = setTimeout(() => {
      if (pendingRequestId !== requestId) return;
      pendingRequestId = null;
      showError('접수 결과를 확인하지 못했습니다. 중복 신청을 피하려면 운영진에게 먼저 확인해 주세요.');
      setSubmitting(false);
    }, 30000);
  } else {
    form.removeAttribute('target');
    document.getElementById('request-id').value = '';
  }
  setSubmitting(true);
  if (!inlineAvailable) allowUnload = true;
});
window.addEventListener('pageshow', () => { allowUnload = false; setSubmitting(false); });

if (!reduceMotion.matches && 'IntersectionObserver' in window) {
  const elements = document.querySelectorAll('.verse .eyebrow,.verse h2,.verse blockquote,.verse-ref,#info .eyebrow,#info h2,.section-intro,.info-card,.schedule-row,.section-note');
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
  }), { threshold: .12, rootMargin: '0px 0px -20px 0px' });
  elements.forEach((element, index) => {
    element.classList.add('reveal');
    element.style.setProperty('--delay', (index % 4) * 70 + 'ms');
    observer.observe(element);
  });
  document.body.classList.add('motion-ready');
  let scheduled = false;
  window.addEventListener('scroll', () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      if (infoPage.hidden) return;
      const rect = document.querySelector('.poster').getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > innerHeight) return;
      document.querySelector('.poster-star').style.setProperty('--star-y', Math.max(-32, Math.min(32, -rect.top * .07)) + 'px');
    });
  }, { passive: true });
}

// 얼리버드 마감(2026-12-13, 한국 시간) 카운트다운
(function earlyBird() {
  const kst = new Date(Date.now() + 9 * 3600000);
  const today = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate());
  const left = Math.round((Date.UTC(2026, 11, 13) - today) / 86400000);
  const badge = document.getElementById('fee-badge');
  if (!badge) return;
  if (left >= 0) {
    badge.textContent = left === 0 ? '오늘 마감' : 'D-' + left;
    return;
  }
  badge.textContent = '얼리버드 마감';
  badge.classList.add('closed');
  document.getElementById('fee-title').textContent = '참가비 60,000원';
  document.getElementById('fee-note').textContent = '얼리버드 신청이 마감되었습니다.';
  document.getElementById('fee-footnote').hidden = true;
})();

showView();

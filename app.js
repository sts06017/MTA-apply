const FORM_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxS43nAO9P97duC8VEfgx94g-hGQwpZ_jCxQvxdPWFL7GhS229Xml0N9f-4n6xP7zo/exec';
const infoPage = document.getElementById('information-page');
const applicationPage = document.getElementById('application-page');
const completePage = document.getElementById('complete-page');
const responseFrame = document.getElementById('response-frame');
const form = document.getElementById('retreat-form');
const allSteps = ['youthGroup', 'cell', 'name', 'phone', 'rrn', 'attendance', 'days', 'transport', 'arrival', 'sleep', 'size', 'prayer', 'request', 'review'];
// 조건에 따라 나타나는 질문은 앞 질문의 하위 번호(예: 05-1)로 표시해 전체 개수가 변하지 않게 합니다.
const SUB_OF = { cell: 'youthGroup', days: 'attendance', arrival: 'transport' };
const mainSteps = allSteps.filter(key => !SUB_OF[key]);
const inputs = Object.fromEntries(['youthGroup', 'name', 'cell', 'phone', 'rrn', 'attendance', 'transport', 'arrival', 'sleep', 'size', 'prayer', 'request', 'consent'].map(id => [id, document.getElementById(id)]));
const dayInputs = [...document.querySelectorAll('input[name="days"]')];
const SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
const CELLS = {
  '에임홀리': ['관용셀', '희영셀', '서우셀', '설희셀', '하은셀', '병민셀', '프렌즈팀', '없음'],
  '에임하이': ['서영셀', '효성셀', '지민셀', '수빈셀', '프렌즈팀', '없음']
};
const customGroupInput = document.getElementById('custom-group');
let customGroup = false;
let returnToReview = false;
let showRrn = false;
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
  updateFeeNotice();
  document.getElementById('complete-title').focus({ preventScroll: true });
}

// 완료 화면이 뜨는 시점(한국 시간)이 12월 14일 0시 이전이면 얼리버드 50,000원, 이후면 60,000원
function updateFeeNotice() {
  const early = Date.now() < Date.parse('2026-12-14T00:00:00+09:00');
  const pill = document.getElementById('fee-pill');
  pill.textContent = early ? '얼리버드' : '일반';
  pill.classList.toggle('late', !early);
  document.getElementById('fee-amount').textContent = early ? '50,000원' : '60,000원';
  document.getElementById('fee-warn-note').textContent = early
    ? '신청자 이름과 다르면 입금 확인이 어려워요. 얼리버드는 12/13까지예요.'
    : '신청자 이름과 다르면 입금 확인이 어려워요. (얼리버드 기간 종료)';
}

let copiedTimer = null;
document.getElementById('copy-account').addEventListener('click', async () => {
  const number = document.getElementById('account-number').textContent.trim();
  let copied = false;
  try {
    await navigator.clipboard.writeText(number);
    copied = true;
  } catch (error) {
    const helper = document.createElement('textarea');
    helper.value = number;
    helper.setAttribute('readonly', '');
    helper.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.append(helper);
    helper.select();
    try { copied = document.execCommand('copy'); } catch (fallbackError) { copied = false; }
    helper.remove();
  }
  const button = document.getElementById('copy-account');
  const statusLine = document.getElementById('copy-status');
  document.getElementById('copy-text').textContent = copied ? '복사됨' : '길게 눌러 복사';
  button.classList.add('copied');
  statusLine.textContent = copied ? '계좌번호를 복사했습니다.' : '복사하지 못했습니다. 계좌번호를 길게 눌러 복사해 주세요.';
  clearTimeout(copiedTimer);
  copiedTimer = setTimeout(() => { button.classList.remove('copied'); }, 2200);
});

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

// 도착 예정 시간: 오전/오후 · 시 · 분을 휠(스크롤)로 고르는 선택기
const WHEEL_ITEM = 44;
const WHEEL_DEFAULT = { period: 0, hour: 10, minute: 0 };
const arrivalState = { ...WHEEL_DEFAULT };
const wheelColumns = {
  period: { element: document.getElementById('wheel-period'), values: ['오전', '오후'], label: value => value },
  hour: { element: document.getElementById('wheel-hour'), values: Array.from({ length: 12 }, (_, index) => index + 1), label: value => String(value) },
  minute: { element: document.getElementById('wheel-minute'), values: Array.from({ length: 6 }, (_, index) => index * 10), label: value => String(value).padStart(2, '0') }
};

function arrivalIndex(key) {
  const { values } = wheelColumns[key];
  return key === 'period' ? arrivalState.period : values.indexOf(arrivalState[key]);
}

function arrivalText() {
  return wheelColumns.period.values[arrivalState.period] + ' ' + arrivalState.hour + '시 ' + String(arrivalState.minute).padStart(2, '0') + '분';
}

function syncArrival() {
  Object.entries(wheelColumns).forEach(([key, { element }]) => {
    const active = arrivalIndex(key);
    element.querySelectorAll('.wheel-item').forEach((item, index) => {
      item.classList.toggle('active', index === active);
      item.setAttribute('aria-selected', String(index === active));
    });
  });
  const hour24 = (arrivalState.hour % 12) + arrivalState.period * 12;
  inputs.arrival.value = String(hour24).padStart(2, '0') + ':' + String(arrivalState.minute).padStart(2, '0');
  document.getElementById('arrival-result').textContent = arrivalText();
}

function scrollWheelsToState(behavior) {
  Object.entries(wheelColumns).forEach(([key, { element }]) => {
    element.scrollTo({ top: arrivalIndex(key) * WHEEL_ITEM, behavior });
  });
}

function clearArrival() {
  Object.assign(arrivalState, WHEEL_DEFAULT);
  inputs.arrival.value = '';
  document.getElementById('arrival-result').textContent = '';
  wheelColumns.period.element.querySelectorAll('.wheel-item.active').forEach(item => item.classList.remove('active'));
}

// 도착 시간 단계에 들어오면 기본값(오전 10:00)을 선택한 상태로 보여 줍니다.
function showArrivalWheel() {
  syncArrival();
  requestAnimationFrame(() => scrollWheelsToState('instant'));
}

Object.entries(wheelColumns).forEach(([key, { element, values, label }]) => {
  element.replaceChildren(...values.map((value, index) => {
    const item = document.createElement('div');
    item.className = 'wheel-item';
    item.setAttribute('role', 'option');
    item.textContent = label(value);
    item.addEventListener('click', () => element.scrollTo({ top: index * WHEEL_ITEM, behavior: reduceMotion.matches ? 'instant' : 'smooth' }));
    return item;
  }));
  let frame = null;
  element.addEventListener('scroll', () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      const index = Math.max(0, Math.min(values.length - 1, Math.round(element.scrollTop / WHEEL_ITEM)));
      const next = key === 'period' ? index : values[index];
      if (arrivalState[key] === next && inputs.arrival.value) return;
      arrivalState[key] = next;
      syncArrival();
      clearStatus();
    });
  }, { passive: true });
  element.addEventListener('keydown', event => {
    const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const index = Math.max(0, Math.min(values.length - 1, arrivalIndex(key) + step));
    element.scrollTo({ top: index * WHEEL_ITEM, behavior: reduceMotion.matches ? 'instant' : 'smooth' });
  });
});

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
// 임시로 선택할 수 없게 막아 둔 항목입니다. 다시 열려면 아래 목록을 비우면 됩니다. (예: { attendance: [], transport: [] })
const TEMP_DISABLED = { attendance: ['부분'], transport: ['자차'] };

document.querySelectorAll('[data-options-for] .option').forEach(button => {
  button.setAttribute('aria-pressed', 'false');
  const group = button.closest('[data-options-for]').dataset.optionsFor;
  if ((TEMP_DISABLED[group] || []).includes(button.dataset.value)) {
    button.disabled = true;
    button.setAttribute('aria-disabled', 'true');
    const note = document.createElement('span');
    note.className = 'soon';
    note.textContent = '현재 선택 불가';
    button.append(note);
  }
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
    ['주민등록번호', showRrn ? inputs.rrn.value : inputs.rrn.value.replace(/^(\d{6}-\d)\d{6}$/, '$1******'), 'rrn'],
    ['참석 구분', attendanceLabels[inputs.attendance.value] || '', 'attendance']
  ];
  rows.push(['참석 날짜', dayInputs.filter(input => input.checked).map(input => Number(input.value.slice(-2)) + '일').join(', '), inputs.attendance.value === '부분' ? 'days' : 'attendance']);
  rows.push(['이동 수단', inputs.transport.value, 'transport']);
  if (inputs.transport.value === '자차') rows.push(['도착 예정', arrivalText(), 'arrival']);
  rows.push(['취침 여부', inputs.sleep.value, 'sleep']);
  rows.push(['단체티 사이즈', inputs.size.value, 'size']);
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
    if (step === 'rrn') {
      const reveal = document.createElement('button');
      reveal.type = 'button';
      reveal.className = 'review-edit';
      reveal.textContent = showRrn ? '숨기기' : '보기';
      reveal.setAttribute('aria-pressed', String(showRrn));
      reveal.setAttribute('aria-label', '주민등록번호 ' + (showRrn ? '숨기기' : '전체 보기'));
      reveal.addEventListener('click', () => { showRrn = !showRrn; renderSummary(); });
      const actions = document.createElement('div');
      actions.className = 'review-actions';
      actions.append(reveal, edit);
      row.classList.add('rrn');
      row.append(title, answer, actions);
      return row;
    }
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
  if (currentStep === 'arrival') showArrivalWheel();
  if (currentStep !== 'review') showRrn = false;
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
  if (key === 'attendance' && (!['전', '부분'].includes(inputs.attendance.value) || TEMP_DISABLED.attendance.includes(inputs.attendance.value))) return '참석 구분을 선택해 주세요.';
  if (key === 'days') {
    const count = dayInputs.filter(input => input.checked).length;
    if (count !== 1) return '부분 참석 날짜를 하나 선택해 주세요.';
  }
  if (key === 'transport') {
    if (!['자차', '버스'].includes(inputs.transport.value) || TEMP_DISABLED.transport.includes(inputs.transport.value)) return '이동 수단을 선택해 주세요.';
    if (inputs.transport.value === '버스' && busBlocked()) return '토요일 부분 참석은 버스를 이용할 수 없습니다.';
  }
  if (key === 'rrn' && !/^\d{6}-\d{7}$/.test(inputs.rrn.value)) return '주민등록번호 13자리를 확인해 주세요.';
  if (key === 'arrival' && !/^\d{2}:\d{2}$/.test(inputs.arrival.value)) return '도착 예정 시간을 입력해 주세요.';
  if (key === 'size' && !SIZES.includes(inputs.size.value)) return '단체티 사이즈를 선택해 주세요.';
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

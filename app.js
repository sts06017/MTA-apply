const FORM_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxS43nAO9P97duC8VEfgx94g-hGQwpZ_jCxQvxdPWFL7GhS229Xml0N9f-4n6xP7zo/exec';
const infoPage = document.getElementById('information-page');
const applicationPage = document.getElementById('application-page');
const completePage = document.getElementById('complete-page');
const responseFrame = document.getElementById('response-frame');
const form = document.getElementById('retreat-form');
const allSteps = ['youthGroup', 'cell', 'name', 'phone', 'rrn', 'attendance', 'days', 'transport', 'arrival', 'sleep', 'review'];
// 조건에 따라 나타나는 질문은 앞 질문의 하위 번호(예: 05-1)로 표시해 전체 개수가 변하지 않게 합니다.
const SUB_OF = { cell: 'youthGroup', days: 'attendance', arrival: 'transport' };
const mainSteps = allSteps.filter(key => !SUB_OF[key]);
const inputs = Object.fromEntries(['youthGroup', 'name', 'cell', 'phone', 'rrn', 'attendance', 'transport', 'arrival', 'sleep', 'consent'].map(id => [id, document.getElementById(id)]));
const dayInputs = [...document.querySelectorAll('input[name="days"]')];
const CELLS = {
  '에임홀리': ['관용셀', '희영셀', '서우셀', '설희셀', '하은셀', '병민셀', '프렌즈팀'],
  '에임하이': ['서영셀', '효성셀', '지민셀', '수빈셀', '프렌즈팀']
};
const customGroupInput = document.getElementById('custom-group');
let customGroup = false;
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
window.addEventListener('popstate', showView);

function clearStatus() { status.className = 'status'; status.textContent = ''; }
function showError(message) { status.className = 'status'; status.textContent = message; }

function trustedScriptOrigin(origin) {
  return origin === 'https://script.google.com' ||
    origin === 'https://script.googleusercontent.com' ||
    /^https:\/\/[a-z0-9-]+-script\.googleusercontent\.com$/.test(origin);
}

function showCompletion() {
  clearTimeout(responseTimer);
  pendingRequestId = null;
  form.reset();
  customGroup = false;
  customGroupInput.value = '';
  document.getElementById('custom-group-wrap').hidden = true;
  renderCellOptions();
  document.getElementById('submit-button').disabled = false;
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
}

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
    document.getElementById('submit-button').disabled = false;
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
  if (name === 'transport' && value !== '자차') inputs.arrival.value = '';
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
}

document.querySelectorAll('[data-day]').forEach(button => {
  button.setAttribute('aria-pressed', 'false');
  button.addEventListener('click', () => {
    const input = dayInputs.find(item => item.value === button.dataset.day);
    const next = !input.checked;
    if (inputs.attendance.value === '부분') dayInputs.forEach(item => { item.checked = false; });
    input.checked = next;
    syncDayButtons();
    clearStatus();
  });
});

function renderSummary() {
  const attendanceLabels = { '전': '전 일정', '부분': '부분 참석' };
  const rows = [
    ['소속', inputs.youthGroup.value],
    ...(customGroup ? [] : [['소속 셀', inputs.cell.value]]),
    ['이름', inputs.name.value.trim()],
    ['연락처', inputs.phone.value.trim()],
    ['주민등록번호', inputs.rrn.value.replace(/^(\d{6}-\d)\d{6}$/, '$1******')],
    ['참석 구분', attendanceLabels[inputs.attendance.value] || '']
  ];
  rows.push(['참석 날짜', dayInputs.filter(input => input.checked).map(input => Number(input.value.slice(-2)) + '일').join(', ')]);
  rows.push(['이동 수단', inputs.transport.value]);
  if (inputs.transport.value === '자차') rows.push(['도착 예정', inputs.arrival.value]);
  rows.push(['취침 여부', inputs.sleep.value]);
  const target = document.getElementById('review-summary');
  target.replaceChildren(...rows.map(([label, value]) => {
    const row = document.createElement('div');
    row.className = 'review-row';
    const title = document.createElement('span');
    title.textContent = label;
    const answer = document.createElement('strong');
    answer.textContent = value;
    row.append(title, answer);
    return row;
  }));
}

function stepLabel(key, sequence) {
  const parent = SUB_OF[key] || key;
  const number = String(mainSteps.indexOf(parent) + 1).padStart(2, '0');
  if (!SUB_OF[key]) return number;
  const sub = sequence.filter(item => SUB_OF[item] === parent).indexOf(key) + 1;
  return number + '-' + sub;
}

function renderStep() {
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
  document.getElementById('previous-step').hidden = position === 0;
  document.getElementById('next-step').hidden = currentStep === 'review';
  document.getElementById('submit-button').hidden = currentStep !== 'review';
  if (currentStep === 'review') renderSummary();
  if (!applicationPage.hidden) document.querySelector('.step-panel:not([hidden]) .step-title').focus({ preventScroll: true });
  clearStatus();
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
  if (key === 'transport' && !['자차', '버스'].includes(inputs.transport.value)) return '이동 수단을 선택해 주세요.';
  if (key === 'rrn' && !/^\d{6}-\d{7}$/.test(inputs.rrn.value)) return '주민등록번호 13자리를 확인해 주세요.';
  if (key === 'arrival' && !/^\d{2}:\d{2}$/.test(inputs.arrival.value)) return '도착 예정 시간을 입력해 주세요.';
  if (key === 'sleep' && !['취침', '취침 안 함'].includes(inputs.sleep.value)) return '취침 여부를 선택해 주세요.';
  if (key === 'phone' && !/^[0-9+() -]{9,20}$/.test(inputs.phone.value.trim())) return '연락처를 확인해 주세요.';
  if (key === 'review' && !inputs.consent.checked) return '개인정보 수집·이용 동의가 필요합니다.';
  return '';
}

document.getElementById('next-step').addEventListener('click', () => {
  const error = validateStep(currentStep);
  if (error) { showError(error); return; }
  const sequence = activeSteps();
  currentStep = sequence[sequence.indexOf(currentStep) + 1];
  renderStep();
  applicationPage.scrollIntoView({ behavior: reduceMotion.matches ? 'instant' : 'smooth', block: 'start' });
});
document.getElementById('previous-step').addEventListener('click', () => {
  const sequence = activeSteps();
  currentStep = sequence[sequence.indexOf(currentStep) - 1];
  renderStep();
  applicationPage.scrollIntoView({ behavior: reduceMotion.matches ? 'instant' : 'smooth', block: 'start' });
});
[inputs.name, inputs.phone, inputs.rrn, inputs.arrival, customGroupInput].forEach(input => {
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
    }, 30000);
  } else {
    form.removeAttribute('target');
    document.getElementById('request-id').value = '';
  }
  document.getElementById('submit-button').disabled = true;
});
window.addEventListener('pageshow', () => { document.getElementById('submit-button').disabled = false; });

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

showView();

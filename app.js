const FORM_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxS43nAO9P97duC8VEfgx94g-hGQwpZ_jCxQvxdPWFL7GhS229Xml0N9f-4n6xP7zo/exec';
// 공개키만 이 파일에 둡니다. 개인키는 Git 저장소 밖에 보관합니다.
const INSURANCE_PUBLIC_KEY = 'MIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEAuWOUOyFq2bGpIcnWT07Mng8Pm6ROArKKWOCdZCfcOlDReiPWBMgQk9b7qTq+fEMflmU2Rw+Ql+ewXVU6cfxT2HKWiSJxzlJXCq/KOauBtrJo8Yu2JgHxWNy7RtRynz9hLf0HzZ7tOVJAC2Bsd0PvRHGzlPaBYBS+sU1UdqqTdRfNEfV76KdvWSJNKFIr9xwuDwoTLSow20eW04xfkLwUWSsSSjv5InemHopCGpEo35roDBTVNxFOjbDcV9KEkDMvxmv3ULqaS7o6Jk5FsXDg49ozywtoZ7S+SDp7NZcptEZ6VHMe2MiLGQREK4FtpCdDqurinAd6XOB7bjHxWJ4cGdRuqzsG3OmNXkMLOnhQnrQMfAgNWeyD9qteeCunh+tjlQIRP4MUt11263PeqWZ0U6CQJ7sCw0S4k2Q9v+yVjlEoU8CKTzqPiyiT6Dc+HeDmxyZ/zjw+uEFz58Gozl/gynEosgBGBD0xCRg5hSodKVCc/aqMuYWGz4oMrRYibUf7AgMBAAE=';
const infoPage = document.getElementById('information-page');
const applicationPage = document.getElementById('application-page');
const completePage = document.getElementById('complete-page');
const responseFrame = document.getElementById('response-frame');
const form = document.getElementById('retreat-form');
const allSteps = ['youthGroup', 'name', 'cell', 'attendance', 'days', 'transport', 'phone', 'residentNumber', 'review'];
const inputs = Object.fromEntries(['youthGroup', 'name', 'cell', 'attendance', 'transport', 'phone', 'consent'].map(id => [id, document.getElementById(id)]));
const residentNumber = document.getElementById('resident-number');
const rrnCiphertext = document.getElementById('rrn-ciphertext');
const dayInputs = [...document.querySelectorAll('input[name="days"]')];
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
    (key !== 'days' || attendance === '부분') &&
    (!['transport', 'residentNumber'].includes(key) || attendance !== '불참석')
  );
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'instant' : 'smooth' });
}

function showView() {
  const applying = location.hash === '#apply';
  if (!applying) {
    residentNumber.value = '';
    rrnCiphertext.value = '';
  }
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
    inlineAvailable = data.rrnEncrypted === true;
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

function setChoice(name, value) {
  inputs[name].value = value;
  document.querySelectorAll('[data-options-for="' + name + '"] .option').forEach(button => {
    const selected = button.dataset.value === value;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  clearStatus();
  if (name === 'attendance') updateAttendance();
}

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
  } else if (value === '불참석') {
    residentNumber.value = '';
    rrnCiphertext.value = '';
    dayInputs.forEach(input => { input.checked = false; });
    inputs.transport.value = '';
    document.querySelectorAll('[data-options-for="transport"] .option').forEach(button => {
      button.classList.remove('selected');
      button.setAttribute('aria-pressed', 'false');
    });
  } else if (value === '부분' && dayInputs.every(input => input.checked)) {
    dayInputs.forEach(input => { input.checked = false; });
  }
  syncDayButtons();
}

document.querySelectorAll('[data-day]').forEach(button => {
  button.setAttribute('aria-pressed', 'false');
  button.addEventListener('click', () => {
    const input = dayInputs.find(item => item.value === button.dataset.day);
    input.checked = !input.checked;
    syncDayButtons();
    clearStatus();
  });
});

function renderSummary() {
  const attendanceLabels = { '전': '전 일정', '부분': '부분 참석', '불참석': '불참석' };
  const rows = [
    ['청년 구분', inputs.youthGroup.value],
    ['이름', inputs.name.value.trim()],
    ['소속 셀', inputs.cell.value.trim()],
    ['참석 구분', attendanceLabels[inputs.attendance.value] || '']
  ];
  if (inputs.attendance.value !== '불참석') {
    rows.push(['참석 날짜', dayInputs.filter(input => input.checked).map(input => Number(input.value.slice(-2)) + '일').join(', ')]);
    rows.push(['이동 수단', inputs.transport.value]);
  }
  rows.push(['연락처', inputs.phone.value.trim()]);
  if (inputs.attendance.value !== '불참석') rows.push(['보험 가입 정보', '입력 완료 · 확인 화면에 표시하지 않음']);
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

function renderStep() {
  const sequence = activeSteps();
  if (!sequence.includes(currentStep)) currentStep = sequence[0];
  const position = sequence.indexOf(currentStep);
  document.querySelectorAll('.step-panel').forEach(panel => {
    const visible = panel.dataset.step === currentStep;
    panel.hidden = !visible;
    if (visible && !reduceMotion.matches) {
      panel.classList.remove('is-entering');
      void panel.offsetWidth;
      panel.classList.add('is-entering');
    }
  });
  document.getElementById('step-counter').textContent =
    String(position + 1).padStart(2, '0') + ' / ' + String(sequence.length).padStart(2, '0');
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
  if (key === 'youthGroup' && !['하이', '홀리'].includes(inputs.youthGroup.value)) return '청년 구분을 선택해 주세요.';
  if (key === 'name' && !inputs.name.value.trim()) return '이름을 입력해 주세요.';
  if (key === 'cell' && !inputs.cell.value.trim()) return '소속 셀을 입력해 주세요.';
  if (key === 'attendance' && !['전', '부분', '불참석'].includes(inputs.attendance.value)) return '참석 구분을 선택해 주세요.';
  if (key === 'days') {
    const count = dayInputs.filter(input => input.checked).length;
    if (count < 1 || count > 2) return '부분 참석 날짜를 하나 또는 두 개 선택해 주세요.';
  }
  if (key === 'transport' && !['자차', '버스'].includes(inputs.transport.value)) return '이동 수단을 선택해 주세요.';
  if (key === 'phone' && !/^[0-9+() -]{9,20}$/.test(inputs.phone.value.trim())) return '연락처를 확인해 주세요.';
  if (key === 'residentNumber' && !/^\d{6}-?\d{7}$/.test(residentNumber.value.trim())) return '주민등록번호 13자리를 확인해 주세요.';
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
[inputs.name, inputs.cell, inputs.phone, residentNumber].forEach(input => {
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); document.getElementById('next-step').click(); }
  });
});

async function encryptResidentNumber(value) {
  const binary = atob(INSURANCE_PUBLIC_KEY);
  const keyBytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  const key = await crypto.subtle.importKey('spki', keyBytes, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']);
  const encrypted = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, key, new TextEncoder().encode(value.replace(/\D/g, '')));
  return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  for (const key of activeSteps()) {
    const error = validateStep(key);
    if (error) {
      currentStep = key;
      renderStep();
      showError(error);
      return;
    }
  }
  if (!FORM_ENDPOINT || !inlineAvailable) {
    showError('보험 정보 접수 서버가 아직 준비되지 않았습니다. 운영진에게 문의해 주세요.');
    return;
  }
  inputs.name.value = inputs.name.value.trim();
  inputs.cell.value = inputs.cell.value.trim();
  inputs.phone.value = inputs.phone.value.trim();
  const submitButton = document.getElementById('submit-button');
  submitButton.disabled = true;
  try {
    rrnCiphertext.value = inputs.attendance.value === '불참석' ? '' : await encryptResidentNumber(residentNumber.value.trim());
  } catch (error) {
    rrnCiphertext.value = '';
    submitButton.disabled = false;
    showError('보험 정보를 암호화하지 못했습니다. 보안 연결에서 다시 시도해 주세요.');
    return;
  }
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
      document.getElementById('submit-button').disabled = false;
      showError('접수 결과를 확인하지 못했습니다. 중복 신청을 피하려면 운영진에게 먼저 확인해 주세요.');
    }, 30000);
  }
  form.submit();
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

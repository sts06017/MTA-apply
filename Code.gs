/**
 * Google Sheets > 확장 프로그램 > Apps Script에 붙여넣을 서버 코드.
 * GitHub Pages에는 배포하지 않습니다.
 */
const SHEET_NAME = '신청내역';
const ALLOWED_DAYS = ['2027-01-22', '2027-01-23', '2027-01-24'];
const SITE_ORIGIN = 'https://sts06017.github.io';

function doGet(e) {
  const requestId = safeRequestId(e && e.parameter && e.parameter.mtaProbe);
  if (requestId) return resultPage('ready', requestId);
  return HtmlService.createHtmlOutput('MTA 신청 접수 웹 앱입니다.');
}

function doPost(e) {
  const requestId = safeRequestId(e && e.parameter && e.parameter.requestId);
  try {
    const p = e && e.parameter ? e.parameter : {};
    const days = e && e.parameters && e.parameters.days ? e.parameters.days : [];
    const name = clean(p.name, 40);
    const phone = clean(p.phone, 20);
    const cell = clean(p.cell, 40);
    const youthGroup = clean(p.youthGroup, 10);
    const attendance = clean(p.attendance, 10);
    const transport = clean(p.transport, 10);

    if (!name || !cell || !/^[0-9+() -]{9,20}$/.test(phone)) throw new Error('invalid');
    if (!['하이', '홀리'].includes(youthGroup)) throw new Error('invalid');
    if (!['전', '부분', '불참석'].includes(attendance)) throw new Error('invalid');
    if (p.consent !== 'yes') throw new Error('invalid');
    if (attendance === '불참석') {
      if (days.length || transport) throw new Error('invalid');
    } else {
      if (!['자차', '버스'].includes(transport)) throw new Error('invalid');
      if (!days.length || days.some(day => !ALLOWED_DAYS.includes(day))) throw new Error('invalid');
      if (new Set(days).size !== days.length) throw new Error('invalid');
      if (attendance === '전' && days.length !== ALLOWED_DAYS.length) throw new Error('invalid');
      if (attendance === '부분' && days.length === ALLOWED_DAYS.length) throw new Error('invalid');
    }

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet && spreadsheet.getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error('missing-sheet');
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      sheet.appendRow([
        new Date(), safeText(youthGroup), safeText(name), safeText(cell),
        safeText(attendance), safeText(days.join(', ')), safeText(transport),
        safeText(phone)
      ]);
    } finally {
      lock.releaseLock();
    }
    return resultPage('success', requestId);
  } catch (error) {
    console.error('Submission failed: ' + error.message);
    return resultPage('error', requestId);
  }
}

function clean(value, maxLength) {
  const text = String(value || '').trim();
  if (text.length > maxLength) throw new Error('too-long');
  return text;
}

function safeText(value) {
  const text = String(value || '');
  return /^[=+\-@\t\r]/.test(text) ? "'" + text : text;
}

function safeRequestId(value) {
  const text = String(value || '');
  return /^[a-f0-9-]{20,64}$/i.test(text) ? text : '';
}

function resultPage(kind, requestId) {
  const success = kind === 'success';
  const ready = kind === 'ready';
  const title = ready ? '연결을 확인했습니다.' : success ? '신청이 접수되었습니다.' : '접수를 확인하지 못했습니다.';
  const message = ready ? '신청 페이지에서 계속 진행해 주세요.' : success ? '신청해 주셔서 감사합니다.' : '운영진에게 문의하거나 잠시 후 다시 시도해 주세요.';
  const payload = JSON.stringify({type: 'mta-apply-result', kind: kind, requestId: requestId});
  const script = requestId ? '<script>window.top.postMessage(' + payload + ',' + JSON.stringify(SITE_ORIGIN) + ');</script>' : '';
  const output = HtmlService.createHtmlOutput(
    '<!doctype html><html lang="ko"><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + title + '</title>' +
    '<body style="font-family:system-ui;max-width:480px;margin:80px auto;padding:24px;color:#172a3a">' +
    '<h1>' + title + '</h1><p>' + message + '</p>' + script + '</body></html>'
  );
  return requestId ? output.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL) : output;
}

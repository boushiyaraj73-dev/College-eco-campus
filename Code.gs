// QR EcoCampus backend - paste this into Google Apps Script (see SETUP.txt)
const ADMIN_PASSWORD = 'change-this-password'; // CHANGE THIS before deploying
const SHEET_NAME = 'Reports';
const HEADERS = ['id','reporterName','locationId','locationName','category','severity','description','status','resolutionNote','createdAt','updatedAt'];

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) { sh = ss.insertSheet(SHEET_NAME); sh.appendRow(HEADERS); }
  return sh;
}
function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function readAll() {
  const rows = getSheet().getDataRange().getValues();
  rows.shift();
  return rows.filter(r => r[0]).map(r => {
    const o = {}; HEADERS.forEach((h, i) => o[h] = String(r[i] ?? '')); return o;
  });
}

// Laptop: list reports (needs password)
function doGet(e) {
  // Public: anyone with a report ID can see ONLY its status (no name, no other reports)
  if (e.parameter.track) {
    const id = String(e.parameter.track).trim().toUpperCase();
    const r = readAll().find(x => String(x.id).toUpperCase() === id);
    if (!r) return out({ ok: false, error: 'Report not found' });
    return out({ ok: true, report: {
      id: r.id, locationName: r.locationName, category: r.category,
      status: r.status, resolutionNote: r.resolutionNote,
      createdAt: r.createdAt, updatedAt: r.updatedAt
    }});
  }
  if (e.parameter.key !== ADMIN_PASSWORD) return out({ ok: false, error: 'Wrong password' });
  return out({ ok: true, reports: readAll() });
}

// Phones: submit report. Laptop: update / clear (need password)
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const d = JSON.parse(e.postData.contents);
    const sh = getSheet();
    if (d.action === 'submit') {
      const r = d.report;
      const id = 'ECO-' + Date.now().toString().slice(-8) + '-' + Math.random().toString(36).slice(2, 5).toUpperCase();
      const now = new Date().toISOString();
      const row = {
        id, reporterName: String(r.reporterName || '').slice(0, 80), locationId: r.locationId, locationName: r.locationName,
        category: r.category, severity: r.severity, description: String(r.description || '').slice(0, 700),
        status: 'Pending', resolutionNote: '', createdAt: now, updatedAt: now
      };
      sh.appendRow(HEADERS.map(h => row[h]));
      return out({ ok: true, id });
    }
    if (d.key !== ADMIN_PASSWORD) return out({ ok: false, error: 'Wrong password' });
    if (d.action === 'update') {
      const ids = sh.getRange(1, 1, sh.getLastRow(), 1).getValues().map(r => r[0]);
      const i = ids.indexOf(d.id);
      if (i < 1) return out({ ok: false, error: 'Report not found' });
      sh.getRange(i + 1, 8).setValue(d.status);
      sh.getRange(i + 1, 9).setValue(d.resolutionNote || '');
      sh.getRange(i + 1, 11).setValue(new Date().toISOString());
      return out({ ok: true });
    }
    if (d.action === 'clear') {
      if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);
      return out({ ok: true });
    }
    return out({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  } finally { lock.releaseLock(); }
}

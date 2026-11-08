'use strict';

const STORAGE_KEY = 'qr_ecocampus_reports_v2';
const LOCATION_KEY = 'qr_ecocampus_locations_v2';
const MY_KEY = 'qr_ecocampus_my_ids_v2';

const DEFAULT_LOCATIONS = [
  { id: 'WS-01', name: 'Main Water Station', type: 'Water point', icon: '◉' },
  { id: 'WB-01', name: 'Ground Floor Waste Bin', type: 'Waste point', icon: '♻' },
  { id: 'LB-01', name: 'Computer Laboratory', type: 'Laboratory', icon: '⌘' },
  { id: 'CL-01', name: 'Main Classroom Block', type: 'Classroom', icon: '▤' },
  { id: 'CN-01', name: 'College Canteen', type: 'Food and waste', icon: '♧' },
  { id: 'GS-01', name: 'Garden Area', type: 'Green space', icon: '✿' },
  { id: 'OF-01', name: 'College Office', type: 'Office issues', icon: '▣' },
  { id: 'TL-01', name: 'College Toilet / Restroom', type: 'Toilet issues', icon: '♧' }
];

const $ = (id) => document.getElementById(id);
let reports = !!(window.ECO_API_URL || '').trim() ? [] : loadJson(STORAGE_KEY, []);
let locations = loadJson(LOCATION_KEY, DEFAULT_LOCATIONS);
// Add newly introduced default locations to older saved versions without removing user locations.
for (const defaultLocation of DEFAULT_LOCATIONS) {
  if (!locations.some((location) => location.id === defaultLocation.id)) locations.push(defaultLocation);
}
try { localStorage.setItem(LOCATION_KEY, JSON.stringify(locations)); } catch (error) { console.warn('Could not update saved locations:', error); }
let selectedQrLocationId = locations[0]?.id || '';
let editingReportId = null;

// ---------- Shared online storage (Google Sheet via Apps Script) ----------
const API_URL = (window.ECO_API_URL || '').trim();
const ONLINE = API_URL !== '';

function getAdminKey(forcePrompt) {
  let key = sessionStorage.getItem('eco_admin_key');
  if (!key || forcePrompt) {
    key = prompt('Admin password:') || '';
    if (key) sessionStorage.setItem('eco_admin_key', key); else sessionStorage.removeItem('eco_admin_key');
  }
  return key;
}

async function apiPost(payload) {
  const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function loadOnlineReports() {
  const key = getAdminKey(false);
  if (!key) { showAdminNotice('Enter the admin password to view reports. Refresh the page to try again.'); return; }
  try {
    const res = await fetch(API_URL + '?key=' + encodeURIComponent(key));
    const data = await res.json();
    if (!data.ok) {
      sessionStorage.removeItem('eco_admin_key');
      showAdminNotice('Wrong admin password. Refresh the page and try again.');
      return;
    }
    reports = data.reports;
    showAdminNotice('');
    renderAll();
  } catch (error) {
    showAdminNotice('Could not load reports. Check your internet connection and the Apps Script URL.');
  }
}

function showAdminNotice(text) {
  let box = $('adminNotice');
  if (!box) {
    box = document.createElement('p');
    box.id = 'adminNotice';
    box.className = 'hint-box';
    document.querySelector('.page-content')?.prepend(box);
  }
  box.textContent = text;
  box.hidden = !text;
}

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.warn('Could not read saved data:', error);
    return fallback;
  }
}

function saveReports() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

function createId() {
  return 'ECO-' + Date.now().toString().slice(-8) + '-' +
    Math.random().toString(36).slice(2, 5).toUpperCase();
}

function getLocation(id) {
  return locations.find((location) => location.id === id);
}

function populateLocationSelects() {
  const reportSelect = $('locationSelect');
  const qrSelect = $('qrLocationSelect');
  const previousReportValue = reportSelect?.value || '';
  const locationOptions = locations.map((location) =>
    `<option value="${escapeHtml(location.id)}">${escapeHtml(location.name)} (${escapeHtml(location.id)})</option>`
  ).join('');

  if (reportSelect) {
    reportSelect.innerHTML = '<option value="">Choose a location</option>' + locationOptions;
    if (locations.some((location) => location.id === previousReportValue)) {
      reportSelect.value = previousReportValue;
    }
  }

  if (qrSelect) {
    qrSelect.innerHTML = locationOptions;
    if (!locations.some((location) => location.id === selectedQrLocationId)) {
      selectedQrLocationId = locations[0]?.id || '';
    }
    qrSelect.value = selectedQrLocationId;
  }
}

function renderStats() {
  const total = $('totalReports');
  if (total) total.textContent = reports.length;
  const pending = $('pendingReports');
  if (pending) pending.textContent = reports.filter((r) => r.status === 'Pending').length;
  const progress = $('progressReports');
  if (progress) progress.textContent = reports.filter((r) => r.status === 'In Progress').length;
  const resolved = $('resolvedReports');
  if (resolved) resolved.textContent = reports.filter((r) => r.status === 'Resolved').length;
}

function statusClass(status) {
  return String(status || 'Pending').toLowerCase().replace(/\s+/g, '-');
}

function renderReports() {
  const rows = $('reportRows');
  if (!rows) return;

  const status = $('statusFilter')?.value || 'All';
  const query = ($('searchInput')?.value || '').trim().toLowerCase();
  const filtered = reports.filter((report) => {
    const matchesStatus = status === 'All' || report.status === status;
    const searchable = [
      report.id, report.locationName, report.locationId, report.category,
      report.description, report.reporterName, report.severity
    ].join(' ').toLowerCase();
    return matchesStatus && searchable.includes(query);
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  rows.innerHTML = filtered.map((report) => `
    <tr>
      <td><strong>${escapeHtml(report.id)}</strong><small>${escapeHtml(report.reporterName || 'Anonymous')}</small></td>
      <td>${escapeHtml(report.locationName)}<small>${escapeHtml(report.locationId)}</small></td>
      <td>${escapeHtml(report.category)}<small title="${escapeHtml(report.description)}">${escapeHtml(report.description)}</small></td>
      <td><span class="priority-badge priority-${escapeHtml(String(report.severity || 'Medium').toLowerCase())}">${escapeHtml(report.severity || 'Medium')}</span></td>
      <td><span class="status-badge status-${statusClass(report.status)}">${escapeHtml(report.status)}</span></td>
      <td>${escapeHtml(new Date(report.createdAt).toLocaleDateString())}</td>
      <td><button class="table-action" type="button" data-edit-report="${escapeHtml(report.id)}">Update</button></td>
    </tr>
  `).join('');

  const empty = $('emptyState');
  if (empty) empty.hidden = filtered.length > 0;
}

function renderRecentReports() {
  const rows = $('recentRows');
  if (!rows) return;

  const latest = [...reports].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
  rows.innerHTML = latest.map((report) => `
    <tr>
      <td><strong>${escapeHtml(report.id)}</strong><small>${escapeHtml(report.category)}</small></td>
      <td>${escapeHtml(report.locationName)}</td>
      <td><span class="status-badge status-${statusClass(report.status)}">${escapeHtml(report.status)}</span></td>
      <td>${escapeHtml(new Date(report.createdAt).toLocaleDateString())}</td>
    </tr>
  `).join('');

  const empty = $('recentEmpty');
  if (empty) empty.hidden = latest.length > 0;
}

function renderQuickLocations() {
  const container = $('dashboardLocations');
  if (!container) return;

  container.innerHTML = locations.slice(0, 4).map((location) => `
    <a class="quick-location" href="qr-codes.html?location=${encodeURIComponent(location.id)}">
      <span class="quick-location-icon">${escapeHtml(location.icon || '⌖')}</span>
      <span><strong>${escapeHtml(location.name)}</strong><small>${escapeHtml(location.type)} · ${escapeHtml(location.id)}</small></span>
    </a>
  `).join('');
}

function renderLocationCards(containerId, showReportCount) {
  const container = $(containerId);
  if (!container) return;

  container.innerHTML = locations.map((location) => {
    const count = reports.filter((report) => report.locationId === location.id).length;
    return `
      <article class="location-card">
        <div class="loc-icon">${escapeHtml(location.icon || '⌖')}</div>
        <h3>${escapeHtml(location.name)}</h3>
        <p>${escapeHtml(location.type)} · ${escapeHtml(location.id)}</p>
        ${showReportCount ? `<p class="location-report-count">${count} report${count === 1 ? '' : 's'} recorded</p>` : ''}
        <a class="button button-secondary" href="qr-codes.html?location=${encodeURIComponent(location.id)}">Generate QR ↗</a>
      </article>
    `;
  }).join('');
}

function renderLocationSummary() {
  const container = $('locationReportSummary');
  if (!container) return;

  const counts = locations.map((location) => ({
    ...location,
    count: reports.filter((report) => report.locationId === location.id).length
  }));
  const max = Math.max(1, ...counts.map((location) => location.count));

  container.innerHTML = counts.map((location) => `
    <div class="summary-row">
      <span class="summary-name" title="${escapeHtml(location.name)}">${escapeHtml(location.name)}</span>
      <div class="summary-track"><div class="summary-fill" style="width:${(location.count / max) * 100}%"></div></div>
      <span class="summary-count">${location.count}</span>
    </div>
  `).join('');

  const empty = $('locationSummaryEmpty');
  if (empty) empty.hidden = reports.length > 0;
  const locationCount = $('locationCount');
  if (locationCount) locationCount.textContent = locations.length;
  const reportCount = $('locationReportCount');
  if (reportCount) reportCount.textContent = reports.length;
}

function renderAll() {
  renderStats();
  renderReports();
  renderRecentReports();
  renderQuickLocations();
  renderLocationCards('qrLocationCards', false);
  renderLocationCards('locationDirectory', true);
  renderLocationSummary();
}

function qrPayload(location) {
  if (window.location.protocol === 'https:' || window.location.protocol === 'http:') {
    const url = new URL('report.html', window.location.href);
    url.searchParams.set('location', location.id);
    url.hash = 'issueForm';
    return url.toString();
  }
  return `ECOCAMPUS_LOCATION:${location.id}`;
}

function renderQr(locationId) {
  const location = getLocation(locationId);
  if (!location) return;

  selectedQrLocationId = location.id;
  const selector = $('qrLocationSelect');
  if (selector) selector.value = location.id;

  const qrBox = $('qrcode');
  if (!qrBox) return;
  qrBox.innerHTML = '';

  const name = $('qrLocationName');
  const id = $('qrLocationId');
  if (name) name.textContent = location.name;
  if (id) id.textContent = `LOCATION ID · ${location.id}`;

  if (typeof QRCode === 'undefined') {
    qrBox.textContent = 'QR library could not load.';
    const hint = $('qrHint');
    if (hint) hint.textContent = 'Connect to the internet and refresh the page to load the QR generator library.';
    return;
  }

  new QRCode(qrBox, {
    text: qrPayload(location),
    width: 160,
    height: 160,
    colorDark: '#163e2d',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.H
  });

  const hint = $('qrHint');
  if (hint) {
    hint.textContent = window.location.protocol === 'file:'
      ? 'Local demo: this QR contains the location ID, not a public web link. Host the site online using HTTPS to make it open the reporting form on a phone.'
      : 'This QR opens the hosted reporting form with the location preselected. Print it and place it at the matching campus location.';
  }
}

function showFormMessage(message, isError = false) {
  const target = $('formMessage');
  if (!target) return;
  target.textContent = message;
  target.classList.toggle('error', isError);
}

function handleIssueSubmit(event) {
  event.preventDefault();

  const locationId = $('locationSelect').value;
  const category = $('categorySelect').value;
  const description = $('description').value.trim();
  const location = getLocation(locationId);

  if (!location || !category || !description) {
    showFormMessage('Please select a location and category, and describe the issue.', true);
    return;
  }

  const report = {
    id: createId(),
    reporterName: $('reporterName').value.trim(),
    locationId: location.id,
    locationName: location.name,
    category,
    severity: $('severitySelect').value,
    description,
    status: 'Pending',
    resolutionNote: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const button = event.target.querySelector('button[type="submit"]');

  const finish = (id) => {
    $('issueForm').reset();
    // Keep the scanned QR location selected after submission for quick additional reports.
    const scannedLocationId = new URLSearchParams(window.location.search).get('location');
    if (scannedLocationId && getLocation(scannedLocationId)) $('locationSelect').value = scannedLocationId;
    saveMyId(id);
    showFormMessage(`Report submitted successfully. Your report ID is ${id}.`);
    const msg = $('formMessage');
    if (msg) {
      const a = document.createElement('a');
      a.href = 'track.html?id=' + encodeURIComponent(id);
      a.textContent = ' Track this report →';
      a.style.fontWeight = '700';
      msg.appendChild(a);
    }
    renderAll();
  };

  if (ONLINE) {
    if (button) button.disabled = true;
    showFormMessage('Submitting...');
    apiPost({ action: 'submit', report })
      .then((data) => finish(data.id))
      .catch(() => showFormMessage('Could not send the report. Check your internet and try again.', true))
      .finally(() => { if (button) button.disabled = false; });
    return;
  }

  reports.push(report);
  try {
    saveReports();
  } catch (error) {
    reports = reports.filter((item) => item.id !== report.id);
    showFormMessage('Could not save the report. Browser storage may be full or disabled.', true);
    return;
  }
  finish(report.id);
}

function openStatusDialog(reportId) {
  const report = reports.find((item) => item.id === reportId);
  if (!report || !$('statusDialog')) return;

  editingReportId = reportId;
  $('dialogReportLabel').textContent = `${report.id} · ${report.locationName} · ${report.category}`;
  $('newStatus').value = report.status;
  $('resolutionNote').value = report.resolutionNote || '';
  $('statusDialog').showModal();
}

async function saveStatusUpdate(event) {
  if (event) event.preventDefault();
  const report = reports.find((item) => item.id === editingReportId);
  if (!report) return;

  const status = $('newStatus').value;
  const resolutionNote = $('resolutionNote').value.trim();

  if (ONLINE) {
    try {
      await apiPost({ action: 'update', key: getAdminKey(false), id: report.id, status, resolutionNote });
    } catch (error) {
      alert('Could not save the update: ' + error.message);
      return;
    }
  }

  report.status = status;
  report.resolutionNote = resolutionNote;
  report.updatedAt = new Date().toISOString();

  if (!ONLINE) {
    try {
      saveReports();
    } catch (error) {
      alert('Could not save the update. Browser storage may be unavailable.');
      return;
    }
  }

  $('statusDialog').close();
  editingReportId = null;
  renderAll();
}

function csvCell(value) {
  return '"' + String(value ?? '').replace(/"/g, '""') + '"';
}

function exportCsv() {
  const headers = ['Report ID', 'Reporter', 'Location ID', 'Location', 'Category', 'Priority', 'Description', 'Status', 'Resolution Note', 'Created At', 'Updated At'];
  const lines = [headers.map(csvCell).join(',')];

  reports.forEach((report) => {
    lines.push([
      report.id, report.reporterName, report.locationId, report.locationName,
      report.category, report.severity, report.description, report.status,
      report.resolutionNote, report.createdAt, report.updatedAt
    ].map(csvCell).join(','));
  });

  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'qr-ecocampus-reports.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function clearReports() {
  if (!reports.length) {
    alert('There are no reports to clear.');
    return;
  }
  if (!confirm('Delete ALL reports? This cannot be undone.')) return;

  if (ONLINE) {
    try {
      await apiPost({ action: 'clear', key: getAdminKey(false) });
    } catch (error) {
      alert('Could not clear reports: ' + error.message);
      return;
    }
    reports = [];
    renderAll();
    return;
  }

  reports = [];
  try {
    saveReports();
  } catch (error) {
    alert('Could not clear saved reports. Browser storage may be unavailable.');
    return;
  }
  renderAll();
}

function handleUrlLocation() {
  const locationId = new URLSearchParams(window.location.search).get('location');
  if (locationId && getLocation(locationId)) {
    const reportSelect = $('locationSelect');
    if (reportSelect) {
      reportSelect.value = locationId;
      reportSelect.setAttribute('aria-label', `Campus location selected from QR code: ${getLocation(locationId).name}`);
    }
    if ($('qrLocationSelect')) renderQr(locationId);
    // QR links use #issueForm so the form is brought directly into view on a phone.
    if (window.location.hash === '#issueForm' && $('issueForm')) {
      window.setTimeout(() => $('issueForm').scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
  }
}

// ---------- Track status (for the person who submitted) ----------
function getMyIds() {
  return loadJson(MY_KEY, []);
}

function saveMyId(id) {
  try {
    const ids = getMyIds().filter((x) => x !== id);
    ids.unshift(id);
    localStorage.setItem(MY_KEY, JSON.stringify(ids.slice(0, 20)));
  } catch (error) { console.warn('Could not remember report ID:', error); }
}

async function fetchStatus(id) {
  id = id.trim().toUpperCase();
  if (ONLINE) {
    const res = await fetch(API_URL + '?track=' + encodeURIComponent(id));
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Report not found');
    return data.report;
  }
  const report = reports.find((r) => String(r.id).toUpperCase() === id);
  if (!report) throw new Error('Report not found');
  return report;
}

function statusStepsHtml(status) {
  const steps = ['Pending', 'In Progress', 'Resolved'];
  const current = Math.max(0, steps.indexOf(status));
  return '<div style="display:flex;gap:8px;margin:14px 0">' + steps.map((s, i) =>
    `<div style="flex:1;text-align:center;font-size:10px;font-weight:700;padding:9px 4px;border-radius:9px;` +
    (i <= current ? 'background:#e4f6e9;color:#28764a' : 'background:#f1f4f2;color:#9aa8a1') + `">${i <= current ? '✓ ' : ''}${s}</div>`
  ).join('') + '</div>';
}

function statusCardHtml(r) {
  const note = r.resolutionNote ? `<p><strong>Note from campus team:</strong> ${escapeHtml(r.resolutionNote)}</p>` : '';
  return `<div style="margin-top:16px">
    <p><strong>${escapeHtml(r.id)}</strong><br><small>${escapeHtml(r.category)} · ${escapeHtml(r.locationName)}</small></p>
    <p>Current status: <span class="status-badge status-${statusClass(r.status)}">${escapeHtml(r.status)}</span></p>
    ${statusStepsHtml(r.status)}${note}
    <small>Submitted ${escapeHtml(new Date(r.createdAt).toLocaleString())} · Last updated ${escapeHtml(new Date(r.updatedAt || r.createdAt).toLocaleString())}</small>
  </div>`;
}

async function showTrack(id) {
  const msg = $('trackMessage');
  const box = $('trackResult');
  box.hidden = true;
  msg.classList.remove('error');
  msg.textContent = 'Checking...';
  try {
    const r = await fetchStatus(id);
    msg.textContent = '';
    box.innerHTML = statusCardHtml(r);
    box.hidden = false;
  } catch (error) {
    msg.classList.add('error');
    msg.textContent = error.message === 'Report not found'
      ? 'No report found with that ID. Please check it and try again.'
      : 'Could not check the status. Check your internet and try again.';
  }
}

async function renderMyReports() {
  const ids = getMyIds();
  const panel = $('myReportsPanel');
  if (!panel || !ids.length) return;
  panel.hidden = false;
  const list = $('myReports');
  list.innerHTML = '';
  for (const id of ids) {
    let html;
    try {
      const r = await fetchStatus(id);
      html = `<p><a href="track.html?id=${encodeURIComponent(r.id)}"><strong>${escapeHtml(r.id)}</strong></a> · ${escapeHtml(r.category)} · <span class="status-badge status-${statusClass(r.status)}">${escapeHtml(r.status)}</span></p>`;
    } catch (error) {
      html = `<p><strong>${escapeHtml(id)}</strong> · <small>status unavailable</small></p>`;
    }
    list.insertAdjacentHTML('beforeend', html);
  }
}

function initTrackPage() {
  $('trackForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    showTrack($('trackId').value);
  });
  const id = new URLSearchParams(window.location.search).get('id');
  if (id) { $('trackId').value = id; showTrack(id); }
  renderMyReports();
}

function init() {
  populateLocationSelects();
  renderAll();

  if ($('qrcode')) {
    const requestedId = new URLSearchParams(window.location.search).get('location');
    renderQr(getLocation(requestedId) ? requestedId : selectedQrLocationId);
  }
  handleUrlLocation();

  const page = document.body.dataset.page;
  if (ONLINE && ['dashboard', 'issues', 'locations'].includes(page)) {
    loadOnlineReports();
    if (page === 'issues') setInterval(() => { if (!$('statusDialog')?.open) loadOnlineReports(); }, 30000);
  }

  if (page === 'track') initTrackPage();

  $('menuToggle')?.addEventListener('click', () => $('sidebar')?.classList.toggle('open'));

  $('issueForm')?.addEventListener('submit', handleIssueSubmit);
  $('qrLocationSelect')?.addEventListener('change', (event) => renderQr(event.target.value));

  $('useQrLocation')?.addEventListener('click', () => {
    window.location.href = `report.html?location=${encodeURIComponent(selectedQrLocationId)}`;
  });

  $('downloadQr')?.addEventListener('click', () => {
    const canvas = $('qrcode')?.querySelector('canvas');
    const image = $('qrcode')?.querySelector('img');
    const dataUrl = canvas ? canvas.toDataURL('image/png') : image?.src;

    if (!dataUrl) {
      alert('QR code is not ready yet. Check your internet connection and refresh.');
      return;
    }
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `ecocampus-${selectedQrLocationId}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  });

  $('exportCsv')?.addEventListener('click', exportCsv);
  $('clearReports')?.addEventListener('click', clearReports);
  $('statusFilter')?.addEventListener('change', renderReports);
  $('searchInput')?.addEventListener('input', renderReports);

  $('reportRows')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-edit-report]');
    if (button) openStatusDialog(button.dataset.editReport);
  });

  $('saveStatus')?.addEventListener('click', saveStatusUpdate);
  $('statusForm')?.addEventListener('submit', (event) => {
    if (event.submitter?.id === 'saveStatus') saveStatusUpdate(event);
  });
}

document.addEventListener('DOMContentLoaded', init);

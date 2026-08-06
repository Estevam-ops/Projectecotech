const STORAGE_KEY = 'ecotech.records.v1';
const LOGIN = { email: 'admin@ecotech.local', password: 'ecotech' };

const $ = (selector) => document.querySelector(selector);
const menuButton = $('.menu-button');
const menu = $('#menu');
const loginForm = $('#loginForm');
const adminArea = $('#adminArea');
const recordForm = $('#recordForm');
const recordsTable = $('#recordsTable');
const labels = $('#labels');

let records = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

menuButton.addEventListener('click', () => {
  const isOpen = menu.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(isOpen));
});

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const email = $('#email').value.trim();
  const password = $('#password').value;
  if (email === LOGIN.email && password === LOGIN.password) {
    loginForm.classList.add('hidden');
    adminArea.classList.remove('hidden');
    $('#loginMessage').textContent = '';
    render();
    return;
  }
  $('#loginMessage').textContent = 'Login inválido. Use as credenciais de demonstração.';
});

$('#logoutButton').addEventListener('click', () => {
  adminArea.classList.add('hidden');
  loginForm.classList.remove('hidden');
});

recordForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const record = {
    id: createId(),
    device: $('#device').value.trim(),
    weight: Number($('#weight').value),
    school: $('#school').value.trim(),
    classroom: $('#classroom').value.trim(),
    student: $('#student').value.trim(),
    status: $('#status').value,
    createdAt: new Date().toISOString(),
  };
  records.unshift(record);
  saveAndRender();
  recordForm.reset();
});

$('#printLabels').addEventListener('click', () => window.print());
$('#exportPdf').addEventListener('click', exportPdf);
$('#seedDemo').addEventListener('click', () => {
  records = demoRecords();
  saveAndRender();
});
$('#clearData').addEventListener('click', () => {
  if (confirm('Deseja apagar todos os registros desta demonstração?')) {
    records = [];
    saveAndRender();
  }
});

function createId() {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `ECO-${timestamp}-${random}`;
}

function saveAndRender() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  render();
}

function render() {
  renderMetrics();
  renderRankings();
  renderTable();
  renderLabels();
}

function totalWeight(list = records) {
  return list.reduce((sum, item) => sum + Number(item.weight || 0), 0);
}

function rankBy(field) {
  const totals = new Map();
  records.forEach((item) => totals.set(item[field], (totals.get(item[field]) || 0) + Number(item.weight || 0)));
  return [...totals.entries()].sort((a, b) => b[1] - a[1]);
}

function renderMetrics() {
  const schools = rankBy('school');
  const students = rankBy('student');
  $('#totalItems').textContent = records.length;
  $('#totalWeight').textContent = `${totalWeight().toFixed(2)} kg`;
  $('#topSchool').textContent = schools[0] ? `${schools[0][0]} (${schools[0][1].toFixed(2)} kg)` : '-';
  $('#topStudent').textContent = students[0] ? `${students[0][0]} (${students[0][1].toFixed(2)} kg)` : '-';
}

function renderRankings() {
  fillRanking('#schoolRanking', rankBy('school'));
  fillRanking('#classRanking', rankBy('classroom'));
  fillRanking('#studentRanking', rankBy('student'));
}

function fillRanking(selector, rows) {
  const target = $(selector);
  target.innerHTML = rows.length ? '' : '<li>Nenhum registro ainda.</li>';
  rows.slice(0, 10).forEach(([name, weight]) => {
    const li = document.createElement('li');
    li.textContent = `${name}: ${weight.toFixed(2)} kg`;
    target.appendChild(li);
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[char]);
}

function renderTable() {
  recordsTable.innerHTML = '';
  records.forEach((item) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(item.id)}</td><td>${escapeHtml(item.device)}</td><td>${Number(item.weight).toFixed(2)} kg</td>
      <td>${escapeHtml(item.school)}</td><td>${escapeHtml(item.classroom)}</td><td>${escapeHtml(item.student)}</td><td>${escapeHtml(item.status)}</td><td class="qr-cell"></td>`;
    recordsTable.appendChild(tr);
    addQr(tr.querySelector('.qr-cell'), item.id, 74);
  });
}

function renderLabels() {
  labels.innerHTML = '';
  records.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'label-card';
    card.innerHTML = `<strong>${escapeHtml(item.id)}</strong><div class="qr"></div><small>${escapeHtml(item.device)} • ${escapeHtml(item.school)} • ${escapeHtml(item.student)}</small>`;
    labels.appendChild(card);
    addQr(card.querySelector('.qr'), item.id, 128);
  });
}

function addQr(target, text, size) {
  target.innerHTML = '';
  if (window.QRCode) {
    new QRCode(target, { text, width: size, height: size, correctLevel: QRCode.CorrectLevel.M });
  } else {
    target.textContent = text;
  }
}

function exportPdf() {
  const title = 'Relatório EcoTech - Resíduos Eletrônicos';
  if (!window.jspdf) {
    alert('Biblioteca PDF indisponível. Use a impressão do navegador como alternativa.');
    window.print();
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let y = 16;
  doc.setFontSize(16);
  doc.text(title, 12, y);
  y += 10;
  doc.setFontSize(11);
  doc.text(`Total: ${records.length} aparelhos | ${totalWeight().toFixed(2)} kg`, 12, y);
  y += 8;
  records.forEach((item, index) => {
    if (y > 275) { doc.addPage(); y = 16; }
    doc.text(`${index + 1}. ${item.id} - ${item.device} - ${Number(item.weight).toFixed(2)} kg`, 12, y);
    y += 6;
    doc.text(`   Escola: ${item.school} | Sala: ${item.classroom} | Aluno: ${item.student} | Status: ${item.status}`, 12, y);
    y += 8;
  });
  doc.save('relatorio-ecotech.pdf');
}

function demoRecords() {
  return [
    { id: 'ECO-20260727090000-A1B2C', device: 'Celular quebrado', weight: 0.18, school: 'Escola Municipal Uberaba', classroom: '8º A', student: 'Ana Clara', status: 'Na escola', createdAt: new Date().toISOString() },
    { id: 'ECO-20260727090500-D3E4F', device: 'Notebook antigo', weight: 2.4, school: 'Escola Municipal Uberaba', classroom: '8º A', student: 'João Pedro', status: 'No IFTM UPT', createdAt: new Date().toISOString() },
    { id: 'ECO-20260727091000-G5H6I', device: 'Impressora', weight: 5.2, school: 'Escola Estadual Triângulo', classroom: '1º B', student: 'Mariana Lima', status: 'Coletado pela Cooperu', createdAt: new Date().toISOString() },
  ];
}

render();

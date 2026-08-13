const STORAGE_KEY = 'ecotech.records.v1'
const LOGIN = { email: 'admin@ecotech.local', password: 'ecotech' }

const _$ = (selector) => document.querySelector(selector)
const menuButton = _$('.menu-button')
const menu = _$('#menu')
const loginForm = _$('#loginForm')
const adminArea = _$('#adminArea')
const recordForm = _$('#recordForm')
const recordsTable = _$('#recordsTable')
const labels = _$('#labels')

let records = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')

function _createId() {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
  const random = Math.random().toString(36).slice(2, 7).toUpperCase()

  return `ECO-${timestamp}-${random}`
}

function _totalWeight(list = records) {
  return list.reduce((sum, item) => sum + Number(item.weight || 0), 0)
}

function _rankBy(field) {
  const totals = new Map()

  records.forEach((item) => totals.set(item[field], (totals.get(item[field]) || 0) + Number(item.weight || 0)))

  return [...totals.entries()].sort((a, b) => b[1] - a[1])
}

function _renderMetrics() {
  const schools = _rankBy('school')
  const students = _rankBy('student')

  _$('#totalItems').textContent = records.length
  _$('#totalWeight').textContent = `${_totalWeight().toFixed(2)} kg`
  _$('#topSchool').textContent = schools[0] ? `${schools[0][0]} (${schools[0][1].toFixed(2)} kg)` : '-'
  _$('#topStudent').textContent = students[0] ? `${students[0][0]} (${students[0][1].toFixed(2)} kg)` : '-'
}

function _fillRanking(selector, rows) {
  const target = _$(selector)

  target.innerHTML = rows.length ? '' : '<li>Nenhum registro ainda.</li>'
  rows.slice(0, 10).forEach(([name, weight]) => {
    const li = document.createElement('li')

    li.textContent = `${name}: ${weight.toFixed(2)} kg`
    target.appendChild(li)
  })
}

function _renderRankings() {
  _fillRanking('#schoolRanking', _rankBy('school'))
  _fillRanking('#classRanking', _rankBy('classroom'))
  _fillRanking('#studentRanking', _rankBy('student'))
}

function _escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  })[char])
}

function _addQr(target, text, size) {
  target.innerHTML = ''
  if (window.QRCode) {
    new QRCode(target, { text, width: size, height: size, correctLevel: QRCode.CorrectLevel.M })
  } else {
    target.textContent = text
  }
}

function _renderTable() {
  recordsTable.innerHTML = ''
  records.forEach((item) => {
    const tr = document.createElement('tr')

    tr.innerHTML = `
      <td>${_escapeHtml(item.id)}</td><td>${_escapeHtml(item.device)}</td><td>${Number(item.weight).toFixed(2)} kg</td>
      <td>${_escapeHtml(item.school)}</td><td>${_escapeHtml(item.classroom)}</td><td>${_escapeHtml(item.student)}</td><td>${_escapeHtml(item.status)}</td><td class="qr-cell"></td>`
    recordsTable.appendChild(tr)
    _addQr(tr.querySelector('.qr-cell'), item.id, 74)
  })
}

function _renderLabels() {
  labels.innerHTML = ''
  records.forEach((item) => {
    const card = document.createElement('article')

    card.className = 'label-card'
    card.innerHTML = `<strong>${_escapeHtml(item.id)}</strong><div class="qr"></div><small>${_escapeHtml(item.device)} • ${_escapeHtml(item.school)} • ${_escapeHtml(item.student)}</small>`
    labels.appendChild(card)
    _addQr(card.querySelector('.qr'), item.id, 128)
  })
}

function _render() {
  _renderMetrics()
  _renderRankings()
  _renderTable()
  _renderLabels()
}

function _saveAndRender() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  _render()
}

function _exportPdf() {
  const title = 'Relatorio EcoTech - Residuos Eletronicos'

  if (!window.jspdf) {
    alert('Biblioteca PDF indisponivel. Use a impressao do navegador como alternativa.')
    window.print()

    return;
  }

  const { jsPDF } = window.jspdf
  const doc = new jsPDF()

  let y = 16

  doc.setFontSize(16)
  doc.text(title, 12, y)
  y += 10
  doc.setFontSize(11)
  doc.text(`Total: ${records.length} aparelhos | ${_totalWeight().toFixed(2)} kg`, 12, y)
  y += 8
  records.forEach((item, index) => {
    if (y > 275) {
      doc.addPage()
      y = 16
    }
    doc.text(`${index + 1}. ${item.id} - ${item.device} - ${Number(item.weight).toFixed(2)} kg`, 12, y)
    y += 6
    doc.text(`   Escola: ${item.school} | Sala: ${item.classroom} | Aluno: ${item.student} | Status: ${item.status}`, 12, y)
    y += 8
  })
  doc.save('relatorio-ecotech.pdf')
}

function _demoRecords() {
  return [
    { id: 'ECO-20260727090000-A1B2C', device: 'Celular quebrado', weight: 0.18, school: 'Escola Municipal Uberaba', classroom: '8º A', student: 'Ana Clara', status: 'Na escola', createdAt: new Date().toISOString() },
    { id: 'ECO-20260727090500-D3E4F', device: 'Notebook antigo', weight: 2.4, school: 'Escola Municipal Uberaba', classroom: '8º A', student: 'João Pedro', status: 'No IFTM UPT', createdAt: new Date().toISOString() },
    { id: 'ECO-20260727091000-G5H6I', device: 'Impressora', weight: 5.2, school: 'Escola Estadual Triângulo', classroom: '1º B', student: 'Mariana Lima', status: 'Coletado pela Cooperu', createdAt: new Date().toISOString() }
  ]
}

menuButton.addEventListener('click', () => {
  const isOpen = menu.classList.toggle('open')

  menuButton.setAttribute('aria-expanded', String(isOpen))
})

loginForm.addEventListener('submit', (event) => {
  event.preventDefault()

  const email = _$('#email').value.trim()
  const password = _$('#password').value

  if (email === LOGIN.email && password === LOGIN.password) {
    loginForm.classList.add('hidden')
    adminArea.classList.remove('hidden')
    _$('#loginMessage').textContent = ''
    _render()

    return;
  }

  _$('#loginMessage').textContent = 'Login invalido. Use as credenciais de demonstracao.'
})

_$('#logoutButton').addEventListener('click', () => {
  adminArea.classList.add('hidden')
  loginForm.classList.remove('hidden')
})

recordForm.addEventListener('submit', (event) => {
  event.preventDefault()

  const record = {
    id: _createId(),
    device: _$('#device').value.trim(),
    weight: Number(_$('#weight').value),
    school: _$('#school').value.trim(),
    classroom: _$('#classroom').value.trim(),
    student: _$('#student').value.trim(),
    status: _$('#status').value,
    createdAt: new Date().toISOString()
  }

  records.unshift(record)
  _saveAndRender()
  recordForm.reset()
})

_$('#printLabels').addEventListener('click', () => window.print())
_$('#exportPdf').addEventListener('click', () => _exportPdf())
_$('#seedDemo').addEventListener('click', () => {
  records = _demoRecords()
  _saveAndRender()
})
_$('#clearData').addEventListener('click', () => {
  if (confirm('Deseja apagar todos os registros desta demonstracao?')) {
    records = []
    _saveAndRender()
  }
})

_render()

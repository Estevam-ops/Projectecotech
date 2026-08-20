const SERVER_URL = 'http://127.0.0.1:3000'
const LOGIN = { email: 'admin@ecotech.local', password: 'ecotech' }

const $ = (selector) => document.querySelector(selector)
const menuButton = $('.menu-button')
const menu = $('#menu')
const loginForm = $('#loginForm')
const adminArea = $('#adminArea')
const recordForm = $('#recordForm')
const recordsTable = $('#recordsTable')
const labels = $('#labels')

let records = []
let serverDown = false
let authToken = null


const _escapeHtml = (value) => {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  })[char])
}


const _createId = () => {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
  const random = Math.random().toString(36).slice(2, 7).toUpperCase()

  return `ECO-${timestamp}-${random}`
}


const _totalWeight = (list = records) => {
  return list.reduce((sum, item) => sum + Number(item.weight || 0), 0)
}


const _rankBy = (field) => {
  const totals = new Map()

  records.forEach((item) => totals.set(item[field], (totals.get(item[field]) || 0) + Number(item.weight || 0)))

  return [...totals.entries()].sort((a, b) => b[1] - a[1])
}


const _addQr = (target, text, size) => {
  target.innerHTML = ''

  if (window.QRCode) {
    new QRCode(target, { text, width: size, height: size, correctLevel: QRCode.CorrectLevel.M })
  } else {
    target.textContent = text
  }
}


const _demoRecords = () => {
  return [
    { id: 'ECO-20260727090000-A1B2C', device: 'Celular quebrado', weight: 0.18, school: 'Escola Municipal Uberaba', classroom: '8º A', student: 'Ana Clara', status: 'Na escola', createdAt: new Date().toISOString() },
    { id: 'ECO-20260727090500-D3E4F', device: 'Notebook antigo', weight: 2.4, school: 'Escola Municipal Uberaba', classroom: '8º A', student: 'João Pedro', status: 'No IFTM UPT', createdAt: new Date().toISOString() },
    { id: 'ECO-20260727091000-G5H6I', device: 'Impressora', weight: 5.2, school: 'Escola Estadual Triângulo', classroom: '1º B', student: 'Mariana Lima', status: 'Coletado pela Cooperu', createdAt: new Date().toISOString() }
  ]
}


const _renderMetrics = () => {
  const totalItemsEl = $('#totalItems')
  const totalWeightEl = $('#totalWeight')
  const topSchoolEl = $('#topSchool')
  const topStudentEl = $('#topStudent')

  if (serverDown) {
    if (totalItemsEl) totalItemsEl.textContent = 'Servidor offline'
    if (totalWeightEl) totalWeightEl.textContent = 'Servidor offline'
    if (topSchoolEl) topSchoolEl.textContent = 'Servidor offline'
    if (topStudentEl) topStudentEl.textContent = 'Servidor offline'

    return;
  }

  const schools = _rankBy('school')
  const students = _rankBy('student')

  if (totalItemsEl) totalItemsEl.textContent = records.length
  if (totalWeightEl) totalWeightEl.textContent = `${_totalWeight().toFixed(2)} kg`

  if (topSchoolEl) {
    topSchoolEl.textContent = schools[0] ? `${schools[0][0]} (${schools[0][1].toFixed(2)} kg)` : '-'
  }

  if (topStudentEl) {
    topStudentEl.textContent = students[0] ? `${students[0][0]} (${students[0][1].toFixed(2)} kg)` : '-'
  }
}


const _fillRanking = (selector, rows) => {
  const target = $(selector)

  if (!target) return;

  if (serverDown) {
    target.innerHTML = '<li>Servidor offline. Não foi possível carregar o ranking.</li>'

    return;
  }

  target.innerHTML = rows.length ? '' : '<li>Nenhum registro ainda.</li>'

  rows.slice(0, 10).forEach(([name, weight]) => {
    const li = document.createElement('li')

    li.textContent = `${name}: ${weight.toFixed(2)} kg`

    target.appendChild(li)
  })
}


const _renderRankings = () => {
  _fillRanking('#schoolRanking', _rankBy('school'))
  _fillRanking('#classRanking', _rankBy('classroom'))
  _fillRanking('#studentRanking', _rankBy('student'))
}


const _renderTable = () => {
  recordsTable.innerHTML = ''

  if (serverDown) {
    const tr = document.createElement('tr')

    tr.innerHTML = `<td colspan="8" style="text-align: center; color: var(--danger); font-weight: 600; padding: 1.5rem;">Servidor offline. Não foi possível conectar ao backend.</td>`

    recordsTable.appendChild(tr)

    return;
  }

  records.forEach((item) => {
    const tr = document.createElement('tr')

    tr.innerHTML = `
      <td>${_escapeHtml(item.id)}</td><td>${_escapeHtml(item.device)}</td><td>${Number(item.weight).toFixed(2)} kg</td>
      <td>${_escapeHtml(item.school)}</td><td>${_escapeHtml(item.classroom)}</td><td>${_escapeHtml(item.student)}</td><td>${_escapeHtml(item.status)}</td><td class="qr-cell"></td>`

    recordsTable.appendChild(tr)

    _addQr(tr.querySelector('.qr-cell'), item.id, 74)
  })
}


const _renderLabels = () => {
  labels.innerHTML = ''

  records.forEach((item) => {
    const card = document.createElement('article')

    card.className = 'label-card'
    card.setAttribute('role', 'listitem')
    card.innerHTML = `<strong>${_escapeHtml(item.id)}</strong><div class="qr"></div><small>${_escapeHtml(item.device)} • ${_escapeHtml(item.school)} • ${_escapeHtml(item.student)}</small>`

    labels.appendChild(card)

    _addQr(card.querySelector('.qr'), item.id, 128)
  })
}


const _render = () => {
  _renderMetrics()
  _renderRankings()
  _renderTable()
  _renderLabels()
}


const _fetchRecords = async () => {
  try {
    const res = await globalThis.fetch(`${SERVER_URL}/items`)

    if (res.ok) {
      const data = await res.json()

      serverDown = false

      if (Array.isArray(data.items)) {
        records = data.items.map((item) => ({
          id: item.uuid || item.id,
          device: item.name || '',
          weight: Number(item.weight || 0),
          school: item.school || '',
          classroom: item.description || '',
          student: item.owner || '',
          status: item.state || 'Na escola',
          createdAt: item.createdAt || item.created_at || new Date().toISOString()
        }))
      } else {
        records = []
      }
    } else {
      serverDown = true
      records = []
    }
  } catch (err) {
    console.warn('Could not fetch items from server:', err)

    serverDown = true
    records = []
  }

  _render()
}


menuButton.addEventListener('click', () => {
  const isOpen = menu.classList.toggle('open')

  menuButton.setAttribute('aria-expanded', String(isOpen))
})


loginForm.addEventListener('submit', async (event) => {
  event.preventDefault()

  const email = $('#email').value.trim()
  const password = $('#password').value

  try {
    const res = await globalThis.fetch(`${SERVER_URL}/login`, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: email, password })
    })

    if (res.ok) {
      const data = await res.json()

      if (data.token) {
        authToken = data.token
      }

      loginForm.classList.add('hidden')
      adminArea.classList.remove('hidden')
      $('#loginMessage').textContent = ''

      await _fetchRecords()

      return;
    }

    const errData = await res.json().catch(() => ({}))

    $('#loginMessage').textContent = errData.error || 'Login inválido.'
  } catch (err) {
    console.error('Login request failed:', err)

    $('#loginMessage').textContent = 'Servidor offline. Não foi possível conectar.'
  }
})


$('#logoutButton').addEventListener('click', () => {
  authToken = null

  adminArea.classList.add('hidden')
  loginForm.classList.remove('hidden')
})


recordForm.addEventListener('submit', async (event) => {
  event.preventDefault()

  const textInputs = [$('#device'), $('#school'), $('#classroom'), $('#student')]

  textInputs.forEach((input) => input.setCustomValidity(''))

  const blankInput = textInputs.find((input) => !input.value.trim())

  if (blankInput) {
    blankInput.setCustomValidity('Preencha este campo com um texto válido.')
    blankInput.reportValidity()
    blankInput.addEventListener('input', () => blankInput.setCustomValidity(''), { once: true })

    return;
  }

  const weightInput = $('#weight')
  const weight = Number(weightInput.value)

  if (!Number.isFinite(weight) || weight <= 0) {
    weightInput.setCustomValidity('Informe um peso maior que zero.')
    weightInput.reportValidity()
    weightInput.addEventListener('input', () => weightInput.setCustomValidity(''), { once: true })

    return;
  }

  const record = {
    id: _createId(),
    device: $('#device').value.trim(),
    weight,
    school: $('#school').value.trim(),
    classroom: $('#classroom').value.trim(),
    student: $('#student').value.trim(),
    status: $('#status').value,
    createdAt: new Date().toISOString()
  }

  if (authToken) {
    try {
      const res = await globalThis.fetch(`${SERVER_URL}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          name: record.device,
          owner: record.student,
          weight: record.weight,
          state: record.status,
          school: record.school,
          description: record.classroom
        })
      })

      if (res.ok) {
        await _fetchRecords()
        recordForm.reset()

        return;
      }
    } catch (err) {
      console.warn('Could not post record to server:', err)

      alert('Servidor offline. Não foi possível enviar o registro ao servidor.')

      return;
    }
  }

  records.unshift(record)
  _render()

  recordForm.reset()
})


/* INFO: REPORT CONFIG & PDF GENERATION */

const REPORT_COLORS = {
  ground: [12, 20, 17],
  green: [11, 107, 63],
  lime: [201, 242, 78],
  paper: [244, 243, 237],
  zebra: [250, 250, 246],
  line: [222, 219, 208],
  ink: [18, 32, 26],
  muted: [98, 110, 102],
  white: [255, 255, 255]
}

const REPORT_COLUMNS = [
  { key: 'index', label: '#', width: 8 },
  { key: 'id', label: 'ID', width: 42 },
  { key: 'device', label: 'Aparelho', width: 26 },
  { key: 'weight', label: 'Peso', width: 16, align: 'right' },
  { key: 'school', label: 'Escola', width: 30 },
  { key: 'classroom', label: 'Sala', width: 13 },
  { key: 'student', label: 'Aluno', width: 27 },
  { key: 'status', label: 'Status', width: 20 }
]


const _exportPdf = () => {
  if (!window.jspdf) {
    alert('Biblioteca PDF indisponível. Use a impressão do navegador como alternativa.')

    window.print()

    return;
  }

  const { jsPDF } = window.jspdf
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 14
  const contentW = pageW - margin * 2
  const now = new Date()
  const stamp = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  })}`

  doc.setProperties({
    title: 'Relatório EcoTech - Resíduos Eletrônicos',
    subject: 'Coleta de lixo eletrônico - IFTM Campus Uberaba Parque Tecnológico',
    author: 'EcoTech IFTM UPT'
  })

  const fill = (color) => doc.setFillColor(color[0], color[1], color[2])
  const ink = (color) => doc.setTextColor(color[0], color[1], color[2])
  const stroke = (color) => doc.setDrawColor(color[0], color[1], color[2])


  const _clip = (value, width) => {
    let text = value === undefined || value === null || value === '' ? '-' : String(value)

    if (doc.getTextWidth(text) <= width) return text

    while (text.length > 1 && doc.getTextWidth(`${text}...`) > width) {
      text = text.slice(0, -1)
    }

    return `${text}...`
  }


  const _sectionTitle = (label, y) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)

    ink(REPORT_COLORS.green)
    doc.text(label.toUpperCase(), margin, y, { charSpace: 0.35 })

    stroke(REPORT_COLORS.line)
    doc.setLineWidth(0.3)
    doc.line(margin, y + 2.4, margin + contentW, y + 2.4)

    return y + 9
  }


  const _drawBanner = () => {
    fill(REPORT_COLORS.ground)
    doc.rect(0, 0, pageW, 31, 'F')

    fill(REPORT_COLORS.lime)
    doc.rect(0, 31, pageW, 1.4, 'F')

    ink(REPORT_COLORS.lime)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.text('ECOTECH · IFTM CAMPUS UBERABA PARQUE TECNOLÓGICO', margin, 12, { charSpace: 0.5 })

    ink(REPORT_COLORS.white)
    doc.setFontSize(18)
    doc.text('Relatório de resíduos eletrônicos', margin, 22)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)

    ink([158, 172, 163])
    doc.text(`Gerado em ${stamp}`, pageW - margin, 22, { align: 'right' })
  }


  const _drawSummary = (y) => {
    const cells = [
      { label: 'Aparelhos cadastrados', value: String(records.length) },
      { label: 'Peso total arrecadado', value: `${_totalWeight().toFixed(2)} kg` },
      { label: 'Escolas participantes', value: String(_rankBy('school').length) },
      { label: 'Alunos envolvidos', value: String(_rankBy('student').length) }
    ]
    const gap = 4
    const cellW = (contentW - gap * 3) / 4

    cells.forEach((cell, index) => {
      const x = margin + index * (cellW + gap)

      fill(REPORT_COLORS.paper)
      stroke(REPORT_COLORS.line)
      doc.setLineWidth(0.3)
      doc.roundedRect(x, y, cellW, 21, 1.6, 1.6, 'FD')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      ink(REPORT_COLORS.ink)
      doc.text(_clip(cell.value, cellW - 8), x + 4.5, y + 11)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.8)
      ink(REPORT_COLORS.muted)
      doc.text(_clip(cell.label, cellW - 8), x + 4.5, y + 16.6)
    })

    return y + 21 + 10
  }


  const _drawHighlights = (y) => {
    let currentY = _sectionTitle('Destaques por peso arrecadado', y)

    const groups = [
      { title: 'Escolas', rows: _rankBy('school').slice(0, 5) },
      { title: 'Salas', rows: _rankBy('classroom').slice(0, 5) },
      { title: 'Alunos', rows: _rankBy('student').slice(0, 5) }
    ]
    const gap = 6
    const colW = (contentW - gap * 2) / 3

    let lines = 1

    groups.forEach((group, index) => {
      const x = margin + index * (colW + gap)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      ink(REPORT_COLORS.ink)
      doc.text(group.title, x, currentY)

      let rowY = currentY + 6

      if (!group.rows.length) {
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(7.5)
        ink(REPORT_COLORS.muted)
        doc.text('sem registros', x, rowY)
      }

      group.rows.forEach(([name, weight], position) => {
        doc.setFontSize(7.5)
        doc.setFont('helvetica', 'normal')
        ink(REPORT_COLORS.muted)
        doc.text(`${position + 1}.`, x, rowY)

        ink(REPORT_COLORS.ink)
        doc.text(_clip(name, colW - 24), x + 4.5, rowY)

        doc.setFont('helvetica', 'bold')
        ink(REPORT_COLORS.green)
        doc.text(`${weight.toFixed(2)} kg`, x + colW, rowY, { align: 'right' })

        rowY += 5
      })

      lines = Math.max(lines, group.rows.length || 1)
    })

    return currentY + 6 + lines * 5 + 7
  }


  const _drawTableHead = (y) => {
    fill(REPORT_COLORS.ground)
    doc.rect(margin, y, contentW, 7.4, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.8)
    ink(REPORT_COLORS.white)

    let x = margin

    REPORT_COLUMNS.forEach((col) => {
      const right = col.align === 'right'

      doc.text(col.label.toUpperCase(), right ? x + col.width - 2.5 : x + 2.5, y + 4.9, {
        align: right ? 'right' : 'left',
        charSpace: 0.3
      })

      x += col.width
    })

    return y + 7.4
  }


  const _drawTable = (y) => {
    let currentY = _sectionTitle(`Registros (${records.length})`, y)

    currentY = _drawTableHead(currentY)

    const rowH = 6.6

    records.forEach((item, index) => {
      if (currentY + rowH > pageH - 20) {
        doc.addPage()
        currentY = _drawTableHead(margin + 2)
      }

      if (index % 2 === 1) {
        fill(REPORT_COLORS.zebra)
        doc.rect(margin, currentY, contentW, rowH, 'F')
      }

      stroke(REPORT_COLORS.line)
      doc.setLineWidth(0.2)
      doc.line(margin, currentY + rowH, margin + contentW, currentY + rowH)

      let x = margin

      REPORT_COLUMNS.forEach((col) => {
        let value = null

        if (col.key === 'index') value = String(index + 1)
        else if (col.key === 'weight') value = `${Number(item.weight || 0).toFixed(2)} kg`
        else value = item[col.key]

        doc.setFont('helvetica', col.key === 'id' ? 'bold' : 'normal')
        doc.setFontSize(7)
        ink(col.key === 'index' ? REPORT_COLORS.muted : REPORT_COLORS.ink)

        const right = col.align === 'right'

        doc.text(_clip(value, col.width - 5), right ? x + col.width - 2.5 : x + 2.5, currentY + 4.4, {
          align: right ? 'right' : 'left'
        })

        x += col.width
      })

      currentY += rowH
    })

    if (currentY + 7.4 > pageH - 20) {
      doc.addPage()
      currentY = margin + 2
    }

    fill(REPORT_COLORS.paper)
    doc.rect(margin, currentY, contentW, 7.4, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.2)

    ink(REPORT_COLORS.ink)
    doc.text(`TOTAL · ${records.length} aparelhos`, margin + 2.5, currentY + 4.9, { charSpace: 0.3 })

    ink(REPORT_COLORS.green)
    doc.text(`${_totalWeight().toFixed(2)} kg`, margin + contentW - 2.5, currentY + 4.9, { align: 'right' })

    return currentY + 7.4
  }


  const _drawFooters = () => {
    const pages = doc.getNumberOfPages()

    for (let page = 1; page <= pages; page += 1) {
      doc.setPage(page)

      stroke(REPORT_COLORS.line)
      doc.setLineWidth(0.3)
      doc.line(margin, pageH - 12.5, pageW - margin, pageH - 12.5)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)

      ink(REPORT_COLORS.muted)
      doc.text('EcoTech IFTM UPT · Coleta de resíduos eletrônicos', margin, pageH - 8)
      doc.text(`Página ${page} de ${pages}`, pageW - margin, pageH - 8, { align: 'right' })
    }
  }

  _drawBanner()

  let y = 43

  if (!records.length) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)

    ink(REPORT_COLORS.muted)
    doc.text('Nenhum aparelho cadastrado até o momento.', margin, y)
  } else {
    y = _sectionTitle('Resumo da campanha', y)
    y = _drawSummary(y)
    y = _drawHighlights(y)

    _drawTable(y)
  }

  _drawFooters()
  doc.save(`relatorio-ecotech-${now.toISOString().slice(0, 10)}.pdf`)
}


$('#printLabels').addEventListener('click', () => window.print())
$('#exportPdf').addEventListener('click', _exportPdf)

$('#seedDemo').addEventListener('click', async () => {
  const demoList = _demoRecords()

  if (authToken) {
    for (const item of demoList) {
      try {
        await globalThis.fetch(`${SERVER_URL}/items`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify({
            name: item.device,
            owner: item.student,
            weight: item.weight,
            state: item.status,
            school: item.school,
            description: item.classroom
          })
        })
      } catch (err) {
        console.warn('Failed to seed demo item to server:', err)
      }
    }

    await _fetchRecords()
  } else {
    records = demoList
    _render()
  }
})

$('#clearData').addEventListener('click', () => {
  if (confirm('Deseja apagar todos os registros desta demonstração?')) {
    records = []
    _render()
  }
})

_fetchRecords()


/* INFO: INTERACTIVE MAP & COLLECTION POINTS */

const PONTOS_COLETA = [
  {
    nome: 'IFTM UPT - Unidade II',
    lat: -19.7696157,
    lng: -47.9488148,
    materiais: ['eletronicos', 'pilhas'],
    endereco: 'Av. Edilson Lamartine Mendes, 300 - Parque das Américas'
  },
  {
    nome: 'IFTM UPT - Unidade I',
    lat: -19.7188445,
    lng: -47.9577374,
    materiais: ['eletronicos', 'pilhas'],
    endereco: 'Av. Dr. Florestan Fernandes, 131 - Univerdecidade'
  },
  {
    nome: 'EcoPonto Central',
    lat: -19.7478,
    lng: -47.9333,
    materiais: ['plastico', 'papel', 'vidro', 'metal'],
    endereco: 'Av. Leopoldino de Oliveira, 1000 - Centro'
  },
  {
    nome: 'Posto Recicla Mercês',
    lat: -19.7550,
    lng: -47.9400,
    materiais: ['eletronicos', 'pilhas', 'oleo'],
    endereco: 'Rua São Benedito, 500 - Mercês'
  },
  {
    nome: 'Cooperativa Triângulo',
    lat: -19.7300,
    lng: -47.9200,
    materiais: ['plastico', 'papel', 'metal', 'vidro'],
    endereco: 'Av. Guilherme Ferreira, 2000 - Estados Unidos'
  },
  {
    nome: 'EcoPonto Olinda / Uniube',
    lat: -19.7600,
    lng: -47.9500,
    materiais: ['vidro', 'eletronicos', 'oleo'],
    endereco: 'Av. Nenê Sabino, 1500 - Olinda'
  },
  {
    nome: 'Ponto Verde Boa Vista',
    lat: -19.7380,
    lng: -47.9450,
    materiais: ['plastico', 'papel'],
    endereco: 'Av. Elias Cruvinel, 800 - Boa Vista'
  }
]


document.addEventListener('DOMContentLoaded', () => {
  const mapContainer = document.getElementById('map-container')
  const instructionsDiv = document.getElementById('route-instructions')
  const routeStatus = document.getElementById('route-status')

  let markersLayer = null
  let originMarker = null
  let destMarker = null
  let routingControl = null
  let userCurrentCoords = null

  if (!mapContainer) return;

  const _announceRoute = (message) => {
    if (routeStatus) routeStatus.textContent = message
  }

  const _showRouteError = (message) => {
    if (instructionsDiv) instructionsDiv.textContent = message

    _announceRoute(message)
  }

  if (!window.L || typeof window.L.map !== 'function' || typeof window.L.tileLayer !== 'function') {
    const message = 'Mapa indisponível. Verifique sua conexão e recarregue a página.'

    mapContainer.classList.add('map-unavailable')
    mapContainer.textContent = message

    ;['gps-btn', 'calc-route-btn', 'filter-map-btn'].forEach((id) => {
      const button = document.getElementById(id)

      if (button) button.disabled = true
    })

    _announceRoute(message)

    return;
  }

  const map = L.map('map-container').setView([-19.7478, -47.9333], 13)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map)

  markersLayer = L.layerGroup().addTo(map)

  const _pontosPorMaterial = (material = 'all') => {
    return material === 'all'
      ? PONTOS_COLETA
      : PONTOS_COLETA.filter((ponto) => ponto.materiais.includes(material))
  }

  const _renderEcopontos = (filtroMaterial = 'all') => {
    markersLayer.clearLayers()

    _pontosPorMaterial(filtroMaterial).forEach((ponto) => {
      const marker = L.marker([ponto.lat, ponto.lng])

      marker.bindPopup(`
        <div class="map-popup">
          <h4>${ponto.nome}</h4>
          <p>${ponto.endereco}</p>
          <p class="map-popup-materials"><strong>Aceita:</strong> ${ponto.materiais.join(', ')}</p>
        </div>
      `)

      markersLayer.addLayer(marker)
    })
  }

  _renderEcopontos()

  const _geocode = async (textoBusca) => {
    const buscaCompleta = textoBusca.toLowerCase().includes('uberaba')
      ? textoBusca
      : `${textoBusca}, Uberaba, MG, Brasil`

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(buscaCompleta)}`

    try {
      const res = await globalThis.fetch(url)
      const data = await res.json()

      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          name: data[0].display_name
        }
      }
    } catch (e) {
      console.error('Erro ao geocodificar:', e)
    }

    return null
  }

  const _calcularDistancia = (lat1, lon1, lat2, lon2) => {
    const R = 6371
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLon = ((lon2 - lon1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2)

    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
  }

  const gpsBtn = document.getElementById('gps-btn')

  if (gpsBtn) {
    gpsBtn.addEventListener('click', () => {
      if (!navigator.geolocation) {
        alert('Seu navegador não suporta geolocalização.')

        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          userCurrentCoords = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          }

          document.getElementById('origin-input').value = 'Minha localização atual (GPS)'
        },
        () => {
          alert('Não foi possível obter a sua localização atual via GPS.')
        }
      )
    })
  }

  const calcRouteBtn = document.getElementById('calc-route-btn')

  if (calcRouteBtn) {
    calcRouteBtn.addEventListener('click', async () => {
      const originText = document.getElementById('origin-input').value.trim()
      const destText = document.getElementById('destination-input').value.trim()
      const selectedMaterial = document.getElementById('material-filter').value
      const eligiblePoints = _pontosPorMaterial(selectedMaterial)

      if (!eligiblePoints.length) {
        alert('Nenhum ponto de coleta aceita o material selecionado.')

        return;
      }

      let originCoords = null
      let destCoords = null

      if (originText === 'Minha localização atual (GPS)' && userCurrentCoords) {
        originCoords = userCurrentCoords
      } else if (originText !== '') {
        originCoords = await _geocode(originText)
      } else if (userCurrentCoords) {
        originCoords = userCurrentCoords
      } else {
        alert('Por favor, digite um endereço/bairro de origem ou clique em GPS.')

        return;
      }

      if (!originCoords) {
        alert('Endereço de origem não encontrado em Uberaba.')

        return;
      }

      if (destText !== '') {
        const ecopontoEncontrado = PONTOS_COLETA.find((p) =>
          p.nome.toLowerCase().includes(destText.toLowerCase())
        )

        if (ecopontoEncontrado) {
          if (selectedMaterial !== 'all' && !ecopontoEncontrado.materiais.includes(selectedMaterial)) {
            alert('O ponto de coleta informado não aceita o material selecionado.')

            return;
          }

          destCoords = {
            lat: ecopontoEncontrado.lat,
            lng: ecopontoEncontrado.lng
          }
        } else {
          destCoords = await _geocode(destText)
        }
      } else {
        let maisProximo = null
        let menorDist = Infinity

        eligiblePoints.forEach((ponto) => {
          const dist = _calcularDistancia(
            originCoords.lat,
            originCoords.lng,
            ponto.lat,
            ponto.lng
          )

          if (dist < menorDist) {
            menorDist = dist
            maisProximo = ponto
          }
        })

        if (maisProximo) {
          destCoords = {
            lat: maisProximo.lat,
            lng: maisProximo.lng
          }
        }
      }

      if (!destCoords) {
        alert('Endereço de destino não localizado.')

        return;
      }

      if (originMarker) map.removeLayer(originMarker)
      if (destMarker) map.removeLayer(destMarker)

      originMarker = L.marker([originCoords.lat, originCoords.lng])
        .addTo(map)
        .bindPopup('<b>Origem</b>')
        .openPopup()

      destMarker = L.marker([destCoords.lat, destCoords.lng])
        .addTo(map)
        .bindPopup('<b>Destino</b>')

      if (routingControl) {
        map.removeControl(routingControl)
        routingControl = null
      }

      if (!window.L.Routing || typeof window.L.Routing.control !== 'function') {
        _showRouteError('A rota detalhada está indisponível. O mapa mostra apenas a origem e o destino.')

        map.fitBounds(
          [
            [originCoords.lat, originCoords.lng],
            [destCoords.lat, destCoords.lng]
          ],
          { padding: [32, 32], maxZoom: 15 }
        )

        return;
      }

      routingControl = L.Routing.control({
        waypoints: [
          L.latLng(originCoords.lat, originCoords.lng),
          L.latLng(destCoords.lat, destCoords.lng)
        ],
        language: 'pt-BR',
        lineOptions: {
          styles: [{ color: '#1976D2', weight: 5, opacity: 0.8 }]
        },
        addWaypoints: false,
        draggableWaypoints: false,
        fitSelectedRoutes: true,
        show: true
      })

      routingControl.on('routesfound', () => {
        _announceRoute('Rota calculada. As instruções estão disponíveis antes do mapa.')
      })

      routingControl.on('routingerror', () => {
        _announceRoute('Não foi possível calcular a rota solicitada. Tente outro endereço.')
      })

      routingControl.addTo(map)

      if (instructionsDiv) {
        instructionsDiv.replaceChildren(routingControl.getContainer())
      }
    })
  }

  const filterMapBtn = document.getElementById('filter-map-btn')

  if (filterMapBtn) {
    filterMapBtn.addEventListener('click', () => {
      const material = document.getElementById('material-filter').value

      _renderEcopontos(material)
    })
  }
})


/* INFO: UI THEME TOGGLE & SCROLL INTERACTION */

;(() => {
  const root = document.documentElement
  const themeToggle = document.getElementById('themeToggle')

  const _currentTheme = () => {
    const chosen = root.getAttribute('data-theme')

    if (chosen) return chosen

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  const _syncToggleLabel = () => {
    if (!themeToggle) return;

    const next = _currentTheme() === 'dark' ? 'claro' : 'escuro'

    themeToggle.setAttribute('aria-label', `Mudar para o tema ${next}`)
    themeToggle.setAttribute('title', `Mudar para o tema ${next}`)
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const next = _currentTheme() === 'dark' ? 'light' : 'dark'

      root.setAttribute('data-theme', next)
      _syncToggleLabel()
    })

    _syncToggleLabel()
  }

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!root.getAttribute('data-theme')) _syncToggleLabel()
  })

  const nav = document.getElementById('siteNav')

  if (nav) {
    const _updateNav = () => nav.classList.toggle('is-scrolled', window.scrollY > 8)

    _updateNav()
    window.addEventListener('scroll', _updateNav, { passive: true })
  }

  const navMenu = document.getElementById('menu')

  if (navMenu && menuButton) {
    navMenu.addEventListener('click', (event) => {
      if (event.target.tagName !== 'A') return;

      navMenu.classList.remove('open')
      menuButton.setAttribute('aria-expanded', 'false')
    })
  }

  const passwordToggle = document.getElementById('passwordToggle')
  const passwordInput = document.getElementById('password')

  if (passwordToggle && passwordInput) {
    passwordToggle.addEventListener('click', () => {
      const visivel = passwordInput.type === 'text'

      passwordInput.type = visivel ? 'password' : 'text'
      passwordToggle.classList.toggle('is-visible', !visivel)

      const rotulo = visivel ? 'Mostrar senha' : 'Ocultar senha'

      passwordToggle.setAttribute('aria-label', rotulo)
      passwordToggle.setAttribute('title', rotulo)
    })
  }

  const revelaveis = [...document.querySelectorAll('[data-reveal]')]
  const comMovimento = root.classList.contains('js-anim')

  if (!comMovimento || !('IntersectionObserver' in window)) {
    revelaveis.forEach((el) => el.classList.add('is-visible'))
  } else {
    const revelador = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          entry.target.classList.add('is-visible')
          revelador.unobserve(entry.target)
        })
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.06 }
    )

    revelaveis.forEach((el) => revelador.observe(el))

    requestAnimationFrame(() => {
      revelaveis.forEach((el) => {
        if (el.getBoundingClientRect().top < window.innerHeight) {
          el.classList.add('is-visible')
          revelador.unobserve(el)
        }
      })
    })
  }

  const links = [...document.querySelectorAll('.menu a[href^="#"]')]
  const sections = links
    .map((link) => document.querySelector(link.getAttribute('href')))
    .filter(Boolean)

  if (sections.length && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          links.forEach((link) => {
            link.classList.toggle('is-active', link.getAttribute('href') === `#${entry.target.id}`)
          })
        })
      },
      { rootMargin: '-45% 0px -50% 0px' }
    )

    sections.forEach((section) => observer.observe(section))
  }
})()

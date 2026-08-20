const SERVER_URL = 'http://127.0.0.1:3000'

const $ = (selector) => document.querySelector(selector)
const menuButton = $('.menu-button')
const menu = $('#menu')
const menuOverlay = $('#menuOverlay')
const loginForm = $('#loginForm')
const adminArea = $('#adminArea')
const recordForm = $('#recordForm')
const recordsTable = $('#recordsTable')
const labels = $('#labels')

let records = []
let serverDown = false
let authToken = null


const _escapeHtml = (value) => {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;')
}


const _showToast = (message, type = 'success') => {
  const container = $('#toastContainer')

  if (!container) return;

  const toast = document.createElement('div')

  toast.className = `toast toast-${type}`
  toast.textContent = message
  container.appendChild(toast)

  requestAnimationFrame(() => {
    toast.classList.add('is-visible')
  })

  setTimeout(() => {
    toast.classList.remove('is-visible')
    toast.classList.add('is-leaving')

    setTimeout(() => toast.remove(), 250)
  }, 4000)
}


const _createId = () => {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
  const random = Math.random().toString(36).slice(2, 7).toUpperCase()

  return `ECO-${timestamp}-${random}`
}


/* INFO: Single-pass stats calculator for total weight and school/classroom/student rankings */
const _calcStats = () => {
  const totals = { school: new Map(), classroom: new Map(), student: new Map() }
  let totalWeight = 0

  records.forEach((item) => {
    const weight = Number(item.weight || 0)

    totalWeight += weight

    ;['school', 'classroom', 'student'].forEach((field) => {
      const val = item[field]

      if (val) totals[field].set(val, (totals[field].get(val) || 0) + weight)
    })
  })

  return {
    totalWeight,
    school: [...totals.school.entries()].sort((a, b) => b[1] - a[1]),
    classroom: [...totals.classroom.entries()].sort((a, b) => b[1] - a[1]),
    student: [...totals.student.entries()].sort((a, b) => b[1] - a[1])
  }
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


const _getStatusClass = (status = '') => {
  const lower = status.toLowerCase()

  if (lower.includes('coletado')) return 'status-coletado'
  if (lower.includes('escola')) return 'status-na-escola'
  if (lower.includes('iftm')) return 'status-no-iftm'

  return 'status-pendente'
}


/* INFO: Unified UI Renderer */
const _render = () => {
  const metricEls = {
    totalItems: $('#totalItems'),
    totalWeight: $('#totalWeight'),
    topSchool: $('#topSchool'),
    topStudent: $('#topStudent')
  }

  if (serverDown) {
    Object.values(metricEls).forEach((el) => {
      if (el) el.textContent = 'Servidor offline'
    })

    ;['#schoolRanking', '#classRanking', '#studentRanking'].forEach((sel) => {
      const el = $(sel)

      if (el) el.innerHTML = '<li class="empty-state"><div class="empty-title">Servidor offline</div><p class="empty-text">Não foi possível carregar o ranking.</p></li>'
    })

    recordsTable.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--danger); font-weight: 600; padding: 1.5rem;">Servidor offline. Não foi possível conectar ao backend.</td></tr>`
    labels.innerHTML = ''

    return;
  }

  const stats = _calcStats()

  if (metricEls.totalItems) metricEls.totalItems.textContent = records.length
  if (metricEls.totalWeight) metricEls.totalWeight.textContent = `${stats.totalWeight.toFixed(2)} kg`
  if (metricEls.topSchool) metricEls.topSchool.textContent = stats.school[0] ? `${stats.school[0][0]} (${stats.school[0][1].toFixed(2)} kg)` : '-'
  if (metricEls.topStudent) metricEls.topStudent.textContent = stats.student[0] ? `${stats.student[0][0]} (${stats.student[0][1].toFixed(2)} kg)` : '-'

  const rankTargets = [
    { target: $('#schoolRanking'), rows: stats.school },
    { target: $('#classRanking'), rows: stats.classroom },
    { target: $('#studentRanking'), rows: stats.student }
  ]

  rankTargets.forEach(({ target, rows }) => {
    if (!target) return;

    target.innerHTML = ''

    if (!rows.length) {
      target.innerHTML = '<li class="empty-state"><div class="empty-title">Nenhum registro ainda</div><p class="empty-text">Os dados serão exibidos assim que forem cadastrados.</p></li>'

      return;
    }

    const maxWeight = rows[0][1] || 1

    rows.slice(0, 10).forEach(([name, weight], index) => {
      const li = document.createElement('li')
      const pct = Math.max(8, Math.round((weight / maxWeight) * 100))

      li.className = 'rank-item'
      li.innerHTML = `
        <span class="rank-position">${index + 1}</span>
        <div class="rank-info">
          <div class="rank-name">${_escapeHtml(name)}</div>
          <div class="rank-weight">${weight.toFixed(2)} kg</div>
        </div>
        <div class="rank-bar-bg"><div class="rank-bar-fill" style="width: ${pct}%;"></div></div>`

      target.appendChild(li)
    })
  })

  recordsTable.innerHTML = ''
  labels.innerHTML = ''

  if (!records.length) {
    recordsTable.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-secondary);">Nenhum aparelho cadastrado no momento. Use o formulário acima para registrar o primeiro item.</td></tr>`

    return;
  }

  records.forEach((item) => {
    const tr = document.createElement('tr')
    const statusClass = _getStatusClass(item.status)

    tr.innerHTML = `
      <td><strong>${_escapeHtml(item.id)}</strong></td>
      <td>${_escapeHtml(item.device)}</td>
      <td><strong>${Number(item.weight).toFixed(2)} kg</strong></td>
      <td>${_escapeHtml(item.school)}</td>
      <td>${_escapeHtml(item.classroom)}</td>
      <td>${_escapeHtml(item.student)}</td>
      <td><span class="status-badge ${statusClass}">${_escapeHtml(item.status)}</span></td>
      <td class="qr-cell"></td>`

    recordsTable.appendChild(tr)

    _addQr(tr.querySelector('.qr-cell'), item.id, 74)

    const card = document.createElement('article')

    card.className = 'label-card'
    card.setAttribute('role', 'listitem')
    card.innerHTML = `<strong>${_escapeHtml(item.id)}</strong><div class="qr"></div><small>${_escapeHtml(item.device)} • ${_escapeHtml(item.school)} • ${_escapeHtml(item.student)}</small>`

    labels.appendChild(card)

    _addQr(card.querySelector('.qr'), item.id, 128)
  })
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


const _toggleMenu = (open) => {
  const isOpen = open !== undefined ? open : menu.classList.toggle('open')

  if (isOpen) {
    menu.classList.add('open')
    if (menuOverlay) menuOverlay.classList.add('is-open')
    menuButton.setAttribute('aria-expanded', 'true')
  } else {
    menu.classList.remove('open')
    if (menuOverlay) menuOverlay.classList.remove('is-open')
    menuButton.setAttribute('aria-expanded', 'false')
  }
}

menuButton.addEventListener('click', () => _toggleMenu())

if (menuOverlay) {
  menuOverlay.addEventListener('click', () => _toggleMenu(false))
}


loginForm.addEventListener('submit', async (event) => {
  event.preventDefault()

  const submitBtn = loginForm.querySelector('button[type="submit"]')
  const emailInput = $('#email')
  const email = emailInput.value.trim()
  const passwordInput = $('#password')
  const password = passwordInput.value

  [emailInput, passwordInput].forEach((input) => input.classList.remove('is-invalid'))

  if (!email) {
    emailInput.classList.add('is-invalid')
    emailInput.addEventListener('input', () => emailInput.classList.remove('is-invalid'), { once: true })

    return;
  }

  if (submitBtn) submitBtn.classList.add('is-loading')

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

      _showToast('Autenticação realizada com sucesso!', 'success')
      await _fetchRecords()

      return;
    }

    const errData = await res.json().catch(() => ({}))
    const errorMsg = errData.error || 'Login inválido.'

    $('#loginMessage').textContent = errorMsg
    _showToast(errorMsg, 'error')
  } catch (err) {
    console.error('Login request failed:', err)

    $('#loginMessage').textContent = 'Servidor offline. Não foi possível conectar.'
    _showToast('Servidor offline. Não foi possível conectar.', 'error')
  } finally {
    if (submitBtn) submitBtn.classList.remove('is-loading')
  }
})


$('#logoutButton').addEventListener('click', () => {
  authToken = null

  adminArea.classList.add('hidden')
  loginForm.classList.remove('hidden')
  _showToast('Sessão encerrada com sucesso.', 'success')
})


recordForm.addEventListener('submit', async (event) => {
  event.preventDefault()

  const submitBtn = recordForm.querySelector('button[type="submit"]')
  const textInputs = [$('#device'), $('#school'), $('#classroom'), $('#student')]
  const weightInput = $('#weight')

  textInputs.concat(weightInput).forEach((input) => {
    input.classList.remove('is-invalid')
    input.setCustomValidity('')
  })

  const blankInput = textInputs.find((input) => !input.value.trim())

  if (blankInput) {
    blankInput.classList.add('is-invalid')
    blankInput.setCustomValidity('Preencha este campo com um texto válido.')
    blankInput.reportValidity()
    blankInput.addEventListener('input', () => blankInput.classList.remove('is-invalid'), { once: true })

    return;
  }

  const weight = Number(weightInput.value)

  if (!Number.isFinite(weight) || weight <= 0) {
    weightInput.classList.add('is-invalid')
    weightInput.setCustomValidity('Informe um peso maior que zero.')
    weightInput.reportValidity()
    weightInput.addEventListener('input', () => weightInput.classList.remove('is-invalid'), { once: true })

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

  if (submitBtn) submitBtn.classList.add('is-loading')

  try {
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
          _showToast('Dispositivo registrado com sucesso no servidor!', 'success')

          return;
        }
      } catch (err) {
        console.warn('Could not post record to server:', err)

        _showToast('Servidor offline. Não foi possível enviar ao servidor.', 'error')

        return;
      }
    }

    records.unshift(record)
    _render()
    recordForm.reset()
    _showToast('Dispositivo registrado localmente com sucesso!', 'success')
  } finally {
    if (submitBtn) submitBtn.classList.remove('is-loading')
  }
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

  let y = 43

  if (!records.length) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)

    ink(REPORT_COLORS.muted)
    doc.text('Nenhum aparelho cadastrado até o momento.', margin, y)
  } else {
    const stats = _calcStats()

    y = _sectionTitle('Resumo da campanha', y)

    const summaryCells = [
      { label: 'Aparelhos cadastrados', value: String(records.length) },
      { label: 'Peso total arrecadado', value: `${stats.totalWeight.toFixed(2)} kg` },
      { label: 'Escolas participantes', value: String(stats.school.length) },
      { label: 'Alunos envolvidos', value: String(stats.student.length) }
    ]
    const gap = 4
    const cellW = (contentW - gap * 3) / 4

    summaryCells.forEach((cell, index) => {
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

    y += 31

    y = _sectionTitle('Destaques por peso arrecadado', y)

    const groups = [
      { title: 'Escolas', rows: stats.school.slice(0, 5) },
      { title: 'Salas', rows: stats.classroom.slice(0, 5) },
      { title: 'Alunos', rows: stats.student.slice(0, 5) }
    ]
    const colW = (contentW - 12) / 3
    let lines = 1

    groups.forEach((group, index) => {
      const x = margin + index * (colW + 6)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      ink(REPORT_COLORS.ink)
      doc.text(group.title, x, y)

      let rowY = y + 6

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

    y += 6 + lines * 5 + 7

    y = _sectionTitle(`Registros (${records.length})`, y)

    const drawTableHead = (headY) => {
      fill(REPORT_COLORS.ground)
      doc.rect(margin, headY, contentW, 7.4, 'F')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6.8)
      ink(REPORT_COLORS.white)

      let x = margin

      REPORT_COLUMNS.forEach((col) => {
        const right = col.align === 'right'

        doc.text(col.label.toUpperCase(), right ? x + col.width - 2.5 : x + 2.5, headY + 4.9, {
          align: right ? 'right' : 'left',
          charSpace: 0.3
        })

        x += col.width
      })

      return headY + 7.4
    }

    y = drawTableHead(y)

    const rowH = 6.6

    records.forEach((item, index) => {
      if (y + rowH > pageH - 20) {
        doc.addPage()
        y = drawTableHead(margin + 2)
      }

      if (index % 2 === 1) {
        fill(REPORT_COLORS.zebra)
        doc.rect(margin, y, contentW, rowH, 'F')
      }

      stroke(REPORT_COLORS.line)
      doc.setLineWidth(0.2)
      doc.line(margin, y + rowH, margin + contentW, y + rowH)

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

        doc.text(_clip(value, col.width - 5), right ? x + col.width - 2.5 : x + 2.5, y + 4.4, {
          align: right ? 'right' : 'left'
        })

        x += col.width
      })

      y += rowH
    })

    if (y + 7.4 > pageH - 20) {
      doc.addPage()
      y = margin + 2
    }

    fill(REPORT_COLORS.paper)
    doc.rect(margin, y, contentW, 7.4, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.2)

    ink(REPORT_COLORS.ink)
    doc.text(`TOTAL · ${records.length} aparelhos`, margin + 2.5, y + 4.9, { charSpace: 0.3 })

    ink(REPORT_COLORS.green)
    doc.text(`${stats.totalWeight.toFixed(2)} kg`, margin + contentW - 2.5, y + 4.9, { align: 'right' })
  }

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

  _showToast('Registros de exemplo carregados com sucesso!', 'success')
})

$('#clearData').addEventListener('click', () => {
  if (confirm('Deseja apagar todos os registros desta demonstração?')) {
    records = []
    _render()
    _showToast('Todos os registros foram limpos.', 'success')
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

  if (!window.L || typeof window.L.map !== 'function' || typeof window.L.tileLayer !== 'function') {
    const message = 'Mapa indisponível. Verifique sua conexão e recarregue a página.'

    mapContainer.classList.add('map-unavailable')
    mapContainer.textContent = message

    ;['gps-btn', 'calc-route-btn', 'filter-map-btn'].forEach((id) => {
      const button = document.getElementById(id)

      if (button) button.disabled = true
    })

    if (routeStatus) routeStatus.textContent = message

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
    const rad = Math.PI / 180
    const dLat = (lat2 - lat1) * rad
    const dLon = (lon2 - lon1) * rad
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2

    return 6371 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
  }

  const gpsBtn = document.getElementById('gps-btn')

  if (gpsBtn) {
    gpsBtn.addEventListener('click', () => {
      if (!navigator.geolocation) {
        alert('Seu navegador não suporta geolocalização.')

        return;
      }

      gpsBtn.classList.add('is-loading')

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          gpsBtn.classList.remove('is-loading')
          userCurrentCoords = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          }

          document.getElementById('origin-input').value = 'Minha localização atual (GPS)'
          _showToast('Localização GPS obtida com sucesso!', 'success')
        },
        () => {
          gpsBtn.classList.remove('is-loading')
          alert('Não foi possível obter a sua localização atual via GPS.')
          _showToast('Erro ao obter localização GPS.', 'error')
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

      calcRouteBtn.classList.add('is-loading')

      let originCoords = null
      let destCoords = null

      try {
        if ((originText === '' || originText.includes('GPS')) && userCurrentCoords) {
          originCoords = userCurrentCoords
        } else if (originText !== '') {
          originCoords = await _geocode(originText)
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
          const nearest = eligiblePoints.reduce(
            (best, ponto) => {
              const dist = _calcularDistancia(originCoords.lat, originCoords.lng, ponto.lat, ponto.lng)

              return dist < best.dist ? { ponto, dist } : best
            },
            { ponto: null, dist: Infinity }
          ).ponto

          if (nearest) {
            destCoords = {
              lat: nearest.lat,
              lng: nearest.lng
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
          const routeErr = 'A rota detalhada está indisponível. O mapa mostra apenas a origem e o destino.'

          if (instructionsDiv) instructionsDiv.textContent = routeErr
          if (routeStatus) routeStatus.textContent = routeErr

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
            styles: [{ color: '#0b6b3f', weight: 5, opacity: 0.85 }]
          },
          addWaypoints: false,
          draggableWaypoints: false,
          fitSelectedRoutes: true,
          show: true
        })

        routingControl.on('routesfound', () => {
          if (routeStatus) routeStatus.textContent = 'Rota calculada. As instruções estão disponíveis antes do mapa.'
          _showToast('Rota calculada com sucesso!', 'success')
        })

        routingControl.on('routingerror', () => {
          if (routeStatus) routeStatus.textContent = 'Não foi possível calcular a rota solicitada. Tente outro endereço.'
          _showToast('Não foi possível calcular a rota.', 'error')
        })

        routingControl.addTo(map)

        if (instructionsDiv) {
          instructionsDiv.replaceChildren(routingControl.getContainer())
        }
      } finally {
        calcRouteBtn.classList.remove('is-loading')
      }
    })
  }

  const filterMapBtn = document.getElementById('filter-map-btn')

  if (filterMapBtn) {
    filterMapBtn.addEventListener('click', () => {
      const material = document.getElementById('material-filter').value

      _renderEcopontos(material)
      _showToast(`Filtro aplicado: ${material}`, 'success')
    })
  }
})


/* INFO: UI THEME TOGGLE & ACCORDION & SCROLL INTERACTION */

;(() => {
  const root = document.documentElement
  const themeToggle = document.getElementById('themeToggle')

  if (themeToggle) {
    const updateThemeLabel = () => {
      const current = root.getAttribute('data-theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      const next = current === 'dark' ? 'claro' : 'escuro'

      themeToggle.setAttribute('aria-label', `Mudar para o tema ${next}`)
      themeToggle.setAttribute('title', `Mudar para o tema ${next}`)
    }

    themeToggle.addEventListener('click', () => {
      const current = root.getAttribute('data-theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

      root.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark')
      updateThemeLabel()
    })

    updateThemeLabel()

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (!root.getAttribute('data-theme')) updateThemeLabel()
    })
  }

  /* FAQ Accordion zero-JS-height logic */
  document.querySelectorAll('.faq-trigger').forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const isExpanded = trigger.getAttribute('aria-expanded') === 'true'

      trigger.setAttribute('aria-expanded', String(!isExpanded))
    })

    trigger.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        trigger.click()
      }
    })
  })

  const nav = document.getElementById('siteNav')

  if (nav) {
    const checkScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 8)

    checkScroll()
    window.addEventListener('scroll', checkScroll, { passive: true })
  }

  const navMenu = document.getElementById('menu')

  if (navMenu && menuButton) {
    navMenu.addEventListener('click', (event) => {
      if (event.target.tagName !== 'A') return;

      navMenu.classList.remove('open')
      if (menuOverlay) menuOverlay.classList.remove('is-open')
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
      passwordToggle.setAttribute('aria-pressed', String(!visivel))

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

  const links = [...document.querySelectorAll('.menu a[href^="#"], .edge-nav a[href^="#"]')]
  const sections = [...document.querySelectorAll('section[id], header[id]')]

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

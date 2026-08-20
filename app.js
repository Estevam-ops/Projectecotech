const SERVER_URL = (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null' && !window.location.protocol.startsWith('file')) ? window.location.origin : 'http://127.0.0.1:3000'

const $ = (selector) => document.querySelector(selector)
const menuButton = $('.menu-button')
const menu = $('#menu')
const menuOverlay = $('#menuOverlay')
const authCard = $('#authCard')
const loginForm = $('#loginForm')
const registerForm = $('#registerForm')
const adminArea = $('#adminArea')
const studentArea = $('#studentArea')
const recordForm = $('#recordForm')
const recordsTable = $('#recordsTable')
const studentRecordsTable = $('#studentRecordsTable')

let selectedItemId = null

const _updateDeleteButtonState = () => {
  const btn = $('#deleteSelectedBtn')

  if (!btn) return;

  if (selectedItemId) {
    btn.disabled = false
    btn.style.opacity = '1'
    btn.style.cursor = 'pointer'
  } else {
    btn.disabled = true
    btn.style.opacity = '0.5'
    btn.style.cursor = 'not-allowed'
  }
}

const _setSelectedRow = (itemId) => {
  if (selectedItemId === itemId) {
    selectedItemId = null
  } else {
    selectedItemId = itemId
  }

  if (recordsTable) {
    recordsTable.querySelectorAll('tr.selectable-row').forEach((row) => {
      if (row.getAttribute('data-id') === selectedItemId) {
        row.classList.add('is-selected')
      } else {
        row.classList.remove('is-selected')
      }
    })
  }

  _updateDeleteButtonState()
}
let registeredSchools = [
  { id: 1, name: 'Escola Municipal Uberaba' },
  { id: 2, name: 'Escola Estadual Triângulo' },
  { id: 3, name: 'IFTM Campus Uberaba Parque Tecnológico' },
  { id: 4, name: 'Escola Municipal Marechal Humberto' }
]
let serverDown = false
let authToken = sessionStorage.getItem('authToken') || null
let currentUser = null

try {
  const savedUser = sessionStorage.getItem('currentUser')
  if (savedUser) currentUser = JSON.parse(savedUser)
} catch {
  currentUser = null
}


const _escapeHtml = (value) => {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;')
}

const _truncateText = (str, maxLength = 25) => {
  if (!str) return '-'
  const text = String(str).trim()
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text
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


/* INFO: Centered Fullscreen QR Code Viewer */
const _openFullscreenQr = (item) => {
  let overlay = $('#fullscreenQrOverlay')

  if (!overlay) {
    overlay = document.createElement('div')
    overlay.id = 'fullscreenQrOverlay'
    overlay.className = 'fullscreen-qr-overlay hidden'
    overlay.setAttribute('role', 'dialog')
    overlay.setAttribute('aria-modal', 'true')
    overlay.setAttribute('aria-label', 'Visualização de QR Code em tela cheia')
    overlay.innerHTML = `
      <div class="fullscreen-qr-card">
        <button class="fullscreen-qr-close" id="closeFullscreenQr" type="button" aria-label="Fechar visualização">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <span class="section-label">Registro EcoTech</span>
        <div class="fullscreen-qr-code" id="fullscreenQrCode"></div>
        <div class="fullscreen-qr-id" id="fullscreenQrId"></div>
        <p class="fullscreen-qr-meta" id="fullscreenQrMeta"></p>
        <span class="fullscreen-qr-hint">Clique em qualquer lugar para fechar</span>
      </div>`

    document.body.appendChild(overlay)

    const _close = () => {
      overlay.classList.remove('is-open')
      setTimeout(() => overlay.classList.add('hidden'), 200)
    }

    overlay.addEventListener('click', _close)

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !overlay.classList.contains('hidden')) {
        _close()
      }
    })
  }

  const codeContainer = $('#fullscreenQrCode')
  const idEl = $('#fullscreenQrId')
  const metaEl = $('#fullscreenQrMeta')

  if (idEl) idEl.textContent = item.id
  if (metaEl) metaEl.textContent = `${item.device} ${item.school ? '• ' + item.school : ''}`

  _addQr(codeContainer, item.id, 260)

  overlay.classList.remove('hidden')
  requestAnimationFrame(() => overlay.classList.add('is-open'))
}


/* INFO: Server-side school deletion with product dependency check */
const _deleteSchool = async (schoolObj) => {
  const name = typeof schoolObj === 'string' ? schoolObj : schoolObj.name
  const id = typeof schoolObj === 'object' ? schoolObj.id : null

  if (!confirm(`Deseja realmente remover a escola "${name}"?`)) {
    return;
  }

  try {
    const url = id ? `${SERVER_URL}/schools/${id}` : `${SERVER_URL}/schools/delete`
    const res = await globalThis.fetch(url, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name })
    })

    const data = await res.json().catch(() => ({}))

    if (res.ok) {
      _showToast(data.message || `Escola "${name}" excluída com sucesso!`, 'success')
      await _fetchSchools()

      return;
    }

    _showToast(data.error || 'Erro ao excluir escola.', 'error')
  } catch (err) {
    console.warn('Failed to delete school:', err)

    /* Local fallback check if server offline */
    const isLinkedLocally = records.some((r) => r.school.toLowerCase() === name.toLowerCase())

    if (isLinkedLocally) {
      _showToast(`Não é possível excluir a escola "${name}" pois existem dispositivos vinculados a ela.`, 'error')

      return;
    }

    registeredSchools = registeredSchools.filter((s) => (typeof s === 'string' ? s : s.name).toLowerCase() !== name.toLowerCase())
    _renderSchoolsUI()
    _showToast(`Escola "${name}" removida localmente.`, 'warning')
  }
}


/* INFO: Fetch and render registered schools list & autocomplete datalist */
const _renderSchoolsUI = () => {
  const datalist = $('#schoolOptions')

  if (datalist) {
    datalist.innerHTML = ''
    registeredSchools.forEach((s) => {
      const name = typeof s === 'string' ? s : s.name
      const option = document.createElement('option')

      option.value = name
      datalist.appendChild(option)
    })
  }

  const schoolsList = $('#schoolsList')

  if (schoolsList) {
    schoolsList.innerHTML = ''

    if (!registeredSchools.length) {
      schoolsList.innerHTML = '<span style="font-size: var(--text-xs); color: var(--text-muted);">Nenhuma escola cadastrada.</span>'
      return;
    }

    registeredSchools.forEach((s) => {
      const name = typeof s === 'string' ? s : s.name
      const item = document.createElement('div')

      item.style.display = 'flex'
      item.style.alignItems = 'center'
      item.style.justifyContent = 'space-between'
      item.style.gap = '8px'
      item.style.padding = '6px 10px'
      item.style.background = 'var(--bg-primary)'
      item.style.border = '1px solid var(--border)'
      item.style.borderRadius = '8px'
      item.style.fontSize = 'var(--text-xs)'

      const textSpan = document.createElement('span')

      textSpan.style.fontWeight = '600'
      textSpan.style.color = 'var(--text-primary)'
      textSpan.style.overflow = 'hidden'
      textSpan.style.textOverflow = 'ellipsis'
      textSpan.style.whiteSpace = 'nowrap'
      textSpan.textContent = name

      const delBtn = document.createElement('button')

      delBtn.type = 'button'
      delBtn.className = 'button danger'
      delBtn.style.minHeight = '26px'
      delBtn.style.padding = '2px 8px'
      delBtn.style.fontSize = '0.7rem'
      delBtn.textContent = 'Excluir'
      delBtn.addEventListener('click', () => _deleteSchool(s))

      item.appendChild(textSpan)
      item.appendChild(delBtn)
      schoolsList.appendChild(item)
    })
  }
}

const _fetchSchools = async () => {
  try {
    const res = await globalThis.fetch(`${SERVER_URL}/schools`)

    if (res.ok) {
      const data = await res.json()

      if (Array.isArray(data.schools) && data.schools.length > 0) {
        registeredSchools = data.schools
      }
    }
  } catch (err) {
    console.warn('Could not fetch schools from server:', err)
  }

  _renderSchoolsUI()
}


/* INFO: Single-pass stats calculator for total weight and school/student rankings */
const _calcStats = () => {
  const totals = { school: new Map(), student: new Map() }
  let totalWeight = 0

  records.forEach((item) => {
    const weight = Number(item.weight || 0)

    totalWeight += weight

    ;['school', 'student'].forEach((field) => {
      const val = item[field]

      if (val) totals[field].set(val, (totals[field].get(val) || 0) + weight)
    })
  })

  return {
    totalWeight,
    school: [...totals.school.entries()].sort((a, b) => b[1] - a[1]),
    student: [...totals.student.entries()].sort((a, b) => b[1] - a[1])
  }
}


const _addQr = (target, text, size) => {
  if (!target) return;

  target.innerHTML = ''

  if (window.QRCode) {
    new QRCode(target, { text, width: size, height: size, correctLevel: QRCode.CorrectLevel.M })

    /* INFO: QRCode.js generates canvas + img. Retain only img to avoid duplicate QR display */
    const canvas = target.querySelector('canvas')
    const img = target.querySelector('img')

    if (canvas && img) {
      canvas.remove()
    } else if (canvas) {
      canvas.style.display = 'block'
      canvas.style.margin = '0 auto'
    }
  } else {
    target.textContent = text
  }
}


const _demoRecords = () => []


const _getStatusClass = (status = '') => {
  const lower = status.toLowerCase()

  if (lower.includes('coletado')) return 'status-coletado'
  if (lower.includes('escola')) return 'status-na-escola'
  if (lower.includes('iftm')) return 'status-no-iftm'

  return 'status-pendente'
}


/* INFO: Render student portal table and metrics for logged-in student */
const _renderStudentPortal = () => {
  if (!studentArea) return;

  const username = (currentUser && (currentUser.full_name || currentUser.username || currentUser.email)) || 'Aluno'
  const school = (currentUser && currentUser.school) || 'Escola Municipal Uberaba'

  if ($('#studentWelcome')) $('#studentWelcome').textContent = `Bem-vindo(a), ${username}!`
  if ($('#studentSub')) $('#studentSub').textContent = `Escola parceira: ${school}`

  /* Filter items matching student's username or email */
  const myItems = records.filter((item) => {
    const owner = (item.student || '').toLowerCase()
    const target = username.toLowerCase()

    return owner === target || target.includes(owner) || owner.includes(target)
  })

  const displayList = myItems
  const totalWeight = displayList.reduce((acc, curr) => acc + Number(curr.weight || 0), 0)

  if ($('#studentDeviceCount')) $('#studentDeviceCount').textContent = displayList.length
  if ($('#studentTotalWeight')) $('#studentTotalWeight').textContent = `${totalWeight.toFixed(2)} kg`

  /* Dynamic ring progress indicators */
  const fill1 = $('#studentRingFill1')
  const val1 = $('#studentRingValue1')
  const fill2 = $('#studentRingFill2')
  const val2 = $('#studentRingValue2')

  const countPct = Math.min(100, Math.round((displayList.length / 5) * 100))
  const weightPct = Math.min(100, Math.round((totalWeight / 10) * 100))

  if (fill1) fill1.setAttribute('stroke-dasharray', `${countPct}, 100`)
  if (val1) val1.textContent = `${countPct}%`
  if (fill2) fill2.setAttribute('stroke-dasharray', `${weightPct}, 100`)
  if (val2) val2.textContent = `${totalWeight.toFixed(2)}kg`

  /* Dynamic milestone badge unlock logic based on actual student contribution */
  const badgeBronze = $('#badgeBronze')
  const badgePrata = $('#badgePrata')
  const badgeOuro = $('#badgeOuro')
  const badgeEsmeralda = $('#badgeEsmeralda')

  if (badgeBronze) badgeBronze.className = `badge-card ${totalWeight >= 1.0 ? 'is-unlocked' : 'is-locked'}`
  if (badgePrata) badgePrata.className = `badge-card ${totalWeight >= 2.5 ? 'is-unlocked' : 'is-locked'}`
  if (badgeOuro) badgeOuro.className = `badge-card ${totalWeight >= 10.0 ? 'is-unlocked' : 'is-locked'}`
  if (badgeEsmeralda) badgeEsmeralda.className = `badge-card ${totalWeight >= 25.0 ? 'is-unlocked' : 'is-locked'}`

  if (!studentRecordsTable) return;

  studentRecordsTable.innerHTML = ''

  if (!displayList.length) {
    studentRecordsTable.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-secondary);">Nenhum aparelho cadastrado no momento.</td></tr>`

    return;
  }

  displayList.forEach((item) => {
    const tr = document.createElement('tr')
    const statusClass = _getStatusClass(item.status)

    tr.innerHTML = `
      <td data-label="Aparelho">${_escapeHtml(item.device)}</td>
      <td data-label="Peso"><strong>${Number(item.weight).toFixed(2)} kg</strong></td>
      <td data-label="Status"><span class="status-badge ${statusClass}">${_escapeHtml(item.status)}</span></td>
      <td data-label="QR" class="qr-cell" role="button" tabindex="0" title="Clique para visualizar QR Code em tela cheia" style="text-align: center; vertical-align: middle;"></td>`

    studentRecordsTable.appendChild(tr)
    const qrCell = tr.querySelector('.qr-cell')

    _addQr(qrCell, item.id, 48)

    if (qrCell) {
      qrCell.addEventListener('click', () => _openFullscreenQr(item))
      qrCell.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          _openFullscreenQr(item)
        }
      })
    }
  })
}


/* INFO: Render dynamic device type datalist options */
const _renderDeviceOptions = () => {
  const datalist = $('#deviceOptions')

  if (!datalist) return;

  const recordTypes = Array.from(new Set(records.map((r) => r.device).filter(Boolean)))

  datalist.innerHTML = ''
  recordTypes.forEach((type) => {
    const opt = document.createElement('option')

    opt.value = type
    datalist.appendChild(opt)
  })
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

    if (recordsTable) recordsTable.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--danger); font-weight: 600; padding: 1.5rem;">Servidor offline. Não foi possível conectar ao backend.</td></tr>`

    return;
  }

  const stats = _calcStats()

  if (metricEls.totalItems) metricEls.totalItems.textContent = records.length
  if (metricEls.totalWeight) metricEls.totalWeight.textContent = `${stats.totalWeight.toFixed(2)} kg`

  if (metricEls.topSchool) {
    if (stats.school[0]) {
      const schoolName = stats.school[0][0]
      const weightStr = `(${stats.school[0][1].toFixed(2)} kg)`
      metricEls.topSchool.innerHTML = `<span class="metric-title-text">${_escapeHtml(schoolName)}</span> <span class="metric-weight-text">${weightStr}</span>`
      metricEls.topSchool.title = schoolName
    } else {
      metricEls.topSchool.textContent = '-'
      metricEls.topSchool.removeAttribute('title')
    }
  }

  if (metricEls.topStudent) {
    if (stats.student[0]) {
      const studentName = stats.student[0][0]
      const weightStr = `(${stats.student[0][1].toFixed(2)} kg)`
      metricEls.topStudent.innerHTML = `<span class="metric-title-text">${_escapeHtml(studentName)}</span> <span class="metric-weight-text">${weightStr}</span>`
      metricEls.topStudent.title = studentName
    } else {
      metricEls.topStudent.textContent = '-'
      metricEls.topStudent.removeAttribute('title')
    }
  }

  const rankTargets = [
    { target: $('#schoolRanking'), rows: stats.school },
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

  if (recordsTable) recordsTable.innerHTML = ''

  if (recordsTable && !records.length) {
    recordsTable.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-secondary);">Nenhum aparelho cadastrado no momento. Use o formulário acima para registrar o primeiro item.</td></tr>`
  } else if (recordsTable) {
    records.forEach((item) => {
      const tr = document.createElement('tr')
      const statusClass = _getStatusClass(item.status)
      const isSelected = item.id === selectedItemId

      tr.className = `selectable-row ${isSelected ? 'is-selected' : ''}`
      tr.setAttribute('data-id', item.id)

      tr.innerHTML = `
        <td data-label="ID"><strong>${_escapeHtml(item.id)}</strong></td>
        <td data-label="Aparelho">${_escapeHtml(item.device)}</td>
        <td data-label="Peso"><strong>${Number(item.weight).toFixed(2)} kg</strong></td>
        <td data-label="Escola">${_escapeHtml(item.school)}</td>
        <td data-label="Aluno">${_escapeHtml(item.student)}</td>
        <td data-label="Status"><span class="status-badge ${statusClass}">${_escapeHtml(item.status)}</span></td>
        <td data-label="QR" class="qr-cell" role="button" tabindex="0" title="Clique para visualizar QR Code em tela cheia" style="text-align: center; vertical-align: middle;"></td>`

      recordsTable.appendChild(tr)
      const qrCell = tr.querySelector('.qr-cell')

      _addQr(qrCell, item.id, 48)

      if (qrCell) {
        qrCell.addEventListener('click', (e) => {
          e.stopPropagation()
          _openFullscreenQr(item)
        })
        qrCell.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            e.stopPropagation()
            _openFullscreenQr(item)
          }
        })
      }
    })

    if (!recordsTable._hasSelectListener) {
      recordsTable._hasSelectListener = true
      recordsTable.addEventListener('click', (e) => {
        const tr = e.target.closest('tr.selectable-row')

        if (tr && !e.target.closest('.qr-cell')) {
          const itemId = tr.getAttribute('data-id')

          _setSelectedRow(itemId)
        }
      })
    }
  }

  _renderStudentPortal()
  _renderDeviceOptions()
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
          student: item.owner_name || item.ownerName || item.full_name || item.owner || '',
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
  if (!menu) return;

  const isOpen = open !== undefined ? open : menu.classList.toggle('open')

  if (isOpen) {
    menu.classList.add('open')
    if (menuOverlay) menuOverlay.classList.add('is-open')
    if (menuButton) menuButton.setAttribute('aria-expanded', 'true')
  } else {
    menu.classList.remove('open')
    if (menuOverlay) menuOverlay.classList.remove('is-open')
    if (menuButton) menuButton.setAttribute('aria-expanded', 'false')
  }
}

if (menuButton) {
  menuButton.addEventListener('click', () => _toggleMenu())
}

if (menuOverlay) {
  menuOverlay.addEventListener('click', () => _toggleMenu(false))
}


/* INFO: Auth Tab Sliding Pill Indicator & Switcher */

const _updateAuthTabIndicator = () => {
  const indicator = $('#authTabIndicator')
  const activeTab = $('.auth-tab.is-active')

  if (!indicator || !activeTab) return;

  indicator.style.transform = `translateX(${activeTab.offsetLeft}px)`
  indicator.style.width = `${activeTab.offsetWidth}px`
}

const _switchAuthMode = (mode) => {
  const tabLogin = $('#tabLogin')
  const tabRegister = $('#tabRegister')

  if (mode === 'register') {
    if (tabLogin) tabLogin.classList.remove('is-active')
    if (tabRegister) tabRegister.classList.add('is-active')
    if (loginForm) loginForm.classList.add('hidden')
    if (registerForm) registerForm.classList.remove('hidden')
  } else {
    if (tabRegister) tabRegister.classList.remove('is-active')
    if (tabLogin) tabLogin.classList.add('is-active')
    if (registerForm) registerForm.classList.add('hidden')
    if (loginForm) loginForm.classList.remove('hidden')
  }

  _updateAuthTabIndicator()
}

if ($('#tabLogin')) $('#tabLogin').addEventListener('click', () => _switchAuthMode('login'))
if ($('#tabRegister')) $('#tabRegister').addEventListener('click', () => _switchAuthMode('register'))
if ($('#switchToRegister')) $('#switchToRegister').addEventListener('click', () => _switchAuthMode('register'))
if ($('#switchToLogin')) $('#switchToLogin').addEventListener('click', () => _switchAuthMode('login'))

window.addEventListener('resize', _updateAuthTabIndicator, { passive: true })
document.addEventListener('DOMContentLoaded', () => {
  _updateAuthTabIndicator()
  _fetchSchools()
})


/* INFO: School Registration Handler (Admin) */

const schoolForm = $('#schoolForm')

if (schoolForm) {
  schoolForm.addEventListener('submit', async (event) => {
    event.preventDefault()

    const nameInput = $('#newSchoolName')
    const schoolName = nameInput ? nameInput.value.trim() : ''

    if (!schoolName) return;

    const exists = registeredSchools.some((s) => (typeof s === 'string' ? s : s.name).toLowerCase() === schoolName.toLowerCase())

    if (exists) {
      _showToast('Esta escola já está cadastrada.', 'error')

      return;
    }

    try {
      const res = await globalThis.fetch(`${SERVER_URL}/schools`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: schoolName, city: 'Uberaba' })
      })

      if (res.ok) {
        _showToast('Escola cadastrada com sucesso!', 'success')
        if (nameInput) nameInput.value = ''
        await _fetchSchools()

        return;
      }

      const errData = await res.json().catch(() => ({}))
      _showToast(errData.error || 'Erro ao cadastrar escola.', 'error')
    } catch (err) {
      console.warn('Failed to post new school:', err)

      registeredSchools.push({ id: Date.now(), name: schoolName })
      _renderSchoolsUI()
      if (nameInput) nameInput.value = ''
      _showToast('Escola adicionada localmente!', 'warning')
    }
  })
}


/* INFO: Student Registration Form Submission */

if (registerForm) {
  registerForm.addEventListener('submit', async (event) => {
    event.preventDefault()

    const submitBtn = registerForm.querySelector('button[type="submit"]')
    const fullNameInput = $('#regFullName')
    const emailInput = $('#regEmail')
    const schoolInput = $('#regSchool')
    const gradeInput = $('#regGrade')
    const passwordInput = $('#regPassword')

    const fullName = fullNameInput ? fullNameInput.value.trim() : ''
    const email = emailInput ? emailInput.value.trim() : ''
    const school = schoolInput ? schoolInput.value.trim() : ''
    const grade = gradeInput ? gradeInput.value.trim() : ''
    const password = passwordInput ? passwordInput.value : ''

    if (!fullName) {
      if (fullNameInput) {
        fullNameInput.classList.add('is-invalid')
        fullNameInput.setCustomValidity('Nome completo é obrigatório.')
        fullNameInput.reportValidity()
        fullNameInput.addEventListener('input', () => {
          fullNameInput.classList.remove('is-invalid')
          fullNameInput.setCustomValidity('')
        }, { once: true })
      }

      _showToast('Informe seu nome completo para se cadastrar.', 'error')

      return;
    }

    /* INFO: Strict Validation - Student registration school must match a registered school */
    const isSchoolValid = registeredSchools.some((s) => (typeof s === 'string' ? s : s.name).toLowerCase() === school.toLowerCase())

    if (!isSchoolValid) {
      if (schoolInput) {
        schoolInput.classList.add('is-invalid')
        schoolInput.setCustomValidity('Escola não cadastrada. Selecione uma escola válida.')
        schoolInput.reportValidity()
        schoolInput.addEventListener('input', () => {
          schoolInput.classList.remove('is-invalid')
          schoolInput.setCustomValidity('')
        }, { once: true })
      }

      _showToast('A escola informada não está cadastrada no sistema. Selecione uma escola autorizada.', 'error')

      return;
    }

    if (submitBtn) submitBtn.classList.add('is-loading')

    try {
      const res = await globalThis.fetch(`${SERVER_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          fullName,
          username: email,
          email,
          school,
          grade,
          password,
          role: 'user'
        })
      })

      if (res.ok) {
        _showToast('Conta criada com sucesso! Faça login para continuar.', 'success')
        registerForm.reset()
        _switchAuthMode('login')
        if ($('#email')) $('#email').value = email

        return;
      }

      const errData = await res.json().catch(() => ({}))
      const errorMsg = errData.error || 'Erro ao registrar conta.'

      if ($('#registerMessage')) $('#registerMessage').textContent = errorMsg
      _showToast(errorMsg, 'error')
    } catch (err) {
      console.error('Registration failed:', err)

      if ($('#registerMessage')) $('#registerMessage').textContent = 'Servidor offline. Tente novamente mais tarde.'
      _showToast('Servidor offline. Não foi possível conectar.', 'error')
    } finally {
      if (submitBtn) submitBtn.classList.remove('is-loading')
    }
  })
}


/* INFO: Login Form Submission */

if (loginForm) {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault()

    const submitBtn = loginForm.querySelector('button[type="submit"]')
    const emailInput = $('#email')
    const email = emailInput ? emailInput.value.trim() : ''
    const passwordInput = $('#password')
    const password = passwordInput ? passwordInput.value : ''

    if (emailInput && passwordInput) {
      [emailInput, passwordInput].forEach((input) => input.classList.remove('is-invalid'))
    }

    if (!email && emailInput) {
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
          sessionStorage.setItem('authToken', data.token)
        }

        currentUser = data.user || { username: email, full_name: email, admin: false }
        sessionStorage.setItem('currentUser', JSON.stringify(currentUser))

        const displayName = currentUser.full_name || currentUser.username

        if (currentUser.admin || currentUser.role === 'admin') {
          _showToast(`Bem-vindo(a) Administrador(a), ${displayName}!`, 'success')
          window.location.href = 'admin.html'
        } else {
          _showToast(`Bem-vindo(a), ${displayName}!`, 'success')
          window.location.href = 'user.html'
        }

        return;
      }

      const errData = await res.json().catch(() => ({}))
      const errorMsg = errData.error || 'Credenciais inválidas.'

      if ($('#loginMessage')) $('#loginMessage').textContent = errorMsg
      _showToast(errorMsg, 'error')
    } catch (err) {
      console.error('Login request failed:', err)

      if ($('#loginMessage')) $('#loginMessage').textContent = 'Servidor offline. Não foi possível conectar.'
      _showToast('Servidor offline. Não foi possível conectar.', 'error')
    } finally {
      if (submitBtn) submitBtn.classList.remove('is-loading')
    }
  })
}


const _logout = () => {
  authToken = null
  currentUser = null
  sessionStorage.removeItem('authToken')
  sessionStorage.removeItem('currentUser')

  _showToast('Sessão encerrada com sucesso.', 'success')
  window.location.href = 'session.html'
}

if ($('#logoutButton')) $('#logoutButton').addEventListener('click', _logout)
if ($('#logoutButtonNav')) $('#logoutButtonNav').addEventListener('click', _logout)
if ($('#studentLogoutButton')) $('#studentLogoutButton').addEventListener('click', _logout)
if ($('#studentLogoutButtonNav')) $('#studentLogoutButtonNav').addEventListener('click', _logout)


/* INFO: Admin Device Registration Form */

if (recordForm) {
  recordForm.addEventListener('submit', async (event) => {
    event.preventDefault()

    const submitBtn = recordForm.querySelector('button[type="submit"]')
    const textInputs = [$('#device'), $('#school'), $('#student')].filter(Boolean)
    const weightInput = $('#weight')
    const schoolInput = $('#school')
    const studentInput = $('#student')

    textInputs.concat(weightInput).forEach((input) => {
      if (input) {
        input.classList.remove('is-invalid')
        input.setCustomValidity('')
      }
    })

    const blankInput = textInputs.find((input) => !input.value.trim())

    if (blankInput) {
      blankInput.classList.add('is-invalid')
      blankInput.setCustomValidity('Preencha este campo com um texto válido.')
      blankInput.reportValidity()
      blankInput.addEventListener('input', () => blankInput.classList.remove('is-invalid'), { once: true })

      return;
    }

    /* INFO: Strict validation 1 - School must match a registered school */
    const enteredSchool = schoolInput ? schoolInput.value.trim() : ''
    const isSchoolValid = registeredSchools.some((s) => (typeof s === 'string' ? s : s.name).toLowerCase() === enteredSchool.toLowerCase())

    if (!isSchoolValid) {
      if (schoolInput) {
        schoolInput.classList.add('is-invalid')
        schoolInput.setCustomValidity('Escola não cadastrada. Selecione ou cadastre uma escola válida.')
        schoolInput.reportValidity()
        schoolInput.addEventListener('input', () => {
          schoolInput.classList.remove('is-invalid')
          schoolInput.setCustomValidity('')
        }, { once: true })
      }

      _showToast('A escola informada não está cadastrada. Cadastre a escola primeiro ou selecione uma existente.', 'error')

      return;
    }

    /* INFO: Strict validation 2 - Student email/username must exist in registered user accounts */
    const enteredStudent = studentInput ? studentInput.value.trim() : ''

    if (enteredStudent) {
      try {
        const userCheckRes = await globalThis.fetch(`${SERVER_URL}/users/check?username=${encodeURIComponent(enteredStudent)}`)

        if (!userCheckRes.ok) {
          if (studentInput) {
            studentInput.classList.add('is-invalid')
            studentInput.setCustomValidity('Aluno/e-mail não possui cadastro no sistema.')
            studentInput.reportValidity()
            studentInput.addEventListener('input', () => {
              studentInput.classList.remove('is-invalid')
              studentInput.setCustomValidity('')
            }, { once: true })
          }

          _showToast(`Nenhum aluno cadastrado com o e-mail/usuário "${enteredStudent}". O aluno precisa ter uma conta criada no sistema.`, 'error')

          return;
        }
      } catch (err) {
        console.warn('Could not verify student user account:', err)
      }
    }

    const weight = Number(weightInput ? weightInput.value : 0)

    if (!Number.isFinite(weight) || weight <= 0) {
      if (weightInput) {
        weightInput.classList.add('is-invalid')
        weightInput.setCustomValidity('Informe um peso maior que zero.')
        weightInput.reportValidity()
        weightInput.addEventListener('input', () => weightInput.classList.remove('is-invalid'), { once: true })
      }

      return;
    }

    /* Standardize school name casing to registered version */
    const matchedSchoolObj = registeredSchools.find((s) => (typeof s === 'string' ? s : s.name).toLowerCase() === enteredSchool.toLowerCase())
    const finalSchoolName = matchedSchoolObj ? (typeof matchedSchoolObj === 'string' ? matchedSchoolObj : matchedSchoolObj.name) : enteredSchool

    const record = {
      id: _createId(),
      device: $('#device').value.trim(),
      weight,
      school: finalSchoolName,
      student: $('#student').value.trim(),
      status: $('#status') ? $('#status').value : 'Na escola',
      createdAt: new Date().toISOString()
    }

    if (submitBtn) submitBtn.classList.add('is-loading')

    try {
      const headers = { 'Content-Type': 'application/json' }

      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`
      }

      const res = await globalThis.fetch(`${SERVER_URL}/items`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          uuid: record.id,
          name: record.device,
          owner: record.student,
          weight: record.weight,
          state: record.status,
          school: record.school
        })
      })

      if (res.ok) {
        await _fetchRecords()
        recordForm.reset()
        _showToast('Dispositivo registrado com sucesso no banco de dados!', 'success')

        return;
      }

      const errData = await res.json().catch(() => ({}))
      _showToast(errData.error || 'Erro ao registrar dispositivo.', 'error')
    } catch (err) {
      console.warn('Could not post record to server:', err)

      records.unshift(record)
      _render()
      recordForm.reset()
      _showToast('Servidor offline. Dispositivo registrado localmente!', 'warning')
    } finally {
      if (submitBtn) submitBtn.classList.remove('is-loading')
    }
  })
}


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
  { key: 'id', label: 'ID', width: 44 },
  { key: 'device', label: 'Aparelho', width: 28 },
  { key: 'weight', label: 'Peso', width: 18, align: 'right' },
  { key: 'school', label: 'Escola', width: 36 },
  { key: 'student', label: 'Aluno', width: 28 },
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
      { title: 'Alunos', rows: stats.student.slice(0, 5) }
    ]
    const colW = (contentW - 6) / 2
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

        doc.text(_clip(value, col.width - 4), right ? x + col.width - 2.5 : x + 2.5, y + 4.4, {
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


if ($('#printLabels')) $('#printLabels').addEventListener('click', () => window.print())
if ($('#deleteSelectedBtn')) {
  $('#deleteSelectedBtn').addEventListener('click', async () => {
    if (!selectedItemId) return;

    const item = records.find((r) => r.id === selectedItemId)
    const label = item ? `"${item.device}" (${item.id})` : `ID ${selectedItemId}`

    if (!confirm(`Tem certeza que deseja excluir o dispositivo ${label}?`)) {
      return;
    }

    try {
      const token = sessionStorage.getItem('authToken')
      const res = await globalThis.fetch(`${SERVER_URL}/items/${encodeURIComponent(selectedItemId)}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      })

      let data = {}

      try {
        data = await res.json()
      } catch {
        data = {}
      }

      if (!res.ok) {
        /* Fallback endpoint attempt: POST /items/delete */
        const fallbackRes = await globalThis.fetch(`${SERVER_URL}/items/delete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ id: selectedItemId })
        })

        const fallbackData = await fallbackRes.json().catch(() => ({}))

        if (!fallbackRes.ok) {
          /* Local deletion fallback if server endpoint is offline or 404 */
          records = records.filter((r) => r.id !== selectedItemId)
          selectedItemId = null
          _updateDeleteButtonState()
          _render()
          _showToast(`Dispositivo ${label} removido.`, 'success')

          return;
        }

        _showToast(fallbackData.message || `Aparelho ${label} excluído com sucesso!`, 'success')
      } else {
        _showToast(data.message || `Aparelho ${label} excluído com sucesso!`, 'success')
      }

      selectedItemId = null
      _updateDeleteButtonState()
      await _fetchRecords()
    } catch (err) {
      console.warn('Error deleting item on server, removing locally:', err)
      records = records.filter((r) => r.id !== selectedItemId)
      selectedItemId = null
      _updateDeleteButtonState()
      _render()
      _showToast(`Dispositivo ${label} removido localmente.`, 'warning')
    }
  })
}

if ($('#btnStudentDevices')) {
  $('#btnStudentDevices').addEventListener('click', () => {
    const table = $('#studentRecordsTable')

    if (table) table.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}

if ($('#btnStudentMilestones')) {
  $('#btnStudentMilestones').addEventListener('click', () => {
    const milestones = $('.milestone-grid')

    if (milestones) milestones.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}

_fetchSchools()
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

        routingControl.on('routesfound', (e) => {
          const routes = e.routes
          if (routes && routes.length > 0 && instructionsDiv) {
            const summary = routes[0].summary
            const distKm = (summary.totalDistance / 1000).toFixed(1)
            const timeMin = Math.round(summary.totalTime / 60)

            instructionsDiv.innerHTML = `
              <div class="route-summary-card">
                <div class="route-summary-title">📍 Rota Calculada com Sucesso</div>
                <div class="route-summary-stats">
                  <span><strong>Distância:</strong> ${distKm} km</span>
                  <span><strong>Tempo est.:</strong> ~${timeMin} min</span>
                </div>
              </div>`
          }

          if (routeStatus) routeStatus.textContent = 'Rota calculada com sucesso.'
          _showToast('Rota calculada com sucesso!', 'success')
        })

        routingControl.on('routingerror', () => {
          if (routeStatus) routeStatus.textContent = 'Não foi possível calcular a rota solicitada. Tente outro endereço.'
          _showToast('Não foi possível calcular a rota.', 'error')
        })

        routingControl.addTo(map)
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


/* INFO: UI THEME TOGGLE, ACCORDION, SCROLL INTERACTION & APPLE HIG MOTION OBSERVERS */

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

  /* Password Toggle Handlers */
  const setupPasswordToggle = (toggleId, inputId) => {
    const toggle = document.getElementById(toggleId)
    const input = document.getElementById(inputId)

    if (toggle && input) {
      toggle.addEventListener('click', () => {
        const visivel = input.type === 'text'

        input.type = visivel ? 'password' : 'text'
        toggle.classList.toggle('is-visible', !visivel)
        toggle.setAttribute('aria-pressed', String(!visivel))

        const rotulo = visivel ? 'Mostrar senha' : 'Ocultar senha'

        toggle.setAttribute('aria-label', rotulo)
        toggle.setAttribute('title', rotulo)
      })
    }
  }

  setupPasswordToggle('passwordToggle', 'password')
  setupPasswordToggle('regPasswordToggle', 'regPassword')

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

  /* Throttled scroll header glassmorphism */
  const nav = document.getElementById('siteNav')

  if (nav) {
    let ticking = false

    const checkScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          nav.classList.toggle('is-scrolled', window.scrollY > 12)
          ticking = false
        })
        ticking = true
      }
    }

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

  /* Staggered scroll reveal using IntersectionObserver */
  const revelaveis = [...document.querySelectorAll('[data-reveal]')]
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (reducedMotion || !('IntersectionObserver' in window)) {
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
      { rootMargin: '0px 0px -40px 0px', threshold: 0.12 }
    )

    revelaveis.forEach((el) => revelador.observe(el))
  }

  /* SVG Metric Ring entrance observer */
  const rings = document.querySelectorAll('.metric-ring')

  if (rings.length && 'IntersectionObserver' in window) {
    const ringObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          entry.target.classList.add('is-visible')
          ringObserver.unobserve(entry.target)
        })
      },
      { threshold: 0.4 }
    )

    rings.forEach((ring) => ringObserver.observe(ring))
  }

  /* Edge Navigation Dots observer for main page */
  const sections = [...document.querySelectorAll('section[id], header[id]')]
  const edgeDots = [...document.querySelectorAll('.edge-nav a')]

  if (sections.length && edgeDots.length && 'IntersectionObserver' in window) {
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          const id = entry.target.getAttribute('id')

          edgeDots.forEach((dot) => {
            dot.classList.toggle('is-active', dot.getAttribute('href') === `#${id}`)
          })
        })
      },
      { threshold: 0.4 }
    )

    sections.forEach((section) => sectionObserver.observe(section))
  }

  /* Dynamic prefers-reduced-motion listener */
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  const handleMotionChange = (e) => {
    document.documentElement.classList.toggle('reduced-motion', e.matches)
  }

  handleMotionChange(motionQuery)
  motionQuery.addEventListener('change', handleMotionChange)
})()

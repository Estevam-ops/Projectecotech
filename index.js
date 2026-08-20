import http from 'node:http'
import crypto from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import process from 'node:process'
import { URL } from 'node:url'

/* INFO: Server configuration constants. */
const PORT = process.env.PORT || 3000
const HASH_ITERATIONS = 100000
const KEY_LEN = 64
const DIGEST = 'sha512'

/* INFO: Initialize SQLite database and required tables. */
const db = new DatabaseSync('db.sqlite')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    admin INTEGER NOT NULL DEFAULT 0,
    school TEXT NOT NULL DEFAULT '',
    grade TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS items (
    uuid TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner TEXT NOT NULL DEFAULT '',
    weight REAL NOT NULL DEFAULT 0,
    state TEXT NOT NULL DEFAULT '',
    school TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS schools (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    city TEXT NOT NULL DEFAULT 'Uberaba',
    created_at TEXT NOT NULL
  );
`)

try {
  db.exec(`ALTER TABLE users ADD COLUMN full_name TEXT NOT NULL DEFAULT '';`)
} catch {
  /* INFO: Column already exists. */
}

try {
  db.exec(`ALTER TABLE users ADD COLUMN school TEXT NOT NULL DEFAULT '';`)
} catch {
  /* INFO: Column already exists. */
}

try {
  db.exec(`ALTER TABLE users ADD COLUMN grade TEXT NOT NULL DEFAULT '';`)
} catch {
  /* INFO: Column already exists. */
}

/* INFO: Seed default schools if none exist */
const schoolCount = db.prepare('SELECT COUNT(*) as count FROM schools').get()
if (schoolCount && schoolCount.count === 0) {
  const seedSchools = [
    'Escola Municipal Uberaba',
    'Escola Estadual Triângulo',
    'IFTM Campus Uberaba Parque Tecnológico',
    'Escola Municipal Marechal Humberto'
  ]
  const now = new Date().toISOString()
  const insertStmt = db.prepare('INSERT INTO schools (name, city, created_at) VALUES (?, ?, ?)')
  seedSchools.forEach((schoolName) => insertStmt.run(schoolName, 'Uberaba', now))
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
}

const _sendJson = (res, statusCode, data) => {
  res.writeHead(statusCode, { ...CORS_HEADERS, 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

const _parseJsonBody = (req) => {
  return new Promise((resolve) => {
    let body = ''

    req.on('data', (chunk) => {
      body += chunk
    })

    req.on('end', () => {
      if (!body) {
        resolve({})
        return;
      }

      try {
        const parsed = JSON.parse(body)
        resolve(parsed)
      } catch {
        resolve(null)
      }
    })
  })
}

const _hashPassword = (password, salt) => {
  return crypto.pbkdf2Sync(password, salt, HASH_ITERATIONS, KEY_LEN, DIGEST).toString('hex')
}

const _getUserFromReq = (req) => {
  const authHeader = req.headers.authorization
  if (!authHeader) return null

  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null

  const token = parts[1]
  const stmt = db.prepare('SELECT users.id, users.username, users.full_name, users.role, users.admin, users.school, users.grade FROM sessions JOIN users ON sessions.user_id = users.id WHERE sessions.token = ?')
  const user = stmt.get(token)

  return user || null
}

const _handleRegister = async (req, res) => {
  const body = await _parseJsonBody(req)
  if (!body) {
    _sendJson(res, 400, { error: 'Formato JSON inválido.' })

    return;
  }

  const fullName = (body.full_name || body.fullName || body.nome || '').trim()
  const username = body.username || body.email
  const password = body.password
  const school = body.school || ''
  const grade = body.grade || body.classroom || ''
  const isAdmin = body.admin === true || body.admin === 1 || body.role === 'admin'
  const role = isAdmin ? 'admin' : 'user'
  const adminFlag = isAdmin ? 1 : 0

  if (!fullName) {
    _sendJson(res, 400, { error: 'Nome completo é obrigatório.' })

    return;
  }

  if (!username || typeof username !== 'string' || !password || typeof password !== 'string') {
    _sendJson(res, 400, { error: 'E-mail e senha são obrigatórios.' })

    return;
  }

  const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
  if (existingUser) {
    _sendJson(res, 409, { error: 'Este e-mail já está cadastrado.' })

    return;
  }

  const salt = crypto.randomBytes(16).toString('hex')
  const passwordHash = _hashPassword(password, salt)

  db.prepare('INSERT INTO users (username, full_name, password_hash, salt, role, admin, school, grade) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
    username,
    fullName,
    passwordHash,
    salt,
    role,
    adminFlag,
    school,
    grade
  )

  _sendJson(res, 201, {
    message: 'Conta criada com sucesso!',
    username,
    full_name: fullName,
    role,
    admin: Boolean(adminFlag),
    school,
    grade
  })
}

const _handleLogin = async (req, res) => {
  const body = await _parseJsonBody(req)
  if (!body) {
    _sendJson(res, 400, { error: 'Formato JSON inválido.' })

    return;
  }

  const username = body.username || body.email
  const password = body.password

  if (!username || !password) {
    _sendJson(res, 400, { error: 'E-mail e senha são obrigatórios.' })

    return;
  }

  const user = db.prepare('SELECT id, username, full_name, password_hash, salt, role, admin, school, grade FROM users WHERE username = ?').get(username)
  if (!user) {
    _sendJson(res, 401, { error: 'Credenciais inválidas.' })

    return;
  }

  const computedHash = _hashPassword(password, user.salt)
  if (computedHash !== user.password_hash) {
    _sendJson(res, 401, { error: 'Credenciais inválidas.' })

    return;
  }

  const token = crypto.randomBytes(32).toString('hex')
  const createdAt = new Date().toISOString()

  db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)').run(token, user.id, createdAt)

  _sendJson(res, 200, {
    message: 'Login realizado com sucesso.',
    token,
    user: {
      id: user.id,
      username: user.username,
      full_name: user.full_name || user.username,
      role: user.role,
      admin: Boolean(user.admin),
      school: user.school || '',
      grade: user.grade || ''
    }
  })
}

const _handleGetItems = (req, res) => {
  const items = db.prepare(`
    SELECT items.uuid, items.name, items.owner, items.weight, items.state, items.school, items.created_at AS createdAt,
           COALESCE(NULLIF(users.full_name, ''), items.owner) AS owner_name
    FROM items
    LEFT JOIN users ON LOWER(items.owner) = LOWER(users.username) OR LOWER(items.owner) = LOWER(users.full_name)
  `).all()
  _sendJson(res, 200, { items })
}

const _handleGetSchools = (req, res) => {
  const schools = db.prepare('SELECT id, name, city, created_at AS createdAt FROM schools ORDER BY name ASC').all()
  _sendJson(res, 200, { schools })
}

const _handleCheckUser = (req, res, reqUrl) => {
  const queryUser = reqUrl.searchParams.get('username') || reqUrl.searchParams.get('email')

  if (!queryUser) {
    _sendJson(res, 400, { exists: false, error: 'Informe um e-mail ou nome de usuário.' })

    return;
  }

  const user = db.prepare('SELECT id, username, full_name, school, grade FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(full_name) = LOWER(?)').get(queryUser.trim(), queryUser.trim())

  if (user) {
    _sendJson(res, 200, { exists: true, username: user.username, full_name: user.full_name || user.username, school: user.school, grade: user.grade })
  } else {
    _sendJson(res, 404, { exists: false, error: `Nenhum aluno cadastrado com o e-mail/usuário "${queryUser}".` })
  }
}

const _handleRegisterSchool = async (req, res) => {
  const body = await _parseJsonBody(req)

  if (!body) {
    _sendJson(res, 400, { error: 'Formato JSON inválido.' })

    return;
  }

  const name = (body.name || '').trim()
  const city = (body.city || 'Uberaba').trim()

  if (!name) {
    _sendJson(res, 400, { error: 'Nome da escola é obrigatório.' })

    return;
  }

  const existing = db.prepare('SELECT id FROM schools WHERE LOWER(name) = LOWER(?)').get(name)

  if (existing) {
    _sendJson(res, 409, { error: 'Esta escola já está cadastrada.' })

    return;
  }

  const createdAt = new Date().toISOString()

  try {
    const result = db.prepare('INSERT INTO schools (name, city, created_at) VALUES (?, ?, ?)').run(name, city, createdAt)

    _sendJson(res, 201, {
      id: Number(result.lastInsertRowid),
      name,
      city,
      createdAt
    })
  } catch (err) {
    console.error('Error inserting school:', err.message)
    _sendJson(res, 500, { error: 'Erro ao cadastrar escola.' })
  }
}

const _handleDeleteSchool = async (req, res, targetIdStr) => {
  let body = {}

  if (req.method === 'DELETE' || req.method === 'POST') {
    body = (await _parseJsonBody(req)) || {}
  }

  const schoolId = targetIdStr || body.id
  const schoolName = body.name

  let school = null

  if (schoolId) {
    school = db.prepare('SELECT id, name FROM schools WHERE id = ?').get(schoolId)
  } else if (schoolName) {
    school = db.prepare('SELECT id, name FROM schools WHERE LOWER(name) = LOWER(?)').get(schoolName.trim())
  }

  if (!school) {
    _sendJson(res, 404, { error: 'Escola não encontrada.' })

    return;
  }

  /* INFO: Check server-side if any items in database are connected to this school */
  const linkedItems = db.prepare('SELECT COUNT(*) as count FROM items WHERE LOWER(school) = LOWER(?)').get(school.name)
  const count = linkedItems ? linkedItems.count : 0

  if (count > 0) {
    _sendJson(res, 409, {
      error: `Não é possível excluir a escola "${school.name}" pois existem ${count} dispositivo(s) vinculado(s) a ela.`
    })

    return;
  }

  db.prepare('DELETE FROM schools WHERE id = ?').run(school.id)

  _sendJson(res, 200, {
    message: `Escola "${school.name}" excluída com sucesso!`,
    id: school.id
  })
}

const _handleAddItem = async (req, res) => {
  const user = _getUserFromReq(req)
  const body = await _parseJsonBody(req)

  if (!body) {
    _sendJson(res, 400, { error: 'Formato JSON inválido.' })

    return;
  }

  const name = body.name
  const owner = body.owner || (user ? user.username : 'Aluno')
  const weight = body.weight !== undefined ? Number(body.weight) : 0
  const state = body.state || 'Na escola'
  const school = body.school || (user ? user.school : '')

  if (!name || typeof name !== 'string') {
    _sendJson(res, 400, { error: 'Nome do aparelho é obrigatório.' })

    return;
  }

  /* INFO: Verify server-side that the specified student/owner is actually registered in database */
  if (owner && owner !== 'Aluno') {
    const registeredUser = db.prepare('SELECT id, username FROM users WHERE LOWER(username) = LOWER(?)').get(owner.trim())

    if (!registeredUser) {
      _sendJson(res, 404, {
        error: `O aluno/e-mail "${owner}" não possui cadastro no sistema. Cadastre a conta do aluno primeiro.`
      })

      return;
    }
  }

  const uuid = body.uuid || body.id || `ECO-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
  const createdAt = new Date().toISOString()

  try {
    db.prepare('INSERT INTO items (uuid, name, owner, weight, state, school, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      uuid,
      name,
      owner,
      weight,
      state,
      school,
      createdAt
    )

    _sendJson(res, 201, {
      uuid,
      name,
      owner,
      weight,
      state,
      school,
      createdAt
    })
  } catch (err) {
    console.error('Error inserting item:', err.message)
    _sendJson(res, 500, { error: 'Erro ao salvar dispositivo no banco de dados.' })
  }
}

const _handleUpdateState = async (req, res, targetUuid) => {
  const user = _getUserFromReq(req)
  if (!user) {
    _sendJson(res, 401, { error: 'Não autorizado.' })

    return;
  }

  if (user.role !== 'admin' && user.admin !== 1) {
    _sendJson(res, 403, { error: 'Acesso restrito a administradores.' })

    return;
  }

  const body = await _parseJsonBody(req)
  if (!body) {
    _sendJson(res, 400, { error: 'Formato JSON inválido.' })

    return;
  }

  const uuid = targetUuid || body.uuid
  const state = body.state

  if (!uuid || typeof uuid !== 'string') {
    _sendJson(res, 400, { error: 'UUID do aparelho é obrigatório.' })

    return;
  }

  if (!state || typeof state !== 'string') {
    _sendJson(res, 400, { error: 'Status é obrigatório.' })

    return;
  }

  const item = db.prepare('SELECT uuid FROM items WHERE uuid = ?').get(uuid)
  if (!item) {
    _sendJson(res, 404, { error: 'Aparelho não encontrado.' })

    return;
  }

  db.prepare('UPDATE items SET state = ? WHERE uuid = ?').run(state, uuid)

  _sendJson(res, 200, {
    message: 'Status atualizado com sucesso.',
    uuid,
    state
  })
}

const _handleDeleteItem = async (req, res, targetUuidStr) => {
  let body = {}

  if (req.method === 'DELETE' || req.method === 'POST') {
    body = (await _parseJsonBody(req)) || {}
  }

  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  const queryId = reqUrl.searchParams.get('id') || reqUrl.searchParams.get('uuid')
  const uuid = targetUuidStr || body.id || body.uuid || queryId

  if (!uuid) {
    _sendJson(res, 400, { error: 'ID/UUID do aparelho é obrigatório.' })

    return;
  }

  const item = db.prepare('SELECT uuid, name FROM items WHERE uuid = ?').get(uuid)

  if (!item) {
    _sendJson(res, 404, { error: 'Aparelho não encontrado.' })

    return;
  }

  db.prepare('DELETE FROM items WHERE uuid = ?').run(uuid)

  _sendJson(res, 200, {
    message: `Aparelho "${item.name}" (${uuid}) excluído com sucesso.`,
    uuid
  })
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  const pathname = reqUrl.pathname
  const method = req.method.toUpperCase()

  if (method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS)
    res.end()

    return;
  }

  /*
     INFO: Route matching for API endpoints.
             Supports standard REST routes and API path prefixes.
  */
  if (method === 'GET' && (pathname === '/health' || pathname === '/api/health')) {
    _sendJson(res, 200, { status: 'ok', timestamp: new Date().toISOString() })

    return;
  }

  if (method === 'POST' && (pathname === '/register' || pathname === '/api/register')) {
    await _handleRegister(req, res)

    return;
  }

  if (method === 'POST' && (pathname === '/login' || pathname === '/api/login')) {
    await _handleLogin(req, res)

    return;
  }

  if (method === 'GET' && (pathname === '/items' || pathname === '/api/items')) {
    _handleGetItems(req, res)

    return;
  }

  if (method === 'GET' && (pathname === '/users/check' || pathname === '/api/users/check')) {
    _handleCheckUser(req, res, reqUrl)

    return;
  }

  if (method === 'GET' && (pathname === '/schools' || pathname === '/api/schools')) {
    _handleGetSchools(req, res)

    return;
  }

  if (method === 'POST' && (pathname === '/schools' || pathname === '/api/schools')) {
    await _handleRegisterSchool(req, res)

    return;
  }

  const schoolDeleteMatch = pathname.match(/^\/(?:api\/)?schools\/(\d+)$/i)

  if (method === 'DELETE' && schoolDeleteMatch) {
    await _handleDeleteSchool(req, res, schoolDeleteMatch[1])

    return;
  }

  if ((method === 'DELETE' || method === 'POST') && (pathname === '/schools/delete' || pathname === '/api/schools/delete')) {
    await _handleDeleteSchool(req, res, null)

    return;
  }

  if (method === 'POST' && (pathname === '/items' || pathname === '/api/items')) {
    await _handleAddItem(req, res)

    return;
  }

  /* INFO: Admin endpoint for updating product state. */
  if (method === 'POST' && (pathname === '/admin/items/state' || pathname === '/items/state')) {
    await _handleUpdateState(req, res, null)

    return;
  }

  const updateMatch = pathname.match(/^\/(?:api\/)?items\/([^/]+)(?:\/state)?$/i)
  if ((method === 'PATCH' || method === 'PUT') && updateMatch && updateMatch[1] !== 'state' && updateMatch[1] !== 'delete') {
    await _handleUpdateState(req, res, decodeURIComponent(updateMatch[1]))

    return;
  }

  /* INFO: Item deletion endpoint handler */
  if (
    (method === 'DELETE' && (pathname === '/items' || pathname.startsWith('/items/') || pathname === '/api/items' || pathname.startsWith('/api/items/'))) ||
    ((method === 'POST' || method === 'DELETE') && (pathname.includes('/items/delete') || pathname.includes('/items/remove')))
  ) {
    let targetId = null
    const idMatch = pathname.match(/^\/(?:api\/)?items\/([^/]+)$/i)

    if (idMatch && idMatch[1] !== 'delete' && idMatch[1] !== 'remove' && idMatch[1] !== 'state') {
      targetId = decodeURIComponent(idMatch[1])
    }

    await _handleDeleteItem(req, res, targetId)

    return;
  }

  _sendJson(res, 404, { error: 'Rota não encontrada.' })
})

server.listen(PORT, () => {
  const defaultAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin@ecotech.local')
  if (!defaultAdmin) {
    const salt = crypto.randomBytes(16).toString('hex')
    const passwordHash = _hashPassword('ecotech', salt)
    db.prepare('INSERT INTO users (username, full_name, password_hash, salt, role, admin) VALUES (?, ?, ?, ?, ?, ?)').run(
      'admin@ecotech.local',
      'Administrador EcoTech',
      passwordHash,
      salt,
      'admin',
      1
    )
  }

  /* INFO: Server started listener. */
  console.log(`Server running on port ${PORT}`)
})

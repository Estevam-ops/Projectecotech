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
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    admin INTEGER NOT NULL DEFAULT 0
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
`)

const _sendJson = (res, statusCode, data) => {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' })
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
  const stmt = db.prepare('SELECT users.id, users.username, users.role, users.admin FROM sessions JOIN users ON sessions.user_id = users.id WHERE sessions.token = ?')
  const user = stmt.get(token)

  return user || null
}

const _handleRegister = async (req, res) => {
  const body = await _parseJsonBody(req)
  if (!body) {
    _sendJson(res, 400, { error: 'Invalid JSON payload' })

    return;
  }

  const username = body.username
  const password = body.password
  const isAdmin = body.admin === true || body.admin === 1 || body.role === 'admin'
  const role = isAdmin ? 'admin' : 'user'
  const adminFlag = isAdmin ? 1 : 0

  if (!username || typeof username !== 'string' || !password || typeof password !== 'string') {
    _sendJson(res, 400, { error: 'Username and password are required' })

    return;
  }

  const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
  if (existingUser) {
    _sendJson(res, 409, { error: 'Username already exists' })

    return;
  }

  const salt = crypto.randomBytes(16).toString('hex')
  const passwordHash = _hashPassword(password, salt)

  db.prepare('INSERT INTO users (username, password_hash, salt, role, admin) VALUES (?, ?, ?, ?, ?)').run(username, passwordHash, salt, role, adminFlag)

  _sendJson(res, 201, {
    message: 'User registered successfully',
    username,
    role,
    admin: Boolean(adminFlag)
  })
}

const _handleLogin = async (req, res) => {
  const body = await _parseJsonBody(req)
  if (!body) {
    _sendJson(res, 400, { error: 'Invalid JSON payload' })

    return;
  }

  const username = body.username
  const password = body.password

  if (!username || !password) {
    _sendJson(res, 400, { error: 'Username and password are required' })

    return;
  }

  const user = db.prepare('SELECT id, username, password_hash, salt, role, admin FROM users WHERE username = ?').get(username)
  if (!user) {
    _sendJson(res, 401, { error: 'Invalid credentials' })

    return;
  }

  const computedHash = _hashPassword(password, user.salt)
  if (computedHash !== user.password_hash) {
    _sendJson(res, 401, { error: 'Invalid credentials' })

    return;
  }

  const token = crypto.randomBytes(32).toString('hex')
  const createdAt = new Date().toISOString()

  db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)').run(token, user.id, createdAt)

  _sendJson(res, 200, {
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      admin: Boolean(user.admin)
    }
  })
}

const _handleGetItems = (req, res) => {
  const items = db.prepare('SELECT uuid, name, owner, weight, state, school, description, created_at AS createdAt FROM items').all()
  _sendJson(res, 200, { items })
}

const _handleAddItem = async (req, res) => {
  const user = _getUserFromReq(req)
  if (!user) {
    _sendJson(res, 401, { error: 'Unauthorized' })

    return;
  }

  const body = await _parseJsonBody(req)
  if (!body) {
    _sendJson(res, 400, { error: 'Invalid JSON payload' })

    return;
  }

  const name = body.name
  const owner = body.owner || user.username
  const weight = body.weight !== undefined ? Number(body.weight) : 0
  const state = body.state || 'available'
  const school = body.school || ''
  const description = body.description || ''

  if (!name || typeof name !== 'string') {
    _sendJson(res, 400, { error: 'Product name is required' })

    return;
  }

  const uuid = crypto.randomUUID()
  const createdAt = new Date().toISOString()

  db.prepare('INSERT INTO items (uuid, name, owner, weight, state, school, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(uuid, name, owner, weight, state, school, description, createdAt)

  _sendJson(res, 201, {
    uuid,
    name,
    owner,
    weight,
    state,
    school,
    description,
    createdAt
  })
}

const _handleUpdateState = async (req, res, targetUuid) => {
  const user = _getUserFromReq(req)
  if (!user) {
    _sendJson(res, 401, { error: 'Unauthorized' })

    return;
  }

  if (user.role !== 'admin' && user.admin !== 1) {
    _sendJson(res, 403, { error: 'Admin access required' })

    return;
  }

  const body = await _parseJsonBody(req)
  if (!body) {
    _sendJson(res, 400, { error: 'Invalid JSON payload' })

    return;
  }

  const uuid = targetUuid || body.uuid
  const state = body.state

  if (!uuid || typeof uuid !== 'string') {
    _sendJson(res, 400, { error: 'Product UUID is required' })

    return;
  }

  if (!state || typeof state !== 'string') {
    _sendJson(res, 400, { error: 'Product state is required' })

    return;
  }

  const item = db.prepare('SELECT uuid FROM items WHERE uuid = ?').get(uuid)
  if (!item) {
    _sendJson(res, 404, { error: 'Product not found' })

    return;
  }

  db.prepare('UPDATE items SET state = ? WHERE uuid = ?').run(state, uuid)

  _sendJson(res, 200, {
    message: 'Product state updated successfully',
    uuid,
    state
  })
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  const pathname = reqUrl.pathname
  const method = req.method.toUpperCase()

  /*
     INFO: Route matching for API endpoints.
             Supports standard REST routes and API path prefixes.
  */
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

  if (method === 'POST' && (pathname === '/items' || pathname === '/api/items')) {
    await _handleAddItem(req, res)

    return;
  }

  /* INFO: Admin endpoint for updating product state. */
  if (method === 'POST' && (pathname === '/admin/items/state' || pathname === '/items/state')) {
    await _handleUpdateState(req, res, null)

    return;
  }

  const updateMatch = pathname.match(/^\/(?:api\/)?items\/([a-f0-9-]+)(?:\/state)?$/i)
  if ((method === 'PATCH' || method === 'PUT') && updateMatch) {
    await _handleUpdateState(req, res, updateMatch[1])

    return;
  }

  _sendJson(res, 404, { error: 'Route not found' })
})

server.listen(PORT, () => {
  /* INFO: Server started listener. */
  console.log(`Server running on port ${PORT}`)
})

import crypto from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import process from 'node:process'

const HASH_ITERATIONS = 100000
const KEY_LEN = 64
const DIGEST = 'sha512'

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
`)

try {
  db.exec(`ALTER TABLE users ADD COLUMN full_name TEXT NOT NULL DEFAULT '';`)
} catch {
  /* Column already exists */
}

try {
  db.exec(`ALTER TABLE users ADD COLUMN school TEXT NOT NULL DEFAULT '';`)
} catch {
  /* Column already exists */
}

try {
  db.exec(`ALTER TABLE users ADD COLUMN grade TEXT NOT NULL DEFAULT '';`)
} catch {
  /* Column already exists */
}

const args = process.argv.slice(2)
const username = (args[0] || 'admin@ecotech.local').trim()
const password = args[1] || 'admin123'
const fullName = (args[2] || 'Administrador EcoTech').trim()

const salt = crypto.randomBytes(16).toString('hex')
const passwordHash = crypto.pbkdf2Sync(password, salt, HASH_ITERATIONS, KEY_LEN, DIGEST).toString('hex')

try {
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username)

  if (existing) {
    db.prepare("UPDATE users SET full_name = ?, password_hash = ?, salt = ?, role = 'admin', admin = 1 WHERE id = ?")
      .run(fullName, passwordHash, salt, existing.id)
    console.log(`Admin account "${username}" updated successfully.`)
  } else {
    db.prepare("INSERT INTO users (username, full_name, password_hash, salt, role, admin) VALUES (?, ?, ?, ?, 'admin', 1)")
      .run(username, fullName, passwordHash, salt)
    console.log(`Admin account "${username}" created successfully.`)
  }

  console.log('--- Account Details ---')
  console.log(`Username / E-mail: ${username}`)
  console.log(`Password:          ${password}`)
  console.log(`Full Name:         ${fullName}`)
  console.log('-----------------------')
} catch (err) {
  console.error('Failed to create admin account:', err.message)
  process.exit(1)
}

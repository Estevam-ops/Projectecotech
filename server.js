import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const PORT = process.env.PORT || 5500
const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:3000'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, PATCH, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
}

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
}

const API_ROUTES = ['/login', '/register', '/items', '/schools', '/users', '/health']


const _sendFile = (res, statusCode, contentType, content) => {
  res.writeHead(statusCode, {
    ...CORS_HEADERS,
    'Content-Type': contentType
  })
  res.end(content)
}


const _proxyToBackend = (req, res) => {
  const targetUrl = new URL(req.url, BACKEND_URL)

  const options = {
    hostname: targetUrl.hostname,
    port: targetUrl.port,
    path: targetUrl.pathname + targetUrl.search,
    method: req.method,
    headers: {
      ...req.headers,
      host: targetUrl.host
    }
  }

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, {
      ...CORS_HEADERS,
      ...proxyRes.headers
    })
    proxyRes.pipe(res, { end: true })
  })

  proxyReq.on('error', (err) => {
    console.error('Backend proxy error:', err.message)
    res.writeHead(502, { ...CORS_HEADERS, 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Erro ao conectar ao servidor backend.' }))
  })

  req.pipe(proxyReq, { end: true })
}


const _resolveFilePath = (pathname) => {
  if (pathname === '/' || pathname === '/index.html') {
    return path.join(process.cwd(), 'index.html')
  }

  /* Alias clean URLs to pages/ directory */
  if (['/main', '/main.html'].includes(pathname)) return path.join(process.cwd(), 'pages', 'main.html')
  if (['/session', '/session.html', '/sessao', '/sessao.html'].includes(pathname)) return path.join(process.cwd(), 'pages', 'session.html')
  if (['/user', '/user.html'].includes(pathname)) return path.join(process.cwd(), 'pages', 'user.html')
  if (['/admin', '/admin.html'].includes(pathname)) return path.join(process.cwd(), 'pages', 'admin.html')

  /* Check pages/ folder directly */
  if (pathname.startsWith('/pages/')) {
    return path.join(process.cwd(), pathname)
  }

  /* Check root directory */
  return path.join(process.cwd(), pathname)
}


/* INFO: HTTP Web Server & Proxy Handler */
const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS)
    res.end()

    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  const pathname = parsedUrl.pathname

  if (pathname === '/favicon.ico') {
    res.writeHead(204, CORS_HEADERS)
    res.end()

    return;
  }

  /* Proxy API endpoints to backend */
  const isApiRoute = API_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))

  if (isApiRoute) {
    _proxyToBackend(req, res)

    return;
  }

  /* Resolve and serve static files */
  const filePath = _resolveFilePath(pathname)
  const ext = path.extname(filePath).toLowerCase()
  const mimeType = MIME_TYPES[ext] || 'text/plain; charset=UTF-8'

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        _sendFile(res, 404, 'text/html; charset=UTF-8', '<h1>404 - Página não encontrada</h1>')
      } else {
        _sendFile(res, 500, 'text/html; charset=UTF-8', '<h1>500 - Erro interno no servidor</h1>')
      }

      return;
    }

    _sendFile(res, 200, mimeType, content)
  })
})

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})

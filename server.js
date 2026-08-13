import http from 'node:http'
import fs from 'node:fs'

const PORT = process.env.PORT || 5500
const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:3000'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, PATCH, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
}

const sendFile = (res, statusCode, contentType, content) => {
  res.writeHead(statusCode, {
    ...CORS_HEADERS,
    'Content-Type': contentType
  })
  res.end(content)
}

const proxyToBackend = (req, res) => {
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

  if (pathname === '/' || pathname === '/index.html') {
    sendFile(res, 200, 'text/html', fs.readFileSync('index.html'))

    return;
  }

  if (pathname === '/app.js') {
    sendFile(res, 200, 'application/javascript', fs.readFileSync('app.js'))

    return;
  }

  if (pathname === '/styles.css') {
    sendFile(res, 200, 'text/css', fs.readFileSync('styles.css'))

    return;
  }

  if (pathname === '/printer.js') {
    sendFile(res, 200, 'application/javascript', fs.readFileSync('printer.js'))

    return;
  }

  proxyToBackend(req, res)
})

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})
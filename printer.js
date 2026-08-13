import { exec } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import util from 'node:util'

import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'

/* INFO: Promisified exec function for executing shell commands. */
const execAsync = util.promisify(exec)

/*
   INFO: Busca prioritaria por impressoras de recibos.
           99% de chance que vai dar merda mas fazer o que.
*/
const RECEIPT_KEYWORDS = [
  'receipt',
  'pos',
  'thermal',
  'epson',
  'star',
  'tm-t',
  'tsp',
  'munbyn',
  'xprinter'
]

/* INFO: Livrarias sao carregadas dependendo do sistema operacional. */
let winPrinter = null
let unixPrinter = null

if (os.platform() === 'win32') {
  winPrinter = await import('pdf-to-printer')
} else {
  unixPrinter = await import('unix-print')
}

/* INFO: Codigo universal para encontrar impressoras independente do sistema operacional. */
async function _getConnectedPrinters() {
  const platform = os.platform()

  if (platform === 'win32') {
    const printers = await winPrinter.getPrinters()

    return printers.map((p) => ({ name: p.name, deviceId: p.deviceId }))
  }

  /*
     INFO: Linux / macOS via LPSTAT.
             Honestamente, eu faco 0 ideia do que caralhos a IA fez aqui,
             eu nao uso linux na minha maquina entao nao da pra saber se funciona ainda.
             Sim foi basicamente traduzido do codigo do windows.
  */
  try {
    const { stdout } = await execAsync('lpstat -p')
    const lines = stdout.split('\n')
    const printers = []

    for (const line of lines) {
      const match = line.match(/^printer\s+([^\s]+)/)

      if (match) {
        printers.push({ name: match[1], deviceId: match[1] })
      }
    }

    return printers
  } catch (err) {
    console.warn('Could not query CUPS printers via lpstat. Standard error:', err.message)

    return []
  }
}

/*
   INFO: Seleciona a melhor impressora disponivel de acordo com os seguintes parametros:
           1. Busca por impressoras de recibo.
           2. Caso nao encontre utiliza qualquer impressora disponivel.
*/
async function _getTargetPrinter() {
  const printers = await _getConnectedPrinters()

  if (printers.length === 0) {
    throw new Error('No connected printers found on the system.')
  }

  const receiptPrinter = printers.find((p) =>
    RECEIPT_KEYWORDS.some((kw) => p.name.toLowerCase().includes(kw))
  )

  if (receiptPrinter) {
    console.log(`Receipt printer detected: ${receiptPrinter.name}`)

    return receiptPrinter.name
  }

  console.log(`No receipt printer found. Using fallback printer: ${printers[0].name}`)

  return printers[0].name
}

/* INFO: Cria um pdf temporario para gerar o qr code com id do produto. */
async function _generatePrintPDF(id, filePath) {
  const qrDataUrl = await QRCode.toDataURL(id, {
    margin: 1,
    width: 300,
    errorCorrectionLevel: 'M'
  })

  const doc = new PDFDocument({
    size: [226, 300],
    margin: 10
  })

  /* INFO: Que comece a gambiarra. */
  const writeStream = fs.createWriteStream(filePath)

  return new Promise((resolve, reject) => {
    doc.pipe(writeStream)
    doc.fontSize(12).font('Helvetica-Bold').text('ID BARCODE', { align: 'center' })
    doc.moveDown(0.5)
    doc.image(qrDataUrl, {
      fit: [150, 150],
      align: 'center',
      valign: 'center'
    })
    doc.moveDown(0.5)
    doc.fontSize(10).font('Helvetica').text(`ID: ${id}`, { align: 'center' })
    doc.end()

    /* INFO: Honestamente achei que ia ser pior. */
    writeStream.on('finish', () => resolve(filePath))
    writeStream.on('error', reject)
  })
}

/*
   INFO: Imprime o qr code automaticamente.
   
   SOURCES:
    - O ID para ser gerado o qr code.
*/
async function printQrCode(id) {
  if (!id || typeof id !== 'string') {
    throw new Error('The printQrCode function accepts exactly one string ID per call.')
  }

  const tempPdfPath = path.join(os.tmpdir(), `qr_print_${Date.now()}.pdf`)

  try {
    /* INFO: 1. Detectar impressora. */
    const printerName = await _getTargetPrinter()

    /* INFO: 2. Gerar qr code. */
    await _generatePrintPDF(id, tempPdfPath)

    /* INFO: 3. Enviar para impressao. */
    if (os.platform() === 'win32') {
      await winPrinter.print(tempPdfPath, { printer: printerName })
    } else {
      await unixPrinter.print(tempPdfPath, printerName)
    }

    console.log(`Successfully sent ID "${id}" to printer: ${printerName}`)
  } catch (error) {
    /* INFO: Se deu isso e porque deu merda seu animal. */
    console.error(`Failed to print QR code for ID "${id}":`, error.message)

    throw error
  } finally {
    /* INFO: Limpar o qr code gerado para nao encher o sistema. */
    if (fs.existsSync(tempPdfPath)) {
      fs.unlinkSync(tempPdfPath)
    }
  }
}

export { printQrCode }

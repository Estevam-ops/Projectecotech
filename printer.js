const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

// Livrarias são carregadas dependendo do sistema operaçional
let winPrinter, unixPrinter;
if (os.platform() === 'win32') {
  winPrinter = require('pdf-to-printer');
} else {
  unixPrinter = require('unix-print');
}

/**
 * Busca prioritaria por impressoras de recibos
 * 
 * 99% de chance que vai dar merda mas fazer o que
 */
const RECEIPT_KEYWORDS = ['receipt', 'pos', 'thermal', 'epson', 'star', 'tm-t', 'tsp', 'munbyn', 'xprinter'];

/**
 * Codigo universal para encontrar impressoras independente do sistema operaçional
 */
async function getConnectedPrinters() {
  const platform = os.platform();
  if (platform === 'win32') {
    const printers = await winPrinter.getPrinters();
    return printers.map((p) => ({ name: p.name, deviceId: p.deviceId }));
  } else {
    // Linux / macOS via LPSTAT
    // Honestamente, eu faço 0 idea do que caralhos a IA fez aqui, eu não uso linux na minha maquina então não dá pra saber se funciona ainda
    // Sim foi basicamente traduzido do codigo do windows 
    try {
      const { stdout } = await execAsync('lpstat -p');
      const lines = stdout.split('\n');
      const printers = [];

      for (const line of lines) {
        const match = line.match(/^printer\s+([^\s]+)/);
        if (match) {
          printers.push({ name: match[1], deviceId: match[1] });
        }
      }
      return printers;
    } catch (err) {
      console.warn('Could not query CUPS printers via lpstat. Standard error:', err.message);
      return [];
    }
  }
}
/**
 * Seleciona a melhor impressora disponivel de acordo com os seguintes parametros:
 * 1. Busca por impressoras de recibo.
 * 2. Caso não encontre utiliza qualquer impressora disponivel.
 */
async function getTargetPrinter() {
  const printers = await getConnectedPrinters();
  if (printers.length === 0) {
    throw new Error('No connected printers found on the system.');
  }
  const receiptPrinter = printers.find((p) =>
    RECEIPT_KEYWORDS.some((kw) => p.name.toLowerCase().includes(kw))
  );
  if (receiptPrinter) {
    console.log(`Receipt printer detected: ${receiptPrinter.name}`);
    return receiptPrinter.name;
  }
  console.log(`No receipt printer found. Using fallback printer: ${printers[0].name}`);
  return printers[0].name;
}

/**
 * Cria um pdf temporario para gerar o qr code com id do produto
 */
async function generatePrintPDF(id, filePath) {
  return new Promise(async (resolve, reject) => {
    try {
      const qrDataUrl = await QRCode.toDataURL(id, {
        margin: 1,
        width: 300,
        errorCorrectionLevel: 'M',
      });
      const doc = new PDFDocument({
        size: [226, 300], // 226pt = ~80mm width
        margin: 10,
      });
      //Que começe a gambiarra 
      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);
      doc.fontSize(12).font('Helvetica-Bold').text('ID BARCODE', { align: 'center' });
      doc.moveDown(0.5);
      doc.image(qrDataUrl, {
        fit: [150, 150],
        align: 'center',
        valign: 'center',
      });
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica').text(`ID: ${id}`, { align: 'center' });
      doc.end();
      // Honestamente achei que ia ser pior
      writeStream.on('finish', () => resolve(filePath));
      writeStream.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Imprime o qr code automaticamente 
 * 
 * @param {string} id - O ID pra ser gerado o qr code.
 */
async function printQrCode(id) {
  if (!id || typeof id !== 'string') {
    throw new Error('The printQrCode function accepts exactly one string ID per call.');
  }
  const tempPdfPath = path.join(os.tmpdir(), `qr_print_${Date.now()}.pdf`);
  try {
    // 1. Detectar impressora
    const printerName = await getTargetPrinter();
    // 2. Gerar qr code
    await generatePrintPDF(id, tempPdfPath);
    // 3. Enviar para impressão
    if (os.platform() === 'win32') {
      await winPrinter.print(tempPdfPath, { printer: printerName });
    } else {
      await unixPrinter.print(tempPdfPath, printerName);
    }

    console.log(`Successfully sent ID "${id}" to printer: ${printerName}`);
  } catch (error) {
    //Se deu isso é pq deu merda seu animal 
    console.error(`Failed to print QR code for ID "${id}":`, error.message);
    throw error;
  } finally {
    // Limpar o qr code gerado para não encher o sistema 
    if (fs.existsSync(tempPdfPath)) {
      fs.unlinkSync(tempPdfPath);
    }
  }
}

module.exports = {
  printQrCode,
};
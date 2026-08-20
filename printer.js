/* INFO: Browser-native printing helper using standard DOM and Browser Print APIs */

const _createPrintFrame = () => {
  let frame = document.getElementById('ecotech-print-frame')

  if (!frame) {
    frame = document.createElement('iframe')
    frame.id = 'ecotech-print-frame'
    frame.style.position = 'fixed'
    frame.style.right = '0'
    frame.style.bottom = '0'
    frame.style.width = '0'
    frame.style.height = '0'
    frame.style.border = '0'
    document.body.appendChild(frame)
  }

  return frame
}


/* INFO: Trigger native browser print dialog for current window */
const invokePrint = () => {
  if (typeof globalThis.print === 'function') {
    globalThis.print()
  }
}


/* INFO: Generate printable QR barcode label using browser APIs and invoke browser print dialog */
const printQrCode = (id, metadata = {}) => {
  if (!id || typeof id !== 'string') {
    throw new Error('The printQrCode function accepts a valid string ID.')
  }

  if (typeof document === 'undefined') {
    throw new Error('printQrCode requires a browser environment.')
  }

  const frame = _createPrintFrame()
  const frameDoc = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document)

  if (!frameDoc) {
    invokePrint()

    return;
  }

  const device = metadata.device || 'Aparelho Eletrônico'
  const school = metadata.school || 'EcoTech UPT'
  const student = metadata.student || ''

  frameDoc.open()
  frameDoc.write(`
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <title>Etiqueta ${id}</title>
        <style>
          @page { size: auto; margin: 10mm; }
          body {
            font-family: system-ui, -apple-system, sans-serif;
            text-align: center;
            padding: 12px;
            margin: 0;
            color: #12201a;
          }
          .qr-card {
            border: 2px solid #0c1411;
            border-radius: 8px;
            padding: 16px;
            display: inline-block;
            max-width: 280px;
          }
          .qr-title {
            font-size: 14px;
            font-weight: 700;
            margin-bottom: 8px;
          }
          .qr-code {
            display: flex;
            justify-content: center;
            margin: 12px 0;
          }
          .qr-id {
            font-size: 12px;
            font-weight: 700;
            margin-top: 6px;
          }
          .qr-meta {
            font-size: 10px;
            color: #4e5b53;
            margin-top: 4px;
          }
        </style>
      </head>
      <body>
        <div class="qr-card">
          <div class="qr-title">ECOTECH · REGISTRO</div>
          <div class="qr-code" id="qrContainer"></div>
          <div class="qr-id">${id}</div>
          <div class="qr-meta">${device} ${school ? '• ' + school : ''} ${student ? '• ' + student : ''}</div>
        </div>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
        <script>
          if (window.QRCode) {
            new QRCode(document.getElementById('qrContainer'), {
              text: '${id}',
              width: 140,
              height: 140
            });
          }
          window.onload = function() {
            setTimeout(function() {
              window.focus();
              window.print();
            }, 250);
          };
        </script>
      </body>
    </html>
  `)
  frameDoc.close()
}


/* INFO: Trigger print dialog for all generated labels */
const printLabels = () => {
  invokePrint()
}


export { invokePrint, printQrCode, printLabels }

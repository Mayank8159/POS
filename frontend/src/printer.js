const DEFAULT_LINE_WIDTH = 32;
const DEFAULT_BAUD_RATE = 9600;

export const SERIAL_BAUD_RATE = DEFAULT_BAUD_RATE;

function encoder() {
  return new TextEncoder();
}

function concatChunks(chunks) {
  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function esc(...bytes) {
  return Uint8Array.from(bytes);
}

function textLine(value = '') {
  return encoder().encode(`${value}\n`);
}

function repeat(char, count) {
  return new Array(count).fill(char).join('');
}

function formatMoney(value) {
  return `Rs ${Math.round(Number(value || 0)).toLocaleString('en-IN')}`;
}

function padRight(input, width) {
  const value = String(input ?? '');
  if (value.length >= width) return value.slice(0, width);
  return value + ' '.repeat(width - value.length);
}

function splitName(name, width) {
  const clean = String(name || '').trim();
  if (clean.length <= width) return [clean];
  const words = clean.split(/\s+/);
  const lines = [];
  let current = '';

  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }
    if (`${current} ${word}`.length <= width) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);

  if (lines.length === 0) return [clean.slice(0, width)];
  return lines;
}

function formatItemLines(item, lineWidth) {
  const qty = Number(item.qty || 0);
  const amount = formatMoney((item.price || 0) * qty);
  const rightWidth = Math.min(12, Math.floor(lineWidth * 0.38));
  const leftWidth = lineWidth - rightWidth;
  const itemName = `${qty}x ${item.name || 'Item'}`;

  const nameLines = splitName(itemName, leftWidth);
  const lines = [];

  nameLines.forEach((line, idx) => {
    if (idx === 0) {
      lines.push(`${padRight(line, leftWidth)}${amount.padStart(rightWidth)}`);
    } else {
      lines.push(line);
    }
  });

  return lines;
}

function buildReceiptBytes(receiptData, options = {}) {
  const shopName = options.shopName || 'PI POS SHOP';
  const tagline = options.tagline || 'Raspberry Pi POS';
  const lineWidth = Number(options.lineWidth || DEFAULT_LINE_WIDTH);

  const chunks = [];

  // Initialize printer and use UTF-8 compatible code page where available.
  chunks.push(esc(0x1B, 0x40));
  chunks.push(esc(0x1B, 0x74, 0x00));

  // Header center aligned.
  chunks.push(esc(0x1B, 0x61, 0x01));
  chunks.push(esc(0x1B, 0x45, 0x01));
  chunks.push(textLine(shopName.toUpperCase()));
  chunks.push(esc(0x1B, 0x45, 0x00));
  chunks.push(textLine(tagline));
  chunks.push(textLine(`Order #${receiptData.id}`));
  chunks.push(textLine(new Date(receiptData.date).toLocaleString('en-IN')));
  chunks.push(textLine(repeat('-', lineWidth)));

  // Items left aligned.
  chunks.push(esc(0x1B, 0x61, 0x00));
  for (const item of receiptData.items || []) {
    const lines = formatItemLines(item, lineWidth);
    for (const line of lines) {
      chunks.push(textLine(line));
    }
  }

  chunks.push(textLine(repeat('-', lineWidth)));
  chunks.push(textLine(`Subtotal: ${formatMoney(receiptData.subTotal)}`));

  const breakdown = receiptData.gstBreakdown || {};
  for (const [rate, amount] of Object.entries(breakdown)) {
    chunks.push(textLine(`GST @${rate}%: ${formatMoney(amount)}`));
  }

  chunks.push(esc(0x1B, 0x45, 0x01));
  chunks.push(textLine(`TOTAL: ${formatMoney(receiptData.total)}`));
  chunks.push(esc(0x1B, 0x45, 0x00));
  chunks.push(textLine(repeat('-', lineWidth)));

  // Footer center aligned.
  chunks.push(esc(0x1B, 0x61, 0x01));
  chunks.push(textLine('Thank you for your purchase!'));
  chunks.push(textLine('Please come again.'));
  chunks.push(textLine(''));
  chunks.push(textLine(''));

  // Full cut for supported printers.
  chunks.push(esc(0x1D, 0x56, 0x00));

  return concatChunks(chunks);
}

export function isWebSerialSupported() {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

export async function connectSerialPrinter(options = {}) {
  if (!isWebSerialSupported()) {
    throw new Error('Web Serial is not supported in this browser.');
  }

  const baudRate = Number(options.baudRate || DEFAULT_BAUD_RATE);

  const existingPorts = await navigator.serial.getPorts();
  const port = existingPorts[0] || await navigator.serial.requestPort();

  if (!port.readable || !port.writable) {
    await port.open({ baudRate, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' });
  }

  return port;
}

export async function printReceiptSerial(port, receiptData, options = {}) {
  if (!port) {
    throw new Error('Printer port is not connected.');
  }

  const baudRate = Number(options.baudRate || DEFAULT_BAUD_RATE);

  if (!port.writable) {
    await port.open({ baudRate, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' });
  }

  const writer = port.writable.getWriter();
  try {
    const bytes = buildReceiptBytes(receiptData, options);
    await writer.write(bytes);
  } finally {
    writer.releaseLock();
  }
}

export function buildTestReceipt() {
  return {
    id: 'TEST',
    date: new Date().toISOString(),
    items: [
      { name: 'Printer Test Item', price: 10, qty: 1 },
      { name: 'Second Line Item', price: 25, qty: 2 }
    ],
    subTotal: 60,
    gstBreakdown: { 5: 3 },
    total: 63
  };
}

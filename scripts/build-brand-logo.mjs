import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const source = 'C:/Users/TUR BUDUR/Projects/ticket-go/apps/desktop/preview/assets/logo-ticketgo.png';
const outDir = 'C:/Users/TUR BUDUR/Desktop/ticketgoteknoloji.com/public/brand';

fs.mkdirSync(outDir, { recursive: true });
fs.copyFileSync(source, path.join(outDir, 'logo-ticketgo-original.jpg'));

const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;

function hex(r, g, b) {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

const textStartY = Math.floor(height * 0.62);
let minX = width;
let minY = height;
let maxX = 0;
let maxY = 0;

for (let y = textStartY; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const i = (y * width + x) * channels;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const brightness = r + g + b;
    if (brightness > 700) continue;
    const isNavy = r < 60 && g < 90 && b > 60;
    const isCyan = b > 130 && b > r + 20;
    if (isNavy || isCyan) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
}

const pad = 16;
const crop = {
  left: Math.max(0, minX - pad),
  top: Math.max(0, minY - pad),
  width: Math.min(width - Math.max(0, minX - pad), maxX - minX + pad * 2),
  height: Math.min(height - Math.max(0, minY - pad), maxY - minY + pad * 2),
};

console.log('Text crop:', crop);

const textOnly = await sharp(source).extract(crop).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

const out = Buffer.alloc(textOnly.info.width * textOnly.info.height * 4);
const ticketSamples = [];
const goSamples = [];

for (let y = 0; y < textOnly.info.height; y++) {
  for (let x = 0; x < textOnly.info.width; x++) {
    const i = (y * textOnly.info.width + x) * 4;
    const r = textOnly.data[i];
    const g = textOnly.data[i + 1];
    const b = textOnly.data[i + 2];
    const brightness = r + g + b;
    const isBackground = brightness > 700 || (r > 235 && g > 235 && b > 235);
    out[i] = r;
    out[i + 1] = g;
    out[i + 2] = b;
    out[i + 3] = isBackground ? 0 : 255;
    if (!isBackground) {
      const relX = x / textOnly.info.width;
      if (relX < 0.62) ticketSamples.push([r, g, b]);
      else goSamples.push([r, g, b]);
    }
  }
}

function dominant(samples) {
  const map = new Map();
  for (const [r, g, b] of samples) {
    const key = hex(Math.round(r / 4) * 4, Math.round(g / 4) * 4, Math.round(b / 4) * 4);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

const ticketColor = dominant(ticketSamples) ?? '#001b50';
const goColor = dominant(goSamples) ?? '#00d5fd';

const textPngPath = path.join(outDir, 'ticketgo-wordmark.png');
await sharp(out, {
  raw: { width: textOnly.info.width, height: textOnly.info.height, channels: 4 },
})
  .png()
  .toFile(textPngPath);

const meta = await sharp(textPngPath).metadata();
const logoWidth = 220;
const logoHeight = Math.round((meta.height / meta.width) * logoWidth);
const subtitleY = logoHeight + 18;
const svgHeight = subtitleY + 16;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${logoWidth} ${svgHeight}" fill="none" role="img" aria-label="ticket Go TicketGo Teknoloji A.Ş.">
  <image href="/brand/ticketgo-wordmark.png" x="0" y="0" width="${logoWidth}" height="${logoHeight}" preserveAspectRatio="xMidYMid meet"/>
  <text x="${logoWidth / 2}" y="${subtitleY}" text-anchor="middle" font-family="Inter, 'Segoe UI', Arial, sans-serif" font-size="11" font-weight="500" letter-spacing="0.02em" fill="#475569">TicketGo Teknoloji A.Ş.</text>
</svg>`;

fs.writeFileSync(path.join(outDir, '..', 'logo.svg'), svg);

const faviconSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="ticket Go">
  <rect width="64" height="64" rx="14" fill="${ticketColor}"/>
  <text x="32" y="40" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="20" font-weight="700" fill="${goColor}">Go</text>
</svg>`;

fs.writeFileSync(path.join(outDir, '..', 'favicon.svg'), faviconSvg);

console.log('ticketColor', ticketColor);
console.log('goColor', goColor);
console.log('wordmark', meta.width, 'x', meta.height);
console.log('Generated assets');

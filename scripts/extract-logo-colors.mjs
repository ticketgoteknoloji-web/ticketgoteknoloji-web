import sharp from 'sharp';

const source = 'C:/Users/TUR BUDUR/Desktop/tg-corp2.png';
const { data, info } = await sharp(source).raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;

const counts = new Map();

for (let i = 0; i < data.length; i += channels) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  if (b > 120 && b > r + 20 && b > g + 10) {
    const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
}

console.log('Bright blues:');
[...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([hex, n]) => console.log(hex, n));

const darkCounts = new Map();
for (let i = 0; i < data.length; i += channels) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  if (r < 80 && g < 100 && b > 100 && b < 200) {
    const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    darkCounts.set(hex, (darkCounts.get(hex) ?? 0) + 1);
  }
}

console.log('\nNavy blues:');
[...darkCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([hex, n]) => console.log(hex, n));

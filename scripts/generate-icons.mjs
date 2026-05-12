/**
 * Genera PNG / ICO desde public/favicon.svg (marca Pana Fitness).
 * Ejecutar tras cambiar el diseño del icono: npm run generate:icons
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(__dirname, '..', 'public');
const svg = path.join(pub, 'favicon.svg');

async function main() {
  if (!fs.existsSync(svg)) {
    console.error('Missing', svg);
    process.exit(1);
  }

  await sharp(svg).resize(180, 180).png().toFile(path.join(pub, 'apple-touch-icon.png'));

  const buf32 = await sharp(svg).resize(32, 32).png().toBuffer();
  const buf16 = await sharp(svg).resize(16, 16).png().toBuffer();
  const ico = await pngToIco([buf16, buf32]);
  fs.writeFileSync(path.join(pub, 'favicon.ico'), ico);

  await sharp(svg).resize(192, 192).png().toFile(path.join(pub, 'icon-192.png'));
  await sharp(svg).resize(512, 512).png().toFile(path.join(pub, 'icon-512.png'));

  const iconMid = await sharp(svg).resize(280, 280).png().toBuffer();
  await sharp({
    create: {
      width: 1200,
      height: 630,
      channels: 3,
      background: '#141417',
    },
  })
    .composite([{ input: iconMid, left: Math.round((1200 - 280) / 2), top: Math.round((630 - 280) / 2) }])
    .png()
    .toFile(path.join(pub, 'og-image.png'));

  console.log('Icons written to public/');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

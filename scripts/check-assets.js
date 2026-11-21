import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const app = fileURLToPath(new URL('../apps/web/', import.meta.url));
const catalog = JSON.parse(await readFile(path.join(app, 'src/data/catalog.json'), 'utf8'));
const files = await readdir(path.join(app, 'public/cards'));
if (catalog.length !== 78 || files.filter((file) => file.endsWith('.webp')).length !== 78) {
  throw new Error('Expected a complete set of 78 card images');
}
for (const card of catalog) {
  const bytes = await readFile(path.join(app, 'public', card.image));
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') {
    throw new Error(`Invalid WebP: ${card.image}`);
  }
}
console.log('Verified 78 card images and their catalog paths.');

import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
await mkdir(path.join(root, 'dist'), { recursive: true });
for (const file of ['index.html', 'styles.css', 'app.js', 'team-utils.js', 'favicon.svg']) await copyFile(path.join(root, file), path.join(root, 'dist', file));
const [html, css, utils, app, favicon] = await Promise.all(['index.html', 'styles.css', 'team-utils.js', 'app.js', 'favicon.svg'].map(file => readFile(path.join(root, file), 'utf8')));
const script = "'use strict';\n" + utils.replace(/^export /gm, '') + '\n' + app.replace(/^import .*;\r?\n/, '');
const standalone = html
  .replace('<link rel="stylesheet" href="./styles.css">', () => '<style>' + css + '</style>')
  .replace('<script src="./app.js" type="module"></script>', () => '<script defer>document.addEventListener("DOMContentLoaded", function () {\n' + script + '\n});</script>')
  .replace('href="./favicon.svg"', () => 'href="data:image/svg+xml,' + encodeURIComponent(favicon) + '"')
  .replace('class="brand" href="./"', 'class="brand" href="#"');
await writeFile(path.join(root, '모여모여.html'), standalone);
console.log('Built dist/ and standalone 모여모여.html');

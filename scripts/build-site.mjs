#!/usr/bin/env node
/** Publica somente arquivos necessários ao jogo (nunca scripts e prompts do agente). */
import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const file of ['index.html','styles.css','app.mjs','engine.mjs','persistence.mjs','chat-link.mjs','world.json']) {
  await cp(path.join(root,file), path.join(dist,file));
}
console.log('ERMO: site estático preparado em dist/ com 7 arquivos.');
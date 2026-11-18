#!/usr/bin/env node
/**
 * Converte um único arquivo novo de proposals/inbox em proposta.json ignorado.
 * Não executa o conteúdo e nunca modifica world.json.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const inboxPattern = /^A\t(proposals\/inbox\/([A-Za-z0-9_-]{1,64})\.json)$/;

export function selectInboxChange(diff) {
  const changes = diff.trim().split(/\r?\n/).filter(Boolean);
  if (changes.length !== 1) {
    throw new Error('Esperado exatamente 1 arquivo adicionado no inbox; encontrados '+changes.length+'.');
  }
  const match = changes[0].match(inboxPattern);
  if (!match) throw new Error('O push precisa adicionar um único proposals/inbox/<commandId>.json, sem outros arquivos.');
  return { path: match[1], commandId: match[2] };
}

function main() {
  if (!process.env.GITHUB_EVENT_PATH) throw new Error('GITHUB_EVENT_PATH ausente.');
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  if (event.ref !== 'refs/heads/main') throw new Error('Somente push para main é permitido.');
  for (const sha of [event.before, event.after]) {
    if (typeof sha !== 'string' || !/^[0-9a-f]{40}$/i.test(sha)) throw new Error('SHA de evento GitHub inválido.');
  }
  const diff = execFileSync('git', [
    'diff', '--name-status', '--no-renames', event.before, event.after, '--'
  ], { cwd: root, encoding: 'utf8' });
  const selected = selectInboxChange(diff);
  const raw = readFileSync(join(root, selected.path), 'utf8');
  let proposal;
  try { proposal = JSON.parse(raw); }
  catch (error) { throw new Error('JSON da entrada inválido: '+error.message); }
  if (proposal?.commandId !== selected.commandId) {
    throw new Error('O commandId da proposta não corresponde ao nome do arquivo.');
  }
  writeFileSync(join(root, 'proposta.json'), raw, 'utf8');
  console.log('ERMO inbox: proposta '+selected.commandId+' preparada para validação oficial.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); }
  catch (error) { console.error('ERMO inbox bloqueado: '+error.message); process.exitCode = 1; }
}

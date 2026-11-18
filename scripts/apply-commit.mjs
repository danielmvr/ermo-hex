#!/usr/bin/env node
/** Valida JSON de IA antes de tocar o estado versionado. */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { applyProposal } from '../engine.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = process.argv[2];
const apply = process.argv.includes('--apply');
if (!file) {
  console.error('Uso: node scripts/apply-commit.mjs proposta.json [--apply]');
  process.exitCode = 1;
} else {
  try {
    const [world, proposal] = await Promise.all([
      readFile(path.join(root, 'world.json'),'utf8').then(JSON.parse),
      readFile(path.resolve(file),'utf8').then(JSON.parse)
    ]);
    const updated = applyProposal(world, proposal);
    console.log(`VALIDADO: revisão ${world.revision} -> ${updated.revision} | dia ${world.day} -> ${updated.day}`);
    console.log(`Posição: ${updated.player.position.q},${updated.player.position.r}`);
    console.log(`Ação: ${proposal.action.type} | ${proposal.commitMessage}`);
    if (apply) {
      await writeFile(path.join(root,'world.json'),JSON.stringify(updated,null,2)+'\n','utf8');
      console.log('APLICADO: world.json atualizado. Ainda não foi feito commit/push.');
    } else {
      console.log('DRY RUN: não houve alteração. Acrescente --apply para persistir.');
    }
  } catch (error) {
    console.error(`REJEITADO: ${error.message}`);
    process.exitCode=1;
  }
}

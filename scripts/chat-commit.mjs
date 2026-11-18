#!/usr/bin/env node
/** ERMO Chat-Commit: recebe JSON não confiável, valida, testa e commita world.json.
 * Uso: node scripts/chat-commit.mjs proposta.json [--dry-run] [--push]
 * Não interpreta comandos do JSON nem altera arquivos de código.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { applyProposal } from '../engine.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flags = args.filter(a => a.startsWith('--'));
const paths = args.filter(a => !a.startsWith('--'));
const knownFlags = new Set(['--dry-run', '--push']);

function run(command, params, { allowFailure = false } = {}) {
  const result = spawnSync(command, params, { cwd: root, encoding: 'utf8', shell: false, windowsHide: true });
  if (result.error) throw new Error(`${command}: ${result.error.message}`);
  if (result.status !== 0 && !allowFailure) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`${command} ${params[0] ?? ''} falhou (${result.status}): ${output.slice(0, 1600)}`);
  }
  return result;
}
function git(...params) { return run('git', params).stdout.trim(); }
function decodeProposal(text) {
  let cleaned = text.trim().replace(/^\uFEFF/, '');
  const fence = cleaned.match(/^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/i);
  if (fence) cleaned = fence[1].trim();
  try { return JSON.parse(cleaned); }
  catch (error) { throw new Error(`Resposta não é JSON válido: ${error.message}. Cole somente o objeto JSON, sem texto explicativo.`); }
}
async function main() {
  if (paths.length !== 1 || flags.some(f => !knownFlags.has(f)) || (flags.includes('--dry-run') && flags.includes('--push'))) {
    throw new Error('Uso: node scripts/chat-commit.mjs proposta.json [--dry-run | --push]');
  }
  // Validação de git sem tocar no estado. O arquivo da proposta deve ser ignorado pelo git.
  const gitRoot = git('rev-parse', '--show-toplevel');
  if (path.resolve(gitRoot) !== root) throw new Error('Execute dentro do repositório Git do ERMO.');
  const branch = git('branch', '--show-current');
  if (!branch) throw new Error('HEAD destacado: selecione uma branch antes de commitar.');
  const status = git('status', '--porcelain', '--untracked-files=normal');
  if (status) throw new Error(`Há alterações pendentes que não pertencem ao Chat-Commit. Repositório precisa estar limpo:\n${status.slice(0, 1200)}`);

  const [rawWorld, rawProposal] = await Promise.all([
    readFile(path.join(root, 'world.json'), 'utf8'),
    readFile(path.resolve(paths[0]), 'utf8')
  ]);
  const before = JSON.parse(rawWorld);
  const proposal = decodeProposal(rawProposal);
  const next = applyProposal(before, proposal);
  const newContent = JSON.stringify(next, null, 2) + '\n';
  console.log(`✅ VALIDADO: ${before.revision} → ${next.revision}; ação ${proposal.action.type}; branch ${branch}`);
  if (flags.includes('--dry-run')) {
    console.log('Prévia apenas: nenhum arquivo foi alterado.');
    return;
  }
  const stateFile = path.join(root, 'world.json');
  let committed = false;
  try {
    await writeFile(stateFile, newContent, 'utf8');
    run(process.execPath, ['--test', 'tests/engine.test.mjs']);
    git('diff', '--check');
    const modified = git('diff', '--name-only').split('\n').filter(Boolean);
    if (modified.length !== 1 || modified[0] !== 'world.json') throw new Error('Somente world.json pode ser alterado por uma interação.');
    git('add', '--', 'world.json');
    const staged = git('diff', '--cached', '--name-only').split('\n').filter(Boolean);
    if (staged.length !== 1 || staged[0] !== 'world.json') throw new Error('Índice Git contém arquivos não autorizados.');
    git('commit', '-m', proposal.commitMessage.trim(), '--', 'world.json');
    committed = true;
  } catch (error) {
    if (!committed) {
      await writeFile(stateFile, rawWorld, 'utf8');
      // Limpa apenas o arquivo que o agente colocou no índice.
      run('git', ['reset', '--quiet', 'HEAD', '--', 'world.json'], { allowFailure: true });
    }
    throw error;
  }
  const hash = git('rev-parse', '--short', 'HEAD');
  console.log(`✅ COMMIT LOCAL ${hash} | ${proposal.commitMessage.trim()}`);
  if (flags.includes('--push')) {
    // Falha de push NÃO desfaz o commit. Nunca afirmar publicação em caso de erro.
    git('push', 'origin', `HEAD:${branch}`);
    console.log(`✅ PUSH REALIZADO para origin/${branch}. Publicação do site depende do GitHub Pages.`);
  } else {
    console.log(`Para publicar, execute git push origin ${branch} (após configurar o remoto e conferir a branch).`);
  }
}
main().catch(error => { console.error(`❌ CHAT-COMMIT BLOQUEADO: ${error.message}`); process.exitCode = 1; });

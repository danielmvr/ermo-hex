import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const persistedRevision = JSON.parse(readFileSync(join(root, 'world.json'), 'utf8')).revision;
function invoke(dir, cmd, args, expected = 0) {
  const r = spawnSync(cmd, args, { cwd:dir, encoding:'utf8', shell:false });
  assert.equal(r.status,expected,`${cmd} ${args.join(' ')}: ${r.stdout} ${r.stderr}`);
  return `${r.stdout}\n${r.stderr}`;
}
function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'ermo-test-'));
  for (const f of ['engine.mjs','world-geography.mjs','world.json','.gitignore']) cpSync(join(root,f),join(dir,f));
  for (const f of ['scripts/chat-commit.mjs','tests/engine.test.mjs','tests/chat-commit.test.mjs']) {
    const dest=join(dir,f);
    mkdirSync(dirname(dest),{recursive:true});
    cpSync(join(root,f),dest,{recursive:false});
  }
  invoke(dir,'git',['init','-q']);
  invoke(dir,'git',['config','user.email','teste@exemplo.invalid']);
  invoke(dir,'git',['config','user.name','Teste ERMO']);
  invoke(dir,'git',['add','.']);
  invoke(dir,'git',['commit','-qm','inicio']);
  return dir;
}
function proposal(revision=persistedRevision) {
  return {schema:'ermo.action.v1',baseRevision:revision,commandId:'acao_integracao',movement:[],action:{type:'observar'},story:'O viajante contemplou o horizonte.',commitMessage:'mundo: observar horizonte'};
}
test('chat-commit: valida e grava um commit real só em world.json',()=>{
  const dir=sandbox();
  try {
    writeFileSync(join(dir,'proposta.json'),JSON.stringify(proposal()));
    const before=invoke(dir,'git',['rev-parse','HEAD']).trim();
    invoke(dir,'node',['scripts/chat-commit.mjs','proposta.json','--dry-run']);
    assert.equal(invoke(dir,'git',['rev-parse','HEAD']).trim(),before);
    invoke(dir,'node',['scripts/chat-commit.mjs','proposta.json']);
    const world=JSON.parse(readFileSync(join(dir,'world.json'),'utf8'));
    assert.equal(world.revision,persistedRevision + 1);
    assert.equal(world.events.at(-1).id,'acao_integracao');
    assert.equal(invoke(dir,'git',['show','--format=','--name-only','HEAD']).trim(),'world.json');
    assert.notEqual(invoke(dir,'git',['rev-parse','HEAD']).trim(),before);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
test('chat-commit: bloqueia proposta obsoleta sem modificar o estado',()=>{
  const dir=sandbox();
  try {
    writeFileSync(join(dir,'proposta.json'),JSON.stringify(proposal(persistedRevision + 99)));
    const before=readFileSync(join(dir,'world.json'),'utf8');
    const r=invoke(dir,'node',['scripts/chat-commit.mjs','proposta.json'],1);
    assert.match(r,/Revisão desatualizada/);
    assert.equal(readFileSync(join(dir,'world.json'),'utf8'),before);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
test('chat-commit: bloqueia repositório sujo',()=>{
  const dir=sandbox();
  try {
    writeFileSync(join(dir,'proposta.json'),JSON.stringify(proposal()));
    writeFileSync(join(dir,'world.json'),readFileSync(join(dir,'world.json'),'utf8')+'\n');
    const r=invoke(dir,'node',['scripts/chat-commit.mjs','proposta.json'],1);
    assert.match(r,/alterações pendentes/);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
test('chat-commit: aceita cerca Markdown JSON sem executar código',()=>{
  const dir=sandbox();
  try {
    writeFileSync(join(dir,'proposta.json'),`\`\`\`json\n${JSON.stringify(proposal())}\n\`\`\`\n`);
    invoke(dir,'node',['scripts/chat-commit.mjs','proposta.json','--dry-run']);
  } finally {rmSync(dir,{recursive:true,force:true});}
});

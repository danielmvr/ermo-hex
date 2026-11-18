import test from 'node:test';
import assert from 'node:assert/strict';
import { selectInboxChange } from '../scripts/select-inbox.mjs';

test('seleciona um único JSON adicionado com ID seguro', () => {
  assert.deepEqual(selectInboxChange('A\tproposals/inbox/acao_001-a.json\n'), {
    path: 'proposals/inbox/acao_001-a.json', commandId: 'acao_001-a'
  });
});

test('não permite alterações em outros arquivos no mesmo push', () => {
  assert.throws(() => selectInboxChange('A\tproposals/inbox/acao_001.json\nM\tengine.mjs\n'), /exatamente 1/);
});

test('rejeita substituição de proposta já existente', () => {
  assert.throws(() => selectInboxChange('M\tproposals/inbox/acao_001.json\n'), /adicionar um único/);
});

test('rejeita nomes malformados e travessia de diretórios', () => {
  for (const path of [
    'proposals/inbox/../engine.mjs',
    'proposals/inbox/acao 123.json',
    'proposals/inbox/a.json/../../world.json',
    'proposals/inbox/a.json.txt',
    'proposals/inbox/' + 'x'.repeat(65) + '.json'
  ]) {
    assert.throws(() => selectInboxChange('A\t' + path + '\n'), /adicionar um único/);
  }
});

test('rejeita push sem proposta e múltiplas propostas', () => {
  assert.throws(() => selectInboxChange(''), /exatamente 1/);
  assert.throws(() => selectInboxChange('A\tproposals/inbox/a.json\nA\tproposals/inbox/b.json\n'), /exatamente 1/);
});

test('prepara bytes originais sem mudar world.json em repositório real', async () => {
  const { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { spawnSync } = await import('node:child_process');
  const dir = mkdtempSync(join(tmpdir(), 'ermo-inbox-test-'));
  const sourceRoot = dirname(dirname(fileURLToPath(import.meta.url)));
  const git = (...args) => {
    const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
  };
  try {
    mkdirSync(join(dir, 'scripts'));
    copyFileSync(join(sourceRoot, 'scripts/select-inbox.mjs'), join(dir, 'scripts/select-inbox.mjs'));
    writeFileSync(join(dir, 'world.json'), '{"revision":0}\n');
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 'teste@exemplo.invalid');
    git('config', 'user.name', 'Teste');
    git('add', '.');
    git('commit', '-qm', 'initial');
    const before = git('rev-parse', 'HEAD');
    mkdirSync(join(dir, 'proposals/inbox'), { recursive: true });
    const raw = '{\n  "schema": "ermo.action.v1",\n  "commandId": "acao_001"\n}\n';
    writeFileSync(join(dir, 'proposals/inbox/acao_001.json'), raw);
    git('add', '.');
    git('commit', '-qm', 'proposal');
    const after = git('rev-parse', 'HEAD');
    const event = join(dir, 'event.json');
    writeFileSync(event, JSON.stringify({ ref: 'refs/heads/main', before, after }));
    const run = spawnSync(process.execPath, ['scripts/select-inbox.mjs'], {
      cwd: dir, encoding: 'utf8', env: { ...process.env, GITHUB_EVENT_PATH: event }
    });
    assert.equal(run.status, 0, run.stderr);
    assert.equal(readFileSync(join(dir, 'proposta.json'), 'utf8'), raw);
    assert.equal(readFileSync(join(dir, 'world.json'), 'utf8'), '{"revision":0}\n');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

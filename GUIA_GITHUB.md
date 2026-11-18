# ERMO | Habilitar GitHub, Chat-Commit e jogo online

## 1. Criar o repositório (etapa manual do proprietário)

1. Acesse https://github.com/new autenticado na conta `danielmvr`.
2. **Owner**: `danielmvr`; **Repository name**: `ermo-hex`.
3. **Visibility**: Public. Isso evita custos e limitações para Pages e deixa explícito que o estado do jogo não é secreto.
4. **Add a README file**: ativado, para criar a branch inicial `main`.
5. Confirme `Create repository`. Avise ao assistente que criou `https://github.com/danielmvr/ermo-hex`, para ele enviar os arquivos via GitHub conectado, caso a instalação tenha acesso ao novo repositório.

Se preferir enviar do computador em vez da conexão ChatGPT, veja `README.md` (opção terminal).

## 2. Habilitar GitHub Pages via Actions

1. Repositório → Settings → Pages.
2. Em `Build and deployment` → `Source`, selecione **GitHub Actions**.
3. GitHub Actions → workflow `ERMO | Publicar mundo` → `Run workflow` na branch `main` se não houve deploy inicial automático.
4. Após sucesso, o jogo deve ficar disponível em `https://danielmvr.github.io/ermo-hex/` (a URL real aparece nos detalhes do deploy, e pode levar um pouco para ser ativada).

**Não escolha `Deploy from a branch`**: commits feitos com `GITHUB_TOKEN` dentro de um workflow não disparam automaticamente outro workflow nem a publicação por branch no Pages. O próprio workflow Chat-Commit chama explicitamente o deploy Pages para contornar isso.

## 3. Habilitar escrita para o executor

O workflow `.github/workflows/chat-commit.yml` solicita `contents: write`. Se a execução responder `403` ou `Resource not accessible by integration`, verifique Settings → Actions → General → Workflow permissions / políticas de sua conta ou organização, além de regras de proteção da branch.

Não crie Personal Access Token nem o coloque no jogo. A ação usa o `GITHUB_TOKEN` de curta duração gerenciado pelo próprio GitHub, sujeito às permissões do workflow.

## 4. Fluxo do jogador até o commit

1. Abra o mapa hospedado; caminhe e digite até 100 caracteres.
2. Clique para abrir o ChatGPT com o prompt contextual; confira e envie caso necessário.
3. Copie o JSON devolvido.
4. Cole-o no chat com o prompt `CHAT_COMMIT_START.md`. **Com a automação integrada na `main`**, o agente cria `proposals/inbox/<commandId>.json` pela conexão GitHub; isso dispara o workflow automaticamente, sem abrir a aba Actions. Alternativa manual: `Actions → ERMO | Chat-Commit manual → Run workflow` e cole o JSON em `proposal_json`.
5. Aguarde o workflow validar a proposta, fazer commit em `world.json` e publicar Pages. Confirme o commit/revisão e o deploy antes da próxima ação; depois recarregue o mapa.

### Ativação e verificação do inbox automático

- Faça merge do PR de automação em `main`; a mera existência do código numa branch não habilita o gatilho.
- O Chat-Commit precisa poder criar **um novo arquivo** `proposals/inbox/<commandId>.json` diretamente na branch `main` usando a conexão GitHub autorizada. Não envie JSON se já houver outra ação em processamento.
- O workflow `ERMO | Chat-Commit manual` detecta o push pelo caminho, valida o único arquivo adicionado, faz testes e `--dry-run`, executa o motor oficial, cria o commit exclusivo de `world.json` e chama Pages. `ERMO | Publicar mundo` não publica diretamente o push de entrada.
- Verifique **Actions → ERMO | Chat-Commit manual**: conclusão de `commit-world` e `deploy`; confirme a nova revisão em `world.json` e no jogo. Rejeições deixam o arquivo de entrada no histórico, mas não aplicam uma ação no mundo.
- O repositório é público: não envie senhas, e-mails, tokens ou informações pessoais no JSON. Se um push pela conexão GitHub não acionar Actions, use o modo manual e confira permissões do aplicativo/instalação.

Para validar localmente, sem publicação:

```bash
node --test tests/*.test.mjs
node scripts/chat-commit.mjs proposta.json --dry-run
```

Para fazer commit e push a partir de um clone local autorizado:

```bash
node scripts/chat-commit.mjs proposta.json --push
```

**Importante:** o executor implementa consequências declarativas no mundo (`world.json`). Alterações de novas mecânicas e código-fonte requerem outra modalidade de trabalho com branch, testes e revisão. Não são aceitas diretamente de falas do jogador.

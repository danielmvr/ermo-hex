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
4. Cole-o no chat com o prompt `CHAT_COMMIT_START.md`, se tiver ferramenta de desenvolvimento conectada ao repositório. Ou abra `Actions → ERMO | Chat-Commit manual → Run workflow` e cole o JSON no campo `proposal_json`.
5. Após commit e deploy concluídos, recarregue o mapa.

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

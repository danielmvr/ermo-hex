# ERMO | Experimento Hex + Chat-Commit

**Uma pessoa. Um mundo hexagonal. Cada interação confirmada vira um commit.**

Experimento para navegador, sem API paga: um jogador explora 91 hexágonos e envia mensagens de até 100 caracteres ao ChatGPT. Uma segunda IA ou um workflow do GitHub recebe a resposta JSON, valida a ação, altera `world.json`, faz commit e publica o novo estado.

## Início rápido

**Local (Windows)**: execute `iniciar-windows.bat` com Python instalado ou `py -m http.server 8000`, e abra `http://localhost:8000`.

**GitHub online**: confira [GUIA_GITHUB.md](GUIA_GITHUB.md). Crie o repositório `danielmvr/ermo-hex`, envie estes arquivos, habilite `Settings → Pages → Source: GitHub Actions` e rode `ERMO | Publicar mundo`. A página esperada será `https://danielmvr.github.io/ermo-hex/` depois da publicação bem-sucedida.

**Agente Chat-Commit**: use o prompt completo em [CHAT_COMMIT_START.md](CHAT_COMMIT_START.md) como primeira mensagem de uma conversa com uma IA que disponha de ferramentas de programação e GitHub. A partir daí, cole diretamente as respostas JSON do chatbot do jogo.

## Fluxo para a primeira interação

1. Entre no mapa, clique em hexágonos adjacentes para caminhar (lagos não são atravessáveis).
2. Escreva a intenção do jogador em até 100 caracteres.
3. Clique em **Conversar com a inteligência**. O navegador abre `https://chatgpt.com/?q=...` com o contexto embutido. Dependendo da interface, confira o texto e pressione Enter. Há também **Copiar contexto completo**.
4. O primeiro ChatGPT deve responder com **JSON puro**. Copie a resposta inteira.
5. Cole no **Chat-Commit** conectado ao GitHub. Depois de ativada a automação, o agente cria `proposals/inbox/<commandId>.json` na `main` e o workflow inicia automaticamente. Alternativa manual: no GitHub, `Actions → ERMO | Chat-Commit manual → Run workflow`; cole JSON em `proposal_json` e execute.
6. Aguarde o sucesso do workflow de commit e publicação. Clique em **↻ Recarregar** no jogo. O novo estado vem do `world.json` versionado.

> O código de atualização do mundo já está pronto. A sincronização via GitHub e a URL pública dependem da criação do repositório e da configuração de Pages. Não foi instalada nenhuma API paga.

## Contrato JSON da IA interpretativa

```json
{
  "schema": "ermo.action.v1",
  "baseRevision": 0,
  "commandId": "acao_demo_001",
  "movement": [],
  "action": { "type": "coletar", "resource": "madeira", "amount": 2 },
  "story": "O viajante recolheu dois feixes de madeira.",
  "commitMessage": "mundo: recolher madeira"
}
```

`baseRevision`, `commandId` e `movement` têm de ser copiados do contexto emitido pelo mapa. O agente não pode inventá-los. O schema aceita uma ação por commit:

| Tipo de ação | Parâmetros | Regra |
|---|---|---|
| `coletar` | `resource`: `madeira`, `pedra` ou `alimento`; `amount`: 1 a 3 | Não exceder os recursos do hexágono |
| `construir` | `structure`: `abrigo`, `fogueira`, `marco` ou `horta` | Consumir materiais da mochila |
| `nomear` | `name`: nome de 1 a 36 caracteres | Nomeia local atual |
| `observar` | nenhum | Cria evento sem alterar recursos |

Custos: abrigo 3 madeira + 1 pedra; fogueira 1 madeira + 1 pedra; marco 2 pedra; horta 1 madeira + 1 alimento (apenas campina ou floresta). Toda ação confirmada avança uma revisão e um dia. `world.json` é a verdade canônica: a fala do jogador não altera arquivos nem regras por si só.

## Chat-Commit em ambiente local com Git

O script `scripts/chat-commit.mjs` impede alterações fora de `world.json`. Requer Node.js 22+ e Git configurado, diretório limpo e repositório inicializado:

```bash
# Executa todos os testes
node --test tests/*.test.mjs

# Verifica a proposta sem alterações
node scripts/chat-commit.mjs proposta.json --dry-run

# Valida, modifica world.json, testa, commita e publica no remoto
node scripts/chat-commit.mjs proposta.json --push
```

Ele rejeita JSON malformado, schema diferente, revisões obsoletas, IDs duplicados, movimentos impossíveis, recursos insuficientes, propriedades extras e repositórios sujos. `proposta.json` está ignorado em `.gitignore`. Em caso de erro antes do commit, restaura `world.json` original. Se falhar somente o push, o commit local permanece e a publicação não deve ser anunciada como concluída.

## Automação GitHub Actions

- `ci.yml`: roda testes na subida normal de arquivos e em Pull Requests.
- `chat-commit.yml`: entrada manual por `proposal_json` **ou** gatilho de novo arquivo `proposals/inbox/*.json`; validação, commit automático e chamada explícita do deploy.
- `pages.yml`: publica **somente** os cinco arquivos públicos construídos em `dist/`, ignorando pushes que apenas enviam JSON ao inbox (antes de o mundo ser validado).

O uso de Pages por `GitHub Actions` é importante: commits criados pelo `GITHUB_TOKEN` dentro do workflow não provocam automaticamente um deploy por gatilho `push`. Por isso o Chat-Commit chama o publicador diretamente.

## Estrutura

| Arquivo | Função |
|---|---|
| `index.html`, `styles.css`, `app.mjs` | Interface, mapa, movimentação e conversa |
| `engine.mjs` | Regras determinísticas compartilhadas |
| `world.json` | Mundo canônico persistente |
| `scripts/chat-commit.mjs` | Validação, testes, commit e push |
| `scripts/apply-commit.mjs` | Validação e aplicação sem Git (ferramenta auxiliar) |
| `scripts/select-inbox.mjs` | Verifica um único JSON novo recebido via GitHub e prepara `proposta.json` sem executar texto |
| `scripts/build-site.mjs` | Prepara conteúdo seguro para Pages |
| `tests/*.test.mjs` | Testes do motor e do Chat-Commit |
| `CHAT_COMMIT_START.md` | Prompt pronto para o agente executor |
| `GUIA_GITHUB.md` | Passo a passo de publicação |
| `.github/workflows/*.yml` | CI, commit manual e Pages |

## Entrada automática pelo GitHub (após mesclar o PR de automação)

O Chat-Commit com conexão GitHub pode receber um JSON válido e criar **somente** um arquivo novo em `proposals/inbox/<commandId>.json`, diretamente na branch `main`, usando a API de arquivos do GitHub. Essa é uma entrada pública e auditável, **não é um commit de mundo**: a revisão só muda após o motor oficial validar a proposta no workflow.

O push desse arquivo dispara `ERMO | Chat-Commit manual` automaticamente; o workflow confere que **exatamente um JSON foi adicionado**, que o nome coincide com `commandId`, executa todos os testes, faz `--dry-run`, usa `scripts/chat-commit.mjs --push` para alterar **somente** `world.json` e, após sucesso, chama Pages. Se o JSON for rejeitado ou o push falhar, o workflow falha e não publica uma consequência nova. O JSON enviado permanece no histórico do repositório, inclusive se for rejeitado.

Use uma interação por vez: **confirme o commit e o deploy antes de enviar outra proposta**; não tente reutilizar `commandId`. O GitHub pode enfileirar execuções, mas a validação de `baseRevision` sempre protege a versão canônica. Não inclua dados pessoais, tokens ou segredos, já que o repositório é público. A automação exige que a conexão GitHub disponha de escrita em arquivos, que o push dessa conexão dispare Actions e que o `GITHUB_TOKEN` tenha `contents: write`. Caso não esteja ativo, use o `workflow_dispatch` manual.

## Limites da prova de conceito

- Um jogador, nenhum bot e nenhuma IA em execução contínua no servidor.
- Movimento e descoberta ficam **locais e pendentes** até que uma proposta seja validada e commitada.
- O mapa gerado contém regiões desconhecidas que não são enviadas no prompt da primeira IA.
- O chatbot recebe somente contexto textual e devolve uma ação declarativa. **Não recebe permissão para escrever JavaScript ou modificar as próprias regras do jogo.** Implementação de novas funcionalidades de software exige uma tarefa de desenvolvimento separada, com testes e revisão.
- Não coloque dados pessoais ou segredos em mensagens, URL `?q=` ou estado público.

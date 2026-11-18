# ERMO | Mundo persistente + Chat-Commit v0.3

**Um personagem, mapa hexagonal, energia e dias acionados pelo descanso.**

Jogo público: https://danielmvr.github.io/ermo-hex/
Repositório: https://github.com/danielmvr/ermo-hex

## Persistência em duas camadas

1. **Autosave no navegador:** posição, hexágonos descobertos/visitados, energia, descansos e diálogo ficam salvos automaticamente em `localStorage`. Atualizar ou fechar a aba **no mesmo navegador/perfil** preserva a jornada pendente. O jogo também guarda a última versão de `world.json` para uso offline.
2. **Mundo oficial online:** `world.json` no GitHub é a fonte de verdade, publicada no GitHub Pages. Para sincronizar a jornada com outros dispositivos, é obrigatório confirmá-la pelo Chat-Commit. Não existe token GitHub no navegador nem endpoint público de escrita. O navegador não publica commits sozinho.
3. Após commit, o jogo encontra o `commandId` no histórico, limpa o rascunho correspondente e carrega posição/dia/energia da nova revisão. Se o GitHub avançar por outro commit, o rascunho não é forçado sobre a revisão nova; é movido para backup local de conflito.

**Atenção:** limpar dados do site, usar outro navegador/dispositivo ou navegar anonimamente pode apagar o rascunho. Apenas commits confirmados são persistência global. Este é o próximo limite técnico para uma futura integração com backend autenticado.

## Energia e calendário

- Energia máxima: **12**. Cada hexágono caminhado consome **1**.
- Ações interpretadas: coletar **1**, construir **2**, nomear **1**, observar **0** pontos.
- Em **energia 0**, o botão **Descansar · +1 dia** é habilitado. Descansar restaura para 12 e **avança exatamente um dia**.
- Caminhar, conversar e confirmar ações **não** avançam o calendário por si só.
- Máximo de **60 eventos** de caminhada/descanso por jornada ainda não confirmada; registre um commit para continuar.
- Mundos criados antes da energia carregam com **12/12** sem perder o estado existente; a energia é gravada no próximo commit.

## Como jogar e registrar uma jornada

1. Abra o mapa e caminhe clicando em hexágonos vizinhos. O progresso é salvo no navegador a cada passo.
2. Quando a energia atingir zero, use **Descansar**. O dia avança na prévia local, e sobreviverá ao refresh.
3. Para persistir a movimentação e os descansos **sem diálogo**, clique em **Copiar jornada para Chat-Commit**. O botão cria uma proposta `ermo.action.v2` com `journey` e ação `observar`.
4. Para interagir com a IA, digite até **100 caracteres**, clique em **Conversar com a inteligência**, confira e envie o contexto no ChatGPT. A resposta deve ser um objeto JSON `ermo.action.v2`.
5. Entregue o JSON ao agente preparado com [CHAT_COMMIT_START.md](CHAT_COMMIT_START.md), ou abra [ERMO | Chat-Commit manual](https://github.com/danielmvr/ermo-hex/actions/workflows/chat-commit.yml) → **Run workflow** → `proposal_json`.
6. Após os workflows de commit e publicação concluírem, clique **↻ Recarregar** no jogo. O navegador reconcilia o rascunho com o mundo remoto.

## Contrato do ChatGPT v0.3

```json
{
  "schema": "ermo.action.v2",
  "baseRevision": 1,
  "commandId": "acao_exemplo_001",
  "journey": [
    { "type": "mover", "q": 4, "r": 0 },
    { "type": "descansar" }
  ],
  "action": { "type": "observar" },
  "story": "O viajante observou a paisagem após descansar.",
  "commitMessage": "mundo: registrar exploração e descanso"
}
```

O exemplo acima é **ilustrativo**, não uma proposta executável no estado atual. `baseRevision`, `commandId` e `journey` devem ser copiados **exatamente** do contexto gerado no jogo. O motor recalcula deslocamento, gasto de energia, dias e recursos. A IA nunca dita diretamente os valores resultantes.

Propostas legadas `ermo.action.v1` continuam aceitas, mas sem a capacidade de representar descansos entre passos. Versão atual: `v2`.

## Comandos e arquivos

```bash
node --test tests/*.test.mjs
node scripts/chat-commit.mjs proposta.json --dry-run
node scripts/chat-commit.mjs proposta.json --push
```

O executor exige Git limpo, bloqueia revisão obsoleta, teletransporte, descanso com energia positiva, gastos indevidos e recursos inexistentes. Apenas `world.json` pode ser alterado por uma ação do jogador.

- `engine.mjs`: regras e validação de propostas `v1/v2`.
- `persistence.mjs`: cache remoto, autosave, restauro e reconciliação.
- `app.mjs`, `index.html`, `styles.css`: mapa, UI de energia/descanso e ChatGPT.
- `world.json`: estado canônico versionado; **não reinicializar em deploys**.
- `scripts/chat-commit.mjs`: validador + Git commit/push.
- `.github/workflows/chat-commit.yml`: entrada manual e publicação.
- `tests/*.test.mjs`: testes de motor, Git e persistência.

Este protótipo tem somente um jogador e nenhum bot. Nenhuma credencial ou API paga é exposta no cliente.
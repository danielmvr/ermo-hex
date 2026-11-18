# ERMO | Mundo persistente + Chat-Commit v0.4

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

## Camada reativa do mundo (v0.4)

A IA que interpreta a fala continua produzindo o JSON de ação `ermo.action.v2`. **O agente Chat-Commit, como Júri, Juiz e Executor, pode decidir autonomamente se o mundo reage** antes de gravar o commit. Se decidir reagir, ele converte a proposta validada para `ermo.action.v3`, acrescentando uma reação em intensidade `sutil`, `media` ou `alta`.

- **Sutil:** resposta narrativa, silêncio ou presságio.
- **Média:** bênção, revés, revelação limitada ou veto de uma ação, sem afetar a rota.
- **Alta:** efeitos mais intensos e possibilidade de criar uma **manifestação persistente** no hexágono atual, marcada com ✧ no mapa.

A escolha e o veredito (`conceder`, `negar`, `surpreender`) pertencem ao agente, **não ao jogador**. O motor determina os efeitos permitidos, limita recursos e energia, preserva os passos e registra a reação em `world.json`. Propostas antigas `v1/v2` continuam válidas sem reação. Mudanças de regras maiores podem ser desenvolvidas em branch separada com testes e PR, nunca por código escondido em texto de jogador.

Leia o contrato, os efeitos e os limites em [REACOES_DIVINAS.md](REACOES_DIVINAS.md).

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

- `engine.mjs`: regras, validação de propostas `v1/v2/v3` e consequências divinas.
- `persistence.mjs`: cache remoto, autosave, restauro e reconciliação.
- `app.mjs`, `index.html`, `styles.css`: mapa, UI de energia/descanso e ChatGPT.
- `world.json`: estado canônico versionado; **não reinicializar em deploys**.
- `scripts/chat-commit.mjs`: validador + Git commit/push.
- `.github/workflows/chat-commit.yml`: entrada manual e publicação.
- `tests/*.test.mjs`: testes de motor, Git e persistência.

Este protótipo tem somente um jogador e nenhum bot. Nenhuma credencial ou API paga é exposta no cliente.
## Mundo Vivo v0.5: 10.981 hexágonos

O atlas é determinístico por seed, com raio 60: 4.392 células terrestres, 299 de água doce e 6.290 oceânicas.
Há quatro continentes, seis arquipélagos (18 ilhas separadas), 12 biomas, oito culturas de referência,
36 espécies de fauna, 60 de flora, 62 sítios singulares e 300 vestígios regionais.

### Preservação e armazenamento
- Os 91 hexágonos originais de raio 5 são preservados, inclusive os dados de progresso e dias.
- Não salvamos as 10.981 células no world.json: a geografia é regenerada pelo gerador world-geography.mjs.
- Apenas células reveladas/alteradas e descobertas comprovadas passam a constar no estado persistente.
- O mapa-múndi revela somente o que o Viajante descobriu, sem antecipar segredos.
- A primeira navegação exige jangada de 5 madeiras e 1 pedra, construída junto à água;
  navegação consome 2 energias por passo, enquanto caminhar custa 1.

### Povos, flora e fauna
As culturas são referências territoriais e arqueológicas, não NPCs. Espécies são catálogos de
habitats potenciais, não indivíduos simulados. Ruínas, relíquias e mistérios têm coordenadas estáveis
e só se tornam descobertas do jogador após visitas reais.

Testes: node --test tests/*.test.mjs. Publicação: node scripts/build-site.mjs.

## ChatGPT: contexto oficial por URL (v0.5.1)

O link **Conversar com a inteligência** transmite somente a fala (até 100 caracteres), a jornada local com `baseRevision` e `commandId`, e o endereço do [WORLD_CONTEXT.md](WORLD_CONTEXT.md). O mundo, suas regras, inventário, terrenos revelados e acontecimentos ficam no Markdown oficial, não na URL. O ChatGPT precisa abrir esse arquivo antes de interpretar a intenção. Caso a plataforma não consiga acessar o link, deve pedir o conteúdo em vez de adivinhar.

O arquivo é regenerado e versionado **no mesmo commit de world.json** pelo `scripts/chat-commit.mjs`. Ao aplicar uma proposta manual via `scripts/apply-commit.mjs --apply`, ambos também são atualizados. `node scripts/world-context.mjs --check` detecta divergência. O GitHub Pages publica uma cópia do Markdown.

O botão é um link HTML nativo com destino preparado antecipadamente (antes do clique). O preenchimento automático por `?q=` depende do comportamento do ChatGPT no navegador; caso seja bloqueado, use **Copiar contexto completo** e cole manualmente.

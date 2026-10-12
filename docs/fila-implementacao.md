# Fila de implementação

Fila do loop de correção/implementação. Um item por vez, em ordem; cada item
concluído tem typecheck, lint e testes passando e um commit no `main`.

- [x] 1. Commitar o trabalho existente em blocos lógicos
- [x] 2. Identidade da ROM por hash + ID de aventura, com migração por renomeação
- [x] 3. Scanline só na tela do jogo; erro de gravação visível em `legacyAdventures`; guias fora do `localStorage`
- [x] 4. Aventura ativa compartilhada entre Aventuras, Ginásios, Ajuda e Planejar batalhas
- [x] 5. Redesenho da biblioteca e do palco, quebrando a `PlayPage`
- [x] 6. Resumo "Onde parei?"
- [x] 7. Cápsula de backup completa da aventura
- [x] 8. Dados essenciais offline, sem depender da PokéAPI
- [x] 9. Diário automático ilustrado
- [x] 10. Laboratório do time
- [x] 11. Preparação para o próximo líder
- [x] 12. Guia com dicas em três níveis
- [x] 13. Álbum da jornada
- [x] 14. Modo desafio
- [x] 15. Ramificações de aventura
- [x] 16. Mapa de progresso
- [x] 17. Ginásios, dano e comparação para Gen 1/2
- [x] 18. Leitores de save: validar com saves reais (só leitura), nível no PC de Gen 1, Gen 2 japonesa e coreana — falta só save real de Gen 1/2, ver notas
- [x] 19. CI no GitHub
- [x] 20. Renomear os caches `pokedex-*` do service worker sem perder dados
- [x] 21. Assinatura digital do `.exe` (depende de certificado: documentar o que falta)

## Notas por item

### 2. Identidade da ROM

- `pokedex:rom-identity` guarda, por nome de arquivo, o SHA-256, o ID da
  aventura, o tamanho e a origem (pasta `roms/` ou seletor).
- Renomear um arquivo da pasta `roms/` leva junto diário, favoritos, fichas,
  histórico, save de bateria, pontos de retorno, miniaturas e capturas.
- Duas cópias do mesmo arquivo são duas aventuras; nada é fundido pelo hash.
- Os outros registros continuam indexados pelo nome do arquivo. Trocar a chave
  deles para o ID da aventura fica para quando houver mais de uma campanha por
  ROM (item 15).
- Pelo seletor, sem pasta, o mesmo arquivo com outro nome entra como cópia: a
  cópia antiga continua na biblioteca do navegador, então não há como saber
  que foi renomeado.
- Não conferido no navegador com uma ROM de verdade: carregar uma dispara o
  backup em `saves/`, que o loop não pode alterar. Coberto por testes com core
  e armazenamento falsos.

### 3. Correções pequenas

- A scanline passou a ser desenhada só sobre a tela do jogo.
- A ficha de Gen 1/2 que não cabe no armazenamento agora gera aviso.
- O texto dos detonados foi para o IndexedDB (banco `pokemu`, store
  `guides`); no `localStorage` ficam título, fonte e tamanho. Guias antigos
  migram sozinhos ao abrir o site, e o texto entra no backup num campo próprio.

### 4. Aventura ativa

- `pokedex:active-adventure` guarda a ROM; a navbar mostra qual é.

### 5. Biblioteca e palco

- A `PlayPage` (1.317 linhas) virou o hook `usePlayPage` e quatro
  componentes em `src/pages/play/`.
- Biblioteca: faixa de retomada no topo no lugar do bloco de apresentação
  (que agora só aparece sem jogos), cartucho na cor da edição oficial e
  progresso lido do save no card.
- Palco vazio: botões para abrir a biblioteca ou adicionar um arquivo.
- Segunda rodada: em tela de 1100 px ou mais a navegação vai para um trilho
  lateral; a moldura do emulador ficou baixa (a tela do jogo ganhou altura); o
  painel lateral pode ser recolhido ("Só o jogo"), e a escolha fica guardada.
- Tokens: raio, espaçamento e altura de controle passam a ter nome em
  `tokens.css`; a carcaça e os cartuchos deixaram de repetir cores soltas; e
  `styles/ui.css` define uma vez o painel com título, o formulário de uma
  linha e a lista com remover, que cinco telas repetiam.
- Conferido por medidas no navegador em 1366, 1000 e 375 px (sem estouro
  horizontal). **Não foi visto em imagem**: a captura de tela do navegador de
  teste falhou, então vale uma olhada sua.

### 12. Dicas em três níveis

- O que as dicas dizem sobre os **times dos líderes** (espécies, tipos, golpes
  marcantes) foi conferido contra `data/gymLeaders.ts`, que vem das
  decompilações. O **caminho** entre os ginásios (quem dá qual item, por onde
  passar) foi escrito de memória e não tem fonte primária no projeto.

### 17. Gen 1/2 nas ferramentas

- Os dados de Gen 1 e Gen 2 são gerados das decompilações (pret/pokered,
  pret/pokeyellow, pret/pokecrystal) por `npm run catalog:legacy`: espécies,
  golpes, tabela de tipos e times dos líderes. Nada escrito de memória.
- Guia de ginásios: Red/Blue, Yellow e os dezesseis líderes de
  Gold/Silver/Crystal, cada geração com a sua tabela de tipos. Os times de
  Johto da primeira rodada, transcritos de memória, foram conferidos contra o
  arquivo: batiam.
- Cálculo de dano de Gen 1 e Gen 2 em "Planejar batalhas", com as fórmulas
  das decompilações.
- Comparação de dois saves de Gen 1 ou Gen 2.
- A conferência cruzada achou um erro antigo: o catálogo de Gen 3 e a leitura
  da PokéAPI usavam os status base de hoje. Trinta espécies foram reforçadas
  depois da Gen 3; agora os dois aplicam `past_stats`.

Limites que continuam:
- Os times de GSC vêm da Crystal; Gold e Silver podem diferir em detalhe.
- O cálculo de dano não inclui estágios de status, itens, bônus de insígnia
  nem golpes de dano fixo. O alvo é uma suposição declarada na tela.
- Ruby/Sapphire seguem sem guia de ginásios.

### 18. Leitores de save

Feito:
- Os dois saves reais de `saves/` foram lidos, sem alteração (o hash dos
  arquivos é o mesmo antes e depois): Emerald (ZE, Mudkip nv 8, ₽3.300,
  0h45) e LeafGreen (LG, Bulbasaur nv 5, ₽3.000, 0h05). Os dois passam no
  leitor de Gen 3, e `gen3Real.test.ts` passa com o save de Emerald.
- O nível dos pokémon no PC de Gen 1 agora sai da experiência, pela curva da
  espécie. A conta bate com o nível gravado no time dos dois saves reais.

- Gen 2 japonesa (Gold/Silver/Crystal) e Gold/Silver coreana ganharam
  leitor, com os offsets de `SAV2Offsets` do PKHeX. A coreana é reconhecida
  pelo checksum. Os nomes em coreano não são decodificados.

Depende de você:
- **Não há save real de Gen 1 nem de Gen 2** em `saves/`, de nenhuma edição.
  Esses leitores — os internacionais, os japoneses e o coreano — continuam
  validados só por fixtures. Para fechar: jogar e salvar dentro do jogo e
  rodar `npm run save:check -- "<rom>" "<save>"`.

### 19. CI

- `.github/workflows/ci.yml`: typecheck, lint, testes, teste do desktop e
  build a cada push e pull request no `main`. Só roda depois do primeiro push.

### 20. Caches do service worker

- Os caches passam de `pokedex-*` para `pokemu-*`. Na primeira ativação, os
  sprites e as respostas da PokéAPI já guardados são copiados para os nomes
  novos antes de os antigos serem apagados.
- As chaves `pokedex:` do `localStorage` **não** foram renomeadas: é onde
  estão o diário, as fichas e o histórico, e trocar o prefixo exigiria migrar
  os dados de todo mundo sem ganho para quem usa.

### 21. Assinatura do executável

- Documentado em `docs/assinatura-windows.md`. Depende de um certificado.

## Dúvidas para o usuário

O que sobrou depende só de você:

- **Saves reais de Gen 1 e Gen 2** para validar os leitores (item 18).
- **Certificado de assinatura de código** para o `.exe` (item 21, ver
  `docs/assinatura-windows.md`).
- **Olhar o redesenho** (trilho lateral, moldura menor, painel recolhível):
  foi conferido por medidas, não por imagem.
- **Tabela de nomes em coreano**, se você tiver uma Gold/Silver coreana e
  quiser ver os nomes: precisa de uma fonte com licença compatível.

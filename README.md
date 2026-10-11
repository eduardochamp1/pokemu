# Pokemu

Emulador de Game Boy, Game Boy Color e Game Boy Advance no navegador, com as
suas ROMs — e tudo o que dá para ler do save: a ficha do treinador, o time, o
PC, o guia de ginásios e a calculadora de dano.

Nasceu como a aba `/jogar` da [Pokédex](https://github.com/eduardochamp1/Pokedex)
e saiu para um projeto próprio em outubro de 2026. O histórico do git veio junto.

## ✨ Funcionalidades

### Emulador (`/`)
Emulador **Game Boy, Game Boy Color e Game Boy Advance** rodando no navegador,
via [mGBA](https://mgba.io) compilado para WebAssembly.

- **Sem ROM embutida.** Você carrega o seu próprio arquivo — por seletor, por
  arrastar-e-soltar, ou deixando em `roms/` (veja abaixo). Subpastas funcionam:
  `roms/gba/`, `roms/gbc/` etc.
- **Saves persistentes** — o core monta IDBFS, então save de bateria, save
  states e as próprias ROMs enviadas ficam no IndexedDB do navegador e
  sobrevivem a recarregar a página
- **Continuidade** — sair para outra página e voltar mantém o jogo rodando, no
  mesmo ponto. Recarregar a página recarrega a última ROM sozinho; "Fechar jogo"
  é como dizer que não a quer de volta
- **6 slots de save state** que mostram o que têm — a **imagem** do momento
  gravado, há quanto tempo, e um botão para apagar. Os estados são por ROM: os
  slots de um jogo não aparecem em outro
- **"Continuar de onde parou"** — o core já capturava um estado automático a
  cada 30 s; agora ele tem um botão em vez de ser descartado
- **Atalhos** — F1–F6 carregam um estado, Shift+F1–F6 gravam, segurar Espaço
  dá turbo e segurar R rebobina, enquanto durar
- **Biblioteca gerenciável** — cada ROM mostra quanto ocupa e pode ser removida;
  o save de bateria fica, então o progresso volta se a ROM voltar
- **Backup automático em `saves/`** no disco, mais exportar/importar `.sav`
- **Tela cheia e escala inteira** — cada pixel do console vira exatamente N
  pixels na tela. Esticar com `object-fit` dava escala fracionária, e o
  arredondamento deixava uns pixels com 3 px de lado e outros com 4
- **Sabe que jogo é** — o cabeçalho do cartucho é lido no carregamento e a tela
  diz "base: Emerald · Geração III" além do nome do arquivo
- **Ligada ao resto do site** — com um jogo rodando, três links levam à dex
  daquela geração, à região no mapa e à geração na lore
- **Galeria de capturas** por jogo, com miniatura, data, baixar de novo e
  apagar — antes o PNG ficava no FS para sempre e a cota crescia invisível
- **Seu time, lido do save** — o save de bateria de Gen 3 é interpretado e o
  time aparece com as **mesmas cartas** da Pokédex, com apelido e nível. É onde
  o emulador deixa de ser ilha e vira fonte de dados do site
- **Sua dex, lida do save** — os bits de visto e capturado (seção 0, `0x5C` e
  `0x28`, medidos num save real de Emerald) vão para o `localStorage` a cada
  gravação, e a Pokédex da Home passa a saber o que você já pegou sem carregar
  o core
- **Ficha de cada pokémon do time** — natureza (com o que sobe e desce), IVs,
  EVs, status, golpes com PP, amizade, shiny e a habilidade **de Gen 3** (o
  Gengar de Gen 3 tem Levitate, não Cursed Body). Os offsets foram medidos num
  Mudkip real, e os seis status que o jogo gravou fecharam com a fórmula de
  `lib/gen3Stats` aplicada ao que foi lido
- **Gamepad virtual** para toque, **gamepad físico** pela Gamepad API (layout
  standard) e **teclas remapeáveis** — clique numa tecla da legenda e pressione
  a nova. A legenda lê do mesmo mapa que o `bindKey`, então não mente
- **Rebobinar** — segure o botão (ou a tecla R) e o jogo anda para trás, até ~10 s
- **Captura de tela** em PNG, com download
- **Volume**, **barra de velocidade** de 1× a 10× (lembrada entre visitas) e
  turbo de 10× ao segurar Espaço — no toque, um botão de turbo no lugar da tecla
- **Diagnóstico** quando falta isolamento: a página diz exatamente qual header
  está ausente em vez de falhar em silêncio

#### Onde os saves ficam — e o que é garantido
Duas camadas, e a página mostra o estado real das duas:

| Camada | Durabilidade |
|---|---|
| **Pasta `saves/` no disco** | Forte. Backup automático a cada gravação do jogo, mais botão manual. Arquivo comum: copie para levar embora. Só em dev/preview. |
| **IndexedDB do navegador** | Sobrevive a recarregar e a fechar o navegador — mas o navegador pode descartar sob pressão de disco, e "limpar dados do site" apaga. É por navegador e por perfil. |

O app pede `navigator.storage.persist()` no carregamento, que isentaria a origem
do descarte automático — mas o Chrome costuma **negar** em site sem engajamento
(medido: retorna `false` em `localhost`). Por isso o espelho em disco existe: é
o que não depende de política de navegador. A página diz qual das duas está
valendo, com o uso atual em bytes.

Para levar progresso para outra máquina: copie o `.sav` da pasta `saves/`, ou
use **Exportar .sav** na barra lateral.

#### Sua pasta `roms/`
Largue os `.gb`/`.gbc`/`.gba` em `roms/` e eles aparecem na biblioteca sem
precisar selecionar arquivo toda vez. Essa pasta é **ignorada pelo git**, e o
plugin `vite-plugin-local-roms.ts` só a serve em `dev` e `preview` — ela não
tem hook de build, então **não vai para `dist/`**. Os arquivos ficam na sua
máquina, e um deploy acidental não os leva.

#### Detalhes de implementação que custaram caro
- **O core sai do pre-bundle do Vite** — `optimizeDeps.exclude` em
  `vite.config.ts`. Sem essa linha nada do emulador funciona, e a falha é
  silenciosa: o `mgba.js` é glue do Emscripten que sobe o worker de pthread a
  partir da URL do próprio script e resolve o `.wasm` relativo a ela; o
  pre-bundle do esbuild reescreve o módulo e o move, quebrando as duas
  resoluções. Com o `exclude`, o `import()` normal do pacote basta — é o que
  o **gbajs3** faz, e ele roda este mesmo core em produção.
- **O core é carregado sob demanda** (`await import("@thenick775/mgba-wasm")`
  dentro de `getCore`). São ~2 MB entre glue e wasm; quem abre a Pokédex para
  ver um Pokémon não os baixa.
- **O canvas e o core são singletons da sessão**, criados fora da árvore do
  React. O core é amarrado ao canvas na criação, então um canvas novo (StrictMode
  remonta em dev; navegar para fora e voltar remonta sempre) deixaria o core
  preso no antigo. A página só adota o canvas no container dela.
- **O ponto automático não é aplicado sozinho ao recarregar a página.**
  `loadAutoSaveState` recusa logo depois de um `loadGame` — medido no browser:
  pelo botão da tela, com o jogo já rodando, funciona; na mesma volta do
  carregamento devolve `false`, e continua devolvendo mesmo repetindo por
  segundos. Mesma família do problema de `saveState`/`loadState` abaixo. Então a
  ROM volta sozinha e quem decide retomar é quem joga, no botão — que o aviso
  aponta.
- **Um efeito que dependa do objeto do hook se auto-cancela.** O retorno de
  `useEmulator` é um objeto novo a cada render; com ele na lista de dependências,
  a limpeza do efeito roda a cada renderização. No turbo isso significava ligar e
  desligar no mesmo instante — a tecla nunca pegava. As dependências são as
  funções avulsas, cada uma estável por si.
- **Remapear precisa desvincular, e a API pública não tem isso.** O core guarda
  tecla → ação, então só reescrever o mapa deixaria a tecla antiga disparando em
  paralelo com a nova. Sem função de desvincular exposta, o caminho é o `cwrap`
  cru: `bindKey(tecla, -1)`, um índice que não casa com nenhuma ação. Conferido
  no browser com o jogo rodando — depois de mover Start para outra tecla, Enter
  parou de avançar a tela de título. O acesso ao `cwrap` fica isolado numa
  função só, porque a tipagem publicada do core não o declara.
- **Teclas vêm de `KeyboardEvent.code`, com `key` como recuo.** `code` é a tecla
  física e não muda com o layout — é o que corresponde ao que a pessoa memoriza,
  a posição. Mas nem sempre vem: teclado virtual de sistema, alguns IMEs e
  ferramentas de automação entregam `code` vazio. Nesses casos `key` resolve, e
  se nenhum dos dois servir a tela diz isso em vez de ignorar a tecla.
- **A escala é inteira por padrão.** O canvas era esticado com `object-fit:
  contain`, o que dá fator fracionário; com `image-rendering: pixelated` o
  arredondamento deixa uns pixels do jogo com 3 px de lado e outros com 4, e o
  resultado treme nas bordas e nas fontes. Escala inteira sobra borda preta e é
  o preço certo. Os fatores fixos (1×–4×) são tetos, não pisos: escolher 4× numa
  janela que só comporta 2× aplica 2× e a tela informa o que está valendo.
- **Save states usam `saveStateSlot`/`loadStateSlot`**, que a tipagem marca como
  *deprecated* — porque na mGBA-wasm 2.5.1 as recomendadas (`saveState`/`loadState`)
  retornam falso e não escrevem nada. Verificado no browser.
- **O core é copiado por um plugin do Vite**, não por hook do npm: `npm start`
  não tem `prestart`, então quem subisse por ali ficaria sem o core.
- **Dentro do core o nome da ROM é sempre o basename.** O FS virtual é plano; um
  nome com subpasta (`gb/jogo.gb`) faz `uploadRom` escrever num diretório
  inexistente, a escrita falha e o callback nunca dispara — a tela ficava presa
  em "Carregando…". Há um teto de tempo no upload para essa classe de falha
  aparecer em vez de travar.

#### Cross-origin isolation
O core usa threads, e threads exigem `SharedArrayBuffer`, que o navegador só
libera em página cross-origin isolated. Em `dev` e `preview` os headers já vão
no `vite.config.ts`; em produção o host precisa mandar os mesmos dois — veja
`public/_headers` (Netlify / Cloudflare Pages). Sem eles o resto do site
funciona igual e só o emulador avisa.

Consequência: todo recurso cross-origin da página precisa ser CORS/CORP. Os
sprites já são locais; o artwork da PokéAPI e a folha do Google Fonts levam
`crossorigin="anonymous"`.

### Dano (`/dano`)
Calculadora de dano de Gen 3, seguindo a decompilação (pokeemerald:
`CalculateBaseDamage`, `Cmd_damagecalc`, `Cmd_typecalc` e
`ApplyRandomDmgMultiplier`), em inteiros e na ordem do jogo.

- **Seu time com os status gravados no save**, ou qualquer espécie num nível
  (IV 31, sem EVs, natureza neutra — e a tela diz que é suposição)
- **Regras da época** — físico/especial pelo tipo do golpe; Aço resiste a
  Fantasma e Sombrio; sem Fada (Clefairy volta a Normal por `past_types`);
  poder e tipo dos golpes de Gen 3 por `past_values` (Tackle 35, Outrage 90)
- **Crítico, queimadura e clima**, e as habilidades que não dependem do
  estado da batalha: Huge Power, Pure Power, Thick Fat, Levitate
- **Resultado** — faixa de dano, % do HP, nocaute garantido ou com chance em
  N golpes, e as 16 rolagens

### Seus dados (`/dados`)
Sem conta e sem servidor: o que o site guarda no `localStorage` (favoritos,
fichas de treinador, Pokédex dos jogos, recordes e preferências) vai para
um arquivo `.json`, e o arquivo importado em outro navegador substitui os
dados de lá, com confirmação e resumo do que vem. Fica de fora a última ROM
aberta (só existe no aparelho de origem) e os saves do emulador, que têm o
próprio backup no emulador.

### Ginásios (`/ginasios`)
Os oito líderes do Emerald e do FireRed/LeafGreen, com os times gerados de
`trainer_parties.h` das decompilações (a primeira luta de cada um): nível,
IV (convertido de 0–255 para 0–31; em FR/LG é 0), item, golpes, e tipos e
poderes de Gen 3. Contra cada pokémon do líder, cada membro do seu time do
save mostra o melhor golpe que tem e o pior que vai receber; a página
sugere quem levar, abre no próximo ginásio sem insígnia e marca as ganhas.
Ruby/Sapphire têm times um pouco diferentes e não estão incluídos.

### Treinador (`/treinador`)
A ficha do treinador e a linha do tempo da partida, lidas do save de
**Emerald**, **FireRed/LeafGreen** ou **Ruby/Sapphire** no emulador e
guardadas no `localStorage` — a página não carrega o emulador.

O leitor tem um layout por jogo, identificado pelo campo `0xAC` da seção 0
(0 = R/S, 1 = FR/LG, chave de segurança = Emerald). Emerald e FR/LG foram
medidos em saves reais — o de LeafGreen gerado jogando até o Bulbasaur: time
em `0x34`, dinheiro em `0x290` com a chave em `0xAF8`, insígnias a partir da
flag `0x820` sobre a base `0xEE0`. Ruby/Sapphire não tiveram save para medir:
leem time, Pokédex, PC e tempo de jogo, sem dinheiro nem insígnias.


- **Cartão** — nome, ID, tempo de jogo, dinheiro, Pokédex, insígnias e onde o
  jogo foi salvo
- **Insígnias** de Hoenn ou de Kanto conforme o jogo, **cidades de Hoenn**
  (só Emerald) e o time
- **Imagem do cartão** — o cartão como PNG de 800×420 desenhado num
  `<canvas>` (nome, ID, tempo, dinheiro, dex, insígnias e o time com os
  sprites locais), com prévia, "Baixar PNG" e "Compartilhar" onde o
  navegador compartilha arquivos
- **Conquistas** — dex (10 a 200), insígnias, Hoenn inteira, time cheio,
  nível 50 e 100, evolução, shiny, caixa cheia, 10 horas e ₽100.000, com o
  quanto falta. Todas saem da ficha, sem nada gravado à parte; a que depende
  do que o jogo não registra não aparece. A que destrava entre dois saves
  entra na linha do tempo
- **Comparar saves** (`/treinador/comparar`) — dois saves lado a lado: as
  fichas já lidas no emulador ou um `.sav` escolhido na hora (lido no
  navegador, fora do registro). Números com quem está à frente, os dois
  times e a diferença de Pokédex — o que só um lado capturou
- **PC** — as 14 caixas com busca por apelido, espécie ou número, filtro por
  caixa e shiny, ordem por caixa, dex ou nível, e a ficha de cada pokémon
  (natureza, IVs, EVs, golpes, status). A caixa não guarda nível nem status:
  o nível sai da experiência pela curva de crescimento da espécie (tabela das
  386 gerada da PokéAPI), e os status da fórmula de Gen 3
- **Linha do tempo** — `saves/` guarda um backup sobrescrito, sem histórico.
  Então a cada leitura do save o site compara com o anterior e registra o que
  mudou: capturas, insígnias, cidades, níveis e evoluções (pelo PV, que não
  muda ao evoluir). Carregar um save antigo vira um evento, não uma "perda".
  O que aconteceu antes do primeiro registro não tem como ser recuperado
- **Medido, não assumido** — TID/SID bateram com o OT do Mudkip do save; o
  dinheiro só dá 3300 depois do XOR pela chave de segurança; as flags em volta
  das insígnias (tem Pokédex, visitou Littleroot e Oldale) batem com o começo
  do jogo. A ordem das insígnias é a da decompilação: no save medido nenhuma
  estava ganha. Ruby/Sapphire e FR/LG ficam de fora — o layout deles é outro

## 🛠️ Stack

- **React 19** + **TypeScript** estrito, **Vite** e **React Router**
- **[mGBA](https://mgba.io) compilado para wasm** (`@thenick775/mgba-wasm`, fixo em **2.5.0** — ver as notas)
- **TanStack Query** para o que vem da [PokéAPI](https://pokeapi.co) (nomes, tipos e atributos do time)
- **Vitest** para os testes, **ESLint** para o lint

## 🚀 Rodando localmente

```bash
npm install
npm run dev
```

Abre em [http://localhost:3000](http://localhost:3000). Coloque as suas ROMs em
`roms/` e elas aparecem na biblioteca; os saves são copiados para `saves/`.
As duas pastas ficam fora do git e fora do build.

### Ligação com a Pokédex

As fichas, o mapa e a lore ficam no site da Pokédex. Para os links apontarem
para lá, crie um `.env.local` com o endereço dela (ver `.env.example`):

```bash
VITE_POKEDEX_URL=https://endereco-da-sua-pokedex
```

Sem a variável os links viram texto e o resto funciona igual.

### Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Typecheck e build de produção em `dist/` |
| `npm run preview` | Serve o build |
| `npm test` | Testes |
| `npm run lint` / `npm run typecheck` | Lint e tipos |
| `npm run bench` | Mede a velocidade do emulador em quadros emulados por segundo. Precisa do `npm run dev` de pé e do Chrome |
| `npm run sprites` | Baixa os sprites para `public/sprites/` |
| `npm run gen3:species <rom.gba>` | Regera a tabela de espécies da Gen 3 lendo a sua ROM |
| `npm run gen3:save-check "<arquivo.sav>"` | Valida o leitor de save contra um `.sav` de verdade |

> **Deploy:** o emulador usa threads, e threads exigem `SharedArrayBuffer`, que
> o navegador só libera com os headers `Cross-Origin-Opener-Policy: same-origin`
> e `Cross-Origin-Embedder-Policy: require-corp`. Já estão em `vercel.json` e em
> `public/_headers`. É uma SPA: o host também precisa reescrever qualquer rota
> para `index.html`.

## 📝 Notas técnicas

- **Imagens de personagens, regiões e organizações**: não vêm de wiki. O Bulbapedia bloqueia hotlink (`archives.bulbagarden.net` responde 403) e a arte é propriedade da Nintendo/Game Freak. Não existe retrato de treinador em fonte que o projeto possa usar: `PokeAPI/sprites` serve `pokemon`, `items`, `badges` e `types`, e nada de treinador. Então a ilustração dessas seções é SVG gerado no próprio projeto (`LoreArt.tsx`), e a wiki entra como **fonte citada**.
- **Emulador**: o core é carregado em runtime de `/emulator/mgba.js`, não pelo bundler — o runtime de threads do Emscripten sobe o worker de pthread a partir da URL do próprio script e resolve o `.wasm` relativo a ela. Por isso os dois arquivos são servidos lado a lado de `public/` (copiados de `node_modules` no `predev`/`prebuild`, e fora do git).
- **Romhack tem o cabeçalho do jogo original, byte a byte**. Medido nas ROMs de
  `roms/`: `Pokemon Rocket` e `Pokemon Unbound` têm o bloco `0xA0..0xBF`
  idêntico ao de uma FireRed oficial — mesmo título, mesmo game code, mesmo
  checksum. Não existe campo anti-hack, porque a BIOS valida o logo Nintendo no
  boot e todo hack o preserva; nem o tamanho separa (Rocket tem os mesmos 16 MB
  de uma FireRed). Por isso `romId.ts` devolve a **base** do cartucho e a tela
  põe o nome do arquivo na linha principal. E por isso o game code **nunca**
  pode virar chave de save: os dois hacks gerariam a mesma chave e
  compartilhariam progresso.
- **Tabela de espécies de Gen 3 sai da ROM, não de uma constante**. O save
  guarda o índice interno da espécie, e `nacional = índice − 25` quebra a
  partir do índice 301 — erra 109 das 135 espécies de Hoenn. A própria ROM traz
  `sSpeciesToNationalPokedexNum`. O localizador acha as duas tabelas pelo
  conteúdo (âncoras Bulbasaur/Celebi/Chimecho), e não por offset fixo, que não
  sobrevive a romhack: a Unbound está repontada para `0x166A98C`.
- **O formato do save de Gen 3, medido e não lembrado.** São 32 setores de 4096
  bytes; os 28 primeiros formam dois blocos de 14, e vence o de maior contador.
  Três coisas só apareceram com um save real na mão: **as seções giram dentro do
  bloco** (as posições físicas 0..13 carregavam os ids 10,11,12,13,0,…,9, então
  indexar por posição lê a seção errada); o mGBA **acrescenta 16 bytes** de data
  e hora depois dos 131072; e `playerPartyCount` está em `0x0234`, confirmado
  por varredura — há exatamente um u32 entre 1 e 6 nos primeiros 0x400 bytes.
  `SECTOR_DATA_SIZE` é **3968**, o menor tamanho que valida os 28 checksums;
  esta fixture não o distingue de 4084, porque o espaço entre os dois é zero.
- **A régua de velocidade depende da versão do core.** Na mGBA-wasm 2.5.1 o
  `setFastForwardMultiplier` não mexia na velocidade do jogo: pedir 5× deu
  1,10× e pedir metade deu 1,00×. Uma régua que não faz efeito é pior do que
  régua nenhuma, então ela tinha saído. Com o core fixado em **2.5.0** ele
  obedece — medido em quadros emulados: 5× entrega 5,01×, 10× entrega 9,91×, e
  acima disso a máquina satura (tabela em `src/emulator/shortcuts.ts`). Por
  isso a barra voltou, com teto em 10×, e o `package.json` fixa a versão sem
  `^`. `npm run bench` repete a medição.
- **O log do core custava o turbo.** O core emite ~3 linhas DEBUG/INFO por
  quadro; cada uma virava estado do React e renderizava a página inteira, e o
  turbo parava em 1,0–1,4×. Hoje DEBUG e INFO nem chegam ao painel e o resto é
  descarregado a cada 250 ms.
- **`FSSync()` rejeita**, e engolir essa rejeição prendia a tela em
  "Carregando…" para sempre. Carregar é fatal e vira `status` de erro; gravar,
  apagar e importar são recuperáveis e viram aviso sem derrubar o jogo.
- **Save virgem não é progresso, e tem dois formatos**: flash alocada é toda
  `0x00`, flash apagada é toda `0xFF`. O backup em `saves/` recusa qualquer
  buffer uniforme — testar só contra zero deixava o `0xFF` passar.

## 📄 Licença

Projeto de fã, sem fins comerciais. Pokémon é marca da Nintendo, Game Freak e
Creatures. O site não distribui ROMs.

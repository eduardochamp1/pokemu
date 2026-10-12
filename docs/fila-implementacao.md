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
- [x] 17. Ginásios, dano e comparação para Gen 1/2 — **parcial**, ver notas
- [ ] 18. Leitores de save: validar com saves reais (só leitura), nível no PC de Gen 1, Gen 2 japonesa e coreana
- [ ] 19. CI no GitHub
- [ ] 20. Renomear os caches `pokedex-*` do service worker sem perder dados
- [ ] 21. Assinatura digital do `.exe` (depende de certificado: documentar o que falta)

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
- Ficou de fora do redesenho: navegação lateral, moldura menor do emulador,
  painel recolhível e a unificação dos tokens visuais.

### 17. Gen 1/2 nas ferramentas (parcial)

Feito:
- Guia de ginásios para os oito líderes de Johto (Gold/Silver/Crystal), com o
  time lido do save de Gen 2. Os times foram transcritos de memória da
  decompilação e **não foram conferidos linha a linha**; o teste garante só
  que toda espécie e todo golpe existem.
- Comparação de dois saves de Gen 1 ou Gen 2 em "Comparar saves".

Ficou de fora, e por quê:
- **Ginásios de Gen 1.** A tabela de tipos era outra (sem Aço e Sombrio,
  Fantasma não atingia Psíquico, Inseto e Veneno se batiam) e vários golpes
  tinham outro tipo (Bite, Gust, Karate Chop). Precisa de tabela e de dados
  de golpe próprios da Gen 1 antes de dar conselho.
- **Os oito ginásios de Kanto em Gold/Silver/Crystal.**
- **Cálculo de dano de Gen 1 e Gen 2.** A fórmula, os críticos e os status
  (DVs e experiência de status) são outros; a calculadora atual segue a
  decompilação de Emerald e não serve de base.

## Dúvidas para o usuário

Nenhuma até agora.

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
- [ ] 14. Modo desafio
- [ ] 15. Ramificações de aventura
- [ ] 16. Mapa de progresso
- [ ] 17. Ginásios, dano e comparação para Gen 1/2
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

## Dúvidas para o usuário

Nenhuma até agora.

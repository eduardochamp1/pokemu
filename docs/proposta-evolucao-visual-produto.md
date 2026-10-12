# Pokemu — proposta de evolução visual e de produto

Análise de 12/10/2026 sobre o estado atual do workspace, incluindo alterações locais preexistentes. Documento de proposta; as funcionalidades descritas como futuras não foram implementadas nesta análise.

## Direção recomendada

Transformar o Pokemu em um companheiro de aventuras Pokémon: jogar, lembrar onde parou, entender o próprio time e preservar a história de cada jornada. O leitor de saves já oferece a base para uma experiência pessoal difícil de obter em uma biblioteca genérica de emulação.

O conceito visual proposto é uma central de aventuras com acabamento contemporâneo e detalhes de console portátil. Fundo grafite, superfícies claramente separadas, sprites em destaque e cores próprias de cada jogo. Efeitos retrô opcionais e concentrados na tela do jogo; texto, formulários e navegação ficam limpos.

## O que já existe e deve ser aproveitado

- Emulação GB/GBC/GBA, gamepad, remapeamento, turbo, rewind, escala inteira e capturas.
- Biblioteca por ano, busca, filtro de console e favoritos.
- Pontos de retorno com miniatura e nomes personalizados, save de bateria e backup em disco.
- Leitores de saves de Gen 1/2/3, com capacidades diferentes por edição.
- Aventuras com treinador, time, PC e histórico; conquistas e cartão compartilhável na Gen 3.
- Diário com notas e objetivos; importação de guias TXT/Markdown e busca por trechos.
- Guia de ginásios de Emerald/FRLG e cálculo de dano de Gen 3.
- Aplicativo Electron e infraestrutura de service worker.

Favoritos, diário, nomes de saves e leitor de guias já estão implementados: a evolução deve integrá-los melhor, sem apresentá-los como novidades ainda ausentes.

## Diagnóstico visual

Inspeção no navegador local da biblioteca com 16 arquivos, dos ginásios sem save compatível e da tela de jogo sem ROM ativa, em viewport aproximadamente 1280 × 720. Não houve inspeção de partida ativa nem validação visual em celular nesta rodada.

1. **Primeira tela pouco orientada à ação.** Título, abas e um grande bloco de apresentação empurram os jogos para o fim da primeira dobra. Na biblioteca observada, o bloco principal oferece adicionar ROM mesmo com 16 arquivos existentes, porque a ação depende de haver ROM ativa. Proposta: separar primeiro uso de uso recorrente; exibir último jogo conhecido, favoritos ou primeiros jogos disponíveis.
2. **Scanline sobre toda a interface.** O efeito está ligado por padrão em `src/lib/scanline.ts` e cobre textos e controles. Visualmente reduz a nitidez percebida. Proposta: preferência de efeito apenas no viewport do jogo; evitar textura sobre conteúdo de leitura.
3. **Cartuchos pouco diferenciados.** `GameLibrary.tsx` usa fundo por console, título e nome do arquivo. Jogos do mesmo console ficam muito semelhantes. Proposta: arte ou capa personalizada, cor por edição, identificação curta e resumo real do progresso. Arquivo completo e tamanho ficam nos detalhes.
4. **Identidade fragmentada.** Tokens com sombras duras e cartas de papel convivem com biblioteca arredondada e a grande moldura vermelha do emulador. Proposta: sistema único de superfícies, tipografia, espaçamento e estados; reservar ornamentação para momentos relevantes.
5. **Navegação por ferramenta.** Jogos, Aventuras, Ginásios, Ajuda e Planejar batalhas exigem reconstruir o contexto. Algumas páginas selecionam o save independentemente. Proposta: aventura ativa compartilhada, sempre visível e com indicação explícita de recursos compatíveis.
6. **Ginásios apresentados como lista de consulta.** Proposta: percurso de insígnias com estados concluído, próximo e disponível; retrato do líder, preparação e acesso direto à análise do time.
7. **Jogo sem ROM ativa ainda reserva grande área preta.** Proposta: acesso visível à biblioteca ou importação no próprio estado vazio, com instrução breve.

## Proposta por área

| Área | Mudança proposta | Resultado esperado |
| --- | --- | --- |
| Biblioteca | Destaque compacto de retomada com captura real, últimos jogos, favoritos e coleção visual; cronologia como ordenação alternativa | Encontrar e iniciar um jogo com menos rolagem |
| Jogar | Canvas central, moldura reduzida, controles essenciais próximos e painel lateral recolhível | Mais espaço para jogar e menos competição visual |
| Aventura | Cabeçalho com treinador, time, insígnias, último save e próximo objetivo; abas de Time, PC, Diário e Progresso | Compreender a jornada em uma tela |
| Estratégia | Reunir ginásios, cálculo de dano e cobertura do time com o mesmo contexto | Evitar seleção repetida e simulações sobre o save errado |
| Ajuda | Dicas progressivas, busca por obstáculo e vínculo com objetivos e fonte | Ajudar sem revelar mais do que a pessoa deseja |
| Saves | Linha do tempo de pontos com nome, imagem, tipo, jogo e versão | Tornar a recuperação compreensível |
| Preferências | Idioma, aparência e diagnóstico em local consistente; saúde do backup visível quando relevante | Reduzir controles permanentes no cabeçalho |

No desktop, navegação lateral compacta é uma opção a prototipar; no celular, navegação reduzida com acesso às ferramentas secundárias. O layout final deve ser validado com teclado, toque, zoom e gamepad. Preservar foco visível, movimento reduzido e escala inteira do canvas.

## Funcionalidades priorizadas

Esforço relativo, não estimativa de calendário: P = localizado; M = vários componentes/dados; G = infraestrutura, migração ou regras por edição.

| Prioridade | Proposta | Valor concreto | Esforço e dependência |
| --- | --- | --- | --- |
| P1 | Resumo “Onde parei?” | Último objetivo pendente, nota recente, time e eventos desde a sessão anterior | M; limites de sessão e último save precisam ficar explícitos |
| P1 | Identidade da ROM e perfis de aventura | Renomear arquivo sem desvincular a jornada; campanhas independentes no mesmo jogo | G; hash do conteúdo + ID da aventura + migração de chaves antigas |
| P1 | Cápsula de backup da aventura | Exportar save, metadados, diário e capturas em um pacote com prévia de restauração | G; manifesto versionado, validação, recuperação após falha e política para states |
| P1 | Dados essenciais offline | Time, golpes e regras consultáveis sem depender de consultas novas à API | M/G; catálogo por geração, procedência e atualização versionada |
| P2 | Diário automático ilustrado | Unir notas, capturas e eventos detectados em uma cronologia | M; associar eventos e imagens sem inventar detalhes entre saves |
| P2 | Laboratório do time | Mostrar cobertura de tipos, fraquezas compartilhadas e alternativas entre Pokémon do PC | M; usar regras e dados da edição e explicar cada sugestão |
| P2 | Preparação para o próximo líder | Relacionar o time real ao próximo ginásio e abrir cenários de dano | M/G; ranking atual usa tipos, não uma simulação completa |
| P2 | Guia contextual sem spoilers | Oferecer uma pista, depois orientação e só então solução | G; conteúdo estruturado por edição e fatos realmente disponíveis |
| P2 | Álbum da jornada | Cartões de evolução, insígnias e conquistas com exportação de imagem | M; amplia cartão e capturas existentes |
| P3 | Modo desafio | Regras pessoais, limite de nível, checklist por rota e registro de perdas | G; começar com confirmação manual; save isolado não prova primeira captura ou morte |
| P3 | Ramificações de aventura | Experimentar outra composição a partir de um ponto preservado e comparar resultados | G; depende de perfis, snapshots e histórico separado |
| P3 | Mapa de progresso | Cidades visitadas, objetivos e locais marcados pela pessoa | G; cobertura de localização varia por jogo; não anunciar GPS em tempo real |

As ideias com maior potencial de assinatura do produto são “Onde parei?”, diário ilustrado e ramificações de aventura. Aproveitam dados que o Pokemu já sabe produzir e criam valor ligado à história do jogador.

## Assistência inteligente: implementação gradual

Começar com regras locais explicáveis: objetivo pendente, próximo ginásio registrado, eventos novos e fraquezas do time. Uma camada conversacional pode vir depois, consultando esses dados e trechos de guias com fonte, jogo, horário do save e grau de certeza visíveis.

Não inferir posição atual, eventos não observados ou suporte a hacks apenas a partir do cabeçalho. O resumo pode usar linguagem natural sem depender inicialmente de um modelo generativo. IA remota acrescentaria decisões sobre custo, privacidade, backend e avaliação de respostas.

Multiplayer, trocas por link e sincronização entre aparelhos ficam para estudos separados. Não estão demonstrados pela integração atual; exigem investigação do core ou resolução de conflitos de persistência. Novos consoles também ampliariam muito o escopo.

## Base técnica para sustentar a evolução

- `src/design/tokens.css` já oferece ponto central para aparência. Consolidar também componentes de botão, campo, painel, seletor de aventura e estado vazio antes de replicar o redesenho.
- `src/pages/PlayPage.tsx` tem 1.317 linhas e `src/emulator/useEmulator.ts` tem 1.533 nesta revisão. Separar biblioteca, palco, painel da aventura, saves e configurações gradualmente. Preservar o ciclo de vida do core e do canvas; não reescrever a integração para trocar a aparência.
- `personalAdventures.ts`, histórico e seleção usam nomes de ROM. Um hash identifica o conteúdo; um ID separado identifica a campanha. Não fundir saves automaticamente quando duas ROMs tiverem o mesmo conteúdo. SHA-256 pode ser calculado pela [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest).
- Guias e notas compartilham `localStorage`. Crescimento de texto e futuras mídias pedem armazenamento mais adequado e migração verificável. IndexedDB ajuda a organizar dados, mas continua sujeito às [políticas de armazenamento do navegador](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria); não substitui exportação e cópia em disco.
- Unificar a aventura ativa e expor capacidades por edição: time, PC, localização, ginásios, cálculo e conquistas. Suporte ao emulador não significa suporte ao leitor ou às regras do hack.
- Manter o save de bateria como progresso portátil; states precisam carregar identificação da ROM e versão do core e não devem prometer compatibilidade universal.
- Ampliar validação com saves reais por edição e fluxos de migração/restauração antes de acrescentar automações que gravem progresso.

## Sequência sugerida

1. **Repaginada inicial:** tokens, componentes comuns, biblioteca, navegação e palco do jogo. Aceite: jogos ou retomada visíveis na primeira tela de desktop; textos sem textura por cima; teclado e zoom utilizáveis; canvas não reinicializa ao alternar áreas.
2. **Aventura conectada:** contexto compartilhado, resumo de retomada e diário unificado. Aceite: todas as ferramentas identificam a mesma campanha; dados sempre mostram origem e atualização; gerações incompatíveis não recebem recomendações indevidas.
3. **Persistência e autonomia:** IDs, migração, cápsula de backup e catálogo offline. Aceite: restaurar pacote em perfil limpo com conferência de integridade; falha parcial não destrói o progresso anterior; modo offline testado sem cache prévio da API.
4. **Diferenciais:** laboratório do time, dicas progressivas, álbum e desafios. Aceite: recomendações explicáveis, cobertura por edição e confirmação dos fatos que não podem ser observados automaticamente.

IDs e persistência podem ser desenvolvidos em paralelo ao trabalho visual, mas devem preceder múltiplas campanhas, ramificações e sincronização.

## Validação executada nesta análise

- `npm test -- --reporter=dot`: 439 testes passaram; 1 ignorado, condicionado a `GEN3_SAVE` para teste com save real.
- `npm run lint`: passou.
- `npm run build`: passou, incluindo TypeScript.
- Inspeção visual limitada às telas e estados descritos acima. Os testes não comprovam desempenho em partida, restauração ponta a ponta, compatibilidade com todos os hacks ou funcionamento em todos os dispositivos.
- Nenhum componente da aplicação foi alterado nesta análise. O workspace já continha alterações extensas de trabalhos anteriores.

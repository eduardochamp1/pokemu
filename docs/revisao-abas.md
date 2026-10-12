# Revisão das abas do Pokemu

Atualização: o ciclo seguinte entregou o escopo escolhido de biblioteca, saves com nomes, diário e ajuda por jogo. Veja [a entrega e o modo de uso](entrega-aplicativo.md). A tabela abaixo preserva a revisão inicial; favoritos, nomes de pontos, notas, objetivos e leitor de detonados passaram a estar implementados. Os demais itens continuam como evolução ou dependência externa.

Revisão de 12/10/2026. Esta é a base para continuar as implementações; itens pendentes não representam funcionalidades já entregues.

| Área | Estado atual e ajustes desta revisão | Próxima lacuna |
| --- | --- | --- |
| Biblioteca | Cards por ano de lançamento, busca, filtro por console, importação e retomada do jogo pausado. | Favoritos, capas e identificação de cópias por hash. Há arquivos diferentes de Emerald e LeafGreen; não foram apagados nem fundidos. |
| Jogar / Aventura | Canvas preservado na troca entre biblioteca e jogo; pausa, controles, turbo e leitura do save. Troca de ROM recolhida. | Ajuda contextual, objetivos pessoais e diário com anotações. |
| Jogar / Saves | Pontos de retorno, save de bateria, importação/exportação e cópia local. Backup agora aponta diretamente para este painel. | Dar nomes aos pontos de retorno; perfis separados por aventura e identificação clara de versões do save. |
| Jogar / Ajustes | Teclas, áudio/vídeo e diagnóstico separados da aventura. | Simplificar configurações comuns e recolher diagnóstico técnico. |
| Aventuras | Seleção única entre os progressos registrados de Gen 1, Gen 2 e Gen 3; exibe apenas a aventura escolhida. Estado vazio explica que é preciso salvar no jogo. | Validar leitores com saves reais de todas as edições; registrar objetivos e anotações. Compartilhamento da ficha e conquistas avançadas continuam específicos da Gen 3. |
| Ginásios | Líderes oficiais de Emerald e FireRed/LeafGreen. Seleção explícita de save compatível; evita usar o time de Ruby/Sapphire ou de outro grupo de jogos. Sem save, os líderes continuam consultáveis. | Guias próprios de Gen 1, Gen 2 e Ruby/Sapphire; suporte explícito a hacks. O ranking atual compara tipos de golpes, não prevê uma batalha completa. |
| Planejar batalhas | Calculadora de Gen 3, com escolha de save. A troca reinicia a simulação para evitar misturar Pokémon/condições de aventuras diferentes. | Modelar regras de Gen 1/2; ampliar condições e explicar limitações de golpes. Dados de espécies/golpes dependem da PokéAPI ou de cache anterior. |
| Comparar saves | Consulta de fichas e arquivos de Gen 3. Disponível mesmo sem aventura registrada. Arquivos lidos aqui não substituem saves. Falhas de leitura são exibidas. | Comparação de Gen 1/2 e comparação de snapshots da mesma aventura. |
| Backup | JSON de histórico, fichas e preferências; descreve claramente que ROMs, `.sav` e pontos de retorno não estão incluídos. Valida data/estrutura e trata erros. Se a escrita falha, tenta repor os dados anteriores e informa se a recuperação também falhar. | Backup completo da aventura com manifesto, saves e snapshots, com prévia antes de restaurar. |
| Navegação e recuperação | Nomes alinhados com as funções. `/jogar` mantém parâmetros ao redirecionar. Trocar de rota permite sair de uma tela com erro de renderização. | Revisão final em telas pequenas e com teclado/controle em partidas reais. |

## Continuidade sugerida

1. **Base confiável:** validar saves reais das edições importadas e suas restaurações; distinguir versões/hacks e cópias sem perder progresso.
2. **Saves personalizados:** nomes como “Antes do ginásio” e “Explorando a caverna”, com data, ROM e imagem do momento.
3. **Central de ajuda e detonados:** cadastrar conteúdo por jogo/edição, permitir busca por cidade, objetivo e obstáculo, e oferecer dicas progressivas para controlar spoilers. O conteúdo precisa ter fonte e permissão de uso; nenhuma coleção de detonados foi importada nesta revisão.
4. **Diário da aventura:** objetivos, anotações, capturas e eventos do save na mesma linha do tempo.
5. **Assistência contextual:** combinar o último save válido com o objetivo informado pelo jogador. Não assumir localização ou eventos que o leitor ainda não identifica.
6. **Distribuição Windows:** preparar assinatura digital confiável antes de apresentar o executável como pronto para executar neste computador. O bloqueio do Smart App Control permanece pendente.

## Validação e limites

- Build, tipos, lint e testes automatizados.
- Testes de regressão para saves incompatíveis em Ginásios e recuperação de dados após falha de escrita do backup.
- Revisão no navegador da biblioteca, estados vazios, líderes por jogo, simulador, backup, comparação e acesso ao painel de saves.
- A revisão visual usa os dados existentes neste navegador; não foi feita restauração sobre dados pessoais nem inserção de fichas fictícias nele.
- O pacote `.exe` não foi regenerado nesta revisão. As mudanças estão no código e na versão local do aplicativo.

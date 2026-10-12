# Aplicativo: entrega priorizada

Escopo escolhido pelo usuário em 12/10/2026: biblioteca, saves com nomes, diário e ajuda por jogo. As ampliações das regras de batalha e comparação para Gen 1/2 não fazem parte deste ciclo.

## Como usar

1. Abra a **Biblioteca**, encontre o jogo por nome ou console e clique em **Jogar**. A estrela adiciona um favorito sem iniciar a ROM; **Só favoritos** filtra a coleção.
2. No painel **Saves**, use **Dar um nome…** para rotular cada um dos seis pontos de retorno. Nomear não grava o estado: clique em **gravar** para capturar o momento. Estados existentes mantêm miniatura e data. Os nomes são individuais por ROM e slot, sem renomear seus arquivos nem alterar os saves existentes.
3. No painel **Aventura**, registre objetivos e anotações no **Diário**. Objetivos podem ser concluídos e reabertos; notas podem ser editadas. O mesmo diário aparece em **Aventuras** e em **Ajuda**.
4. Abra **Ajuda** para o jogo desejado. **Guias na internet** oferece fontes por edição, idioma e versão, abrindo os links em outra aba. Eles exigem internet e podem conter spoilers. A associação é sugerida pelo nome da ROM; confira a compatibilidade. Em **Cadastrar detonado**, escolha um TXT/Markdown próprio ou autorizado e, opcionalmente, informe a fonte HTTP/HTTPS. Um novo arquivo substitui o guia daquele jogo. O limite é de 300 mil caracteres.
5. Pesquise por cidade, item ou obstáculo. A busca ignora acentos. Os trechos começam recolhidos e são revelados individualmente; títulos de Markdown também delimitam trechos. Os títulos/prévias vêm do próprio arquivo e podem conter spoilers.
6. Em **Backup**, exporte o JSON para guardar favoritos, diário, objetivos, nomes dos pontos, guias cadastrados, fichas e histórico. Para levar progresso jogável a outro aparelho, exporte também o `.sav`. Os arquivos dos pontos de retorno continuam no armazenamento do emulador e não entram no JSON.

## Correções feitas no ciclo

- Corrigido o botão de limpar filtros para remover também o filtro de favoritos.
- Mantida a separação entre ROMs, incluindo hacks que compartilham cabeçalho com jogos oficiais.
- Ajustado o teclado para que digitar no diário ou no nome do ponto não envie comandos ao core.
- Corrigido o layout dos nomes dos pontos no painel de saves.
- Persistência publica alterações somente após a gravação funcionar; falhas de armazenamento mantêm os dados anteriores e exibem um aviso.
- Validados limites, datas do diário e links de fonte; o guia é exibido como texto, sem interpretar HTML.
- Notas, objetivos e guias já aparecem em Aventuras mesmo antes da primeira ficha de save. Favoritar sozinho não cria uma aventura vazia.

## O que depende de recursos adicionais

- **Conteúdo dos detonados:** o leitor está implementado, mas nenhum detonado completo de terceiros foi baixado ou incluído automaticamente. Cada ROM informa quando ainda não possui um guia cadastrado.
- **Saves reais:** os testes cobrem fixtures e fluxos, mas a validação de progresso real ainda não foi feita para todas as edições importadas. Não foram alterados saves pessoais para simular essa validação.
- **Executável Windows:** a assinatura digital continua pendente de certificado confiável; este ciclo não desativou o Smart App Control e não regenerou o executável bloqueado.
- **Backup completo de snapshots, múltiplos perfis por ROM, capas oficiais e detecção de duplicados por hash:** permanecem na lista de evolução, separados dos recursos priorizados acima.

## Verificação

Testes de nomes por ROM/slot, favoritos e limpeza de filtros, diário e edição, objetivos, persistência e backup, busca em guias e importação de texto com HTML inerte; além da suíte existente, build, tipos e lint. Revisão no navegador do painel de saves e da nova central de ajuda. Nenhuma ficha ou anotação fictícia foi inserida nos dados pessoais do navegador para testar.

# Leitores de saves e biblioteca inicial

As 12 ROMs fornecidas foram extraídas de seus ZIPs para `roms/` no projeto e
`%APPDATA%/Pokemu/roms/` no aplicativo. Os ZIPs originais e as ROMs que já
estavam na biblioteca foram preservados. Arquivos pessoais ficam fora do Git
e do executável; o aplicativo consulta a biblioteca do perfil do Windows.

## Compatibilidade

| Jogos da coleção | Leitor |
| --- | --- |
| Red, Blue, Yellow internacionais | Gen 1, checksum principal, charset internacional |
| Green japonês | Gen 1 japonês, offsets e nomes de seis bytes |
| Gold, Silver internacionais | Gen 2, bloco principal e recuperação da cópia de segurança |
| Crystal internacional | Gen 2, layout próprio e recuperação da cópia de segurança |
| Ruby, Sapphire, Emerald, FireRed, LeafGreen | Leitor de Gen 3 existente |

A identificação GB/GBC lê o título, destino, revisão e checksum do cabeçalho.
Foi conferida nas sete ROMs GB/GBC da coleção. O título identifica a base, não
prova que o arquivo é oficial: romhacks que mudem o formato do save precisam
de um leitor específico. Edições japonesas de Gen 2 e coreanas não são aceitas
pelo leitor desta etapa.

## Dados disponíveis

- Treinador, ID, dinheiro, tempo e insígnias (8 em Kanto; 16 em Gen 2).
- Time: espécie, apelido, OT, experiência, nível e status gravados no save.
- Golpes, PP e PP Ups; DVs e experiência de status nativos dessas gerações.
- Amizade, item e identificação de ovos/shiny em Gen 2.
- Pokédex vista/capturada e caixas de PC. Caixas inválidas são sinalizadas.
- Histórico por ROM de novas capturas, insígnias e retorno a saves anteriores.

Não se atribuem naturezas ou habilidades a Gen 1/2. Shiny de Gen 1 fica
indisponível, pois a geração não apresenta essa característica. No PC de
Gen 1 o registro de caixa não guarda o nível: ele é derivado da experiência
pela curva de crescimento da espécie, a mesma conta que o jogo refaz ao
retirar o pokémon. Gen 1/2 não têm PV; o histórico não presume uma identidade
individual para registrar evoluções.

Os dados são atualizados quando o jogo grava e ao importar/restaurar saves.
Ficam no painel do jogo e em **Treinador**, com seleção entre aventuras de
Gen 1/2. O registro `pokedex:legacy-adventures` participa do backup de **Seus
dados**. Calculadora de dano, ginásios, comparação e cartão PNG existentes
continuam usando as regras e estruturas de Gen 3.

## Validação e referências

Os testes constroem fixtures com os formatos de Red, Green japonês,
Gold/Silver e Crystal. Cobrem checksum, dados inválidos/truncados, byte order,
dinheiro BCD, DVs, PP Ups, ovos, charset, trailer do emulador, recuperação dos
dois formatos de backup de Gen 2 e integração com o hook e armazenamento.
Fixtures sintéticas não substituem a comparação com partidas reais.

Os formatos foram consultados no código de referência do
[PKHeX](https://github.com/kwsch/PKHeX/tree/66ef5983a5d349efa2dd615f2926a1b1ee97306e/PKHeX.Core),
em `SAV1Offsets`, `SAV2Offsets`, `SAV1`, `SAV2`, `PK1`, `PK2` e
`StringConverter1`. O código desses leitores é próprio; a tabela de espécies
de Gen 1 foi extraída da ROM Red fornecida, conferindo as 151 espécies.
A rotina do jogo também pode ser consultada na
[decompilação pokered](https://github.com/pret/pokered/blob/master/engine/menus/save.asm).

`desktop/rom-check.mjs` é uma ferramenta de desenvolvimento para iniciar
uma ROM em um perfil temporário isolado e obter screenshot e save de bateria.
Ela não entra no executável, não altera o progresso do usuário e exige um
build pronto. `keysReadCallback` não é emitido pelo core GB; sua contagem só
serve para GBA. Uma ROM aceita pelo core ainda exige inspeção da captura.

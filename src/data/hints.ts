import { romRelease } from "../emulator/romChronology";

/**
 * Dicas próprias do Pokemu, em três níveis, para o caminho até cada insígnia.
 *
 * O texto foi escrito para este projeto — não é cópia nem adaptação de
 * detonado de terceiros (ver docs/levantamento-detonados.md). Cada etapa tem:
 *
 *  1. `hint`: um empurrão, sem nomes de lugar que não se tenha visto;
 *  2. `next`: para onde ir e o que destrava o caminho;
 *  3. `solution`: o passo a passo, com o tipo do líder e o que leva vantagem.
 *
 * Cobre Emerald e FireRed/LeafGreen, que são os jogos com guia de ginásios.
 * Ruby/Sapphire têm ordem e líderes um pouco diferentes (Wallace no lugar de
 * Juan, outros esconderijos) e ficam de fora até terem texto próprio. Romhack
 * nunca recebe dica do jogo em que se baseia.
 */

export interface HintStep {
  /** Índice da insígnia que esta etapa destrava (0..7). */
  badge: number;
  title: [pt: string, en: string];
  hint: [pt: string, en: string];
  next: [pt: string, en: string];
  solution: [pt: string, en: string];
}

export type HintFamily = "emerald" | "frlg";

const EMERALD: HintStep[] = [
  {
    badge: 0,
    title: ["Primeira insígnia: Roxanne", "First badge: Roxanne"],
    hint: [
      "O primeiro ginásio fica numa cidade grande, depois de uma floresta.",
      "The first gym is in a big city, past a forest.",
    ],
    next: [
      "Atravesse Petalburg Woods e siga para o norte até Rustboro City. O ginásio é de Pedra.",
      "Cross Petalburg Woods and head north to Rustboro City. It's a Rock gym.",
    ],
    solution: [
      "Roxanne usa Geodude e Nosepass. Água e Planta levam vantagem dupla sobre o Geodude; Lutador também funciona. Mudkip e Treecko passam com folga; com Torchic, vale capturar um Lotad ou Shroomish antes, porque Fogo e Voador apanham de Pedra.",
      "Roxanne uses Geodude and Nosepass. Water and Grass hit Geodude for double weakness; Fighting works too. Mudkip and Treecko breeze through; with Torchic, catch a Lotad or Shroomish first, since Fire and Flying are weak to Rock.",
    ],
  },
  {
    badge: 1,
    title: ["Segunda insígnia: Brawly", "Second badge: Brawly"],
    hint: ["O próximo ginásio fica numa ilha: você precisa de uma carona.", "The next gym is on an island: you need a ride."],
    next: [
      "Depois de recuperar a encomenda da Devon em Rustboro, procure o Mr. Briney na casinha da Route 104. Ele leva você de barco a Dewford Town.",
      "After recovering Devon's package in Rustboro, find Mr. Briney in the cottage on Route 104. He sails you to Dewford Town.",
    ],
    solution: [
      "Brawly é de Lutador. Voador e Psíquico levam vantagem: Taillow, Wingull ou um Ralts resolvem. Evite pokémon Normal, Pedra e Sombrio. Em Dewford, entregue também a carta ao Steven na Granite Cave.",
      "Brawly is Fighting. Flying and Psychic have the edge: Taillow, Wingull or a Ralts will do. Avoid Normal, Rock and Dark. While in Dewford, deliver the letter to Steven in Granite Cave too.",
    ],
  },
  {
    badge: 2,
    title: ["Terceira insígnia: Wattson", "Third badge: Wattson"],
    hint: ["Siga o caminho do barco até o fim e depois vá para o norte.", "Follow the boat route to its end, then head north."],
    next: [
      "O Mr. Briney deixa você em Slateport. Entregue a encomenda no estaleiro, passe pelo museu e suba a Route 110 até Mauville City.",
      "Mr. Briney drops you in Slateport. Deliver the package at the shipyard, go through the museum and take Route 110 up to Mauville City.",
    ],
    solution: [
      "Wattson é de Elétrico, e o Magneton dele é também de Aço: Terra é imune a Elétrico e bate nele com vantagem quádrupla. Um Geodude da Granite Cave ou o Marshtomp resolvem. Não leve Água nem Voador.",
      "Wattson is Electric, and his Magneton is also Steel: Ground is immune to Electric and hits it for quadruple damage. A Geodude from Granite Cave or Marshtomp handles it. Leave Water and Flying behind.",
    ],
  },
  {
    badge: 3,
    title: ["Quarta insígnia: Flannery", "Fourth badge: Flannery"],
    hint: ["O caminho direto para o vulcão está bloqueado: é preciso dar a volta.", "The direct way to the volcano is blocked: you have to go around."],
    next: [
      "De Mauville vá para o norte, atravesse o Fiery Path, passe por Fallarbor e pelas Meteor Falls. Depois disso o teleférico do Mt. Chimney abre; desça pelo Jagged Pass até Lavaridge.",
      "From Mauville go north, cross Fiery Path, pass Fallarbor and Meteor Falls. After that the Mt. Chimney cable car opens; walk down Jagged Pass to Lavaridge.",
    ],
    solution: [
      "Flannery é de Fogo. Água, Terra e Pedra levam vantagem; o Torkoal dela aguenta bastante e usa Overheat, então prefira um atacante de Água a um de Pedra frágil. Planta, Inseto, Gelo e Aço ficam no PC.",
      "Flannery is Fire. Water, Ground and Rock have the edge; her Torkoal is bulky and uses Overheat, so prefer a Water attacker over a frail Rock one. Leave Grass, Bug, Ice and Steel in the PC.",
    ],
  },
  {
    badge: 4,
    title: ["Quinta insígnia: Norman", "Fifth badge: Norman"],
    hint: ["Alguém da sua família disse que lutaria quando você tivesse quatro insígnias.", "Someone in your family said they'd battle once you had four badges."],
    next: ["Volte a Petalburg City: o ginásio do seu pai agora aceita o desafio.", "Go back to Petalburg City: your father's gym now accepts the challenge."],
    solution: [
      "Norman é de Normal, e só Lutador leva vantagem. O Slaking dele bate muito forte mas só age um turno sim, um não (Truant): use o turno parado para atacar ou curar. Fantasma é imune aos golpes Normal dele.",
      "Norman is Normal, and only Fighting has the edge. His Slaking hits very hard but acts only every other turn (Truant): use the idle turn to attack or heal. Ghost is immune to his Normal moves.",
    ],
  },
  {
    badge: 5,
    title: ["Sexta insígnia: Winona", "Sixth badge: Winona"],
    hint: ["Com a quinta insígnia você pode usar Surf fora de batalha: há água a leste de Mauville.", "With the fifth badge you can Surf outside battle: there's water east of Mauville."],
    next: [
      "Atravesse a Route 118 com Surf, suba a Route 119, resolva o Weather Institute e siga até Fortree City. Algo invisível bloqueia o ginásio: o Steven, na Route 120, tem o que revela.",
      "Surf across Route 118, go up Route 119, clear the Weather Institute and continue to Fortree City. Something invisible blocks the gym: Steven, on Route 120, has what reveals it.",
    ],
    solution: [
      "Pegue o Devon Scope com o Steven na Route 120 e use no Kecleon em frente ao ginásio. Winona é de Voador: Elétrico, Gelo e Pedra levam vantagem. O Altaria dela é também Dragão, então Gelo bate com vantagem quádrupla e Elétrico só neutro.",
      "Get the Devon Scope from Steven on Route 120 and use it on the Kecleon by the gym. Winona is Flying: Electric, Ice and Rock have the edge. Her Altaria is also Dragon, so Ice hits for quadruple damage and Electric only neutral.",
    ],
  },
  {
    badge: 6,
    title: ["Sétima insígnia: Tate e Liza", "Seventh badge: Tate and Liza"],
    hint: ["O próximo ginásio fica numa ilha no mar a leste.", "The next gym is on an island in the eastern sea."],
    next: [
      "De Lilycove, depois de resolver o Mt. Pyre e os esconderijos das equipes, vá de Surf para o leste até Mossdeep City.",
      "From Lilycove, after dealing with Mt. Pyre and the teams' hideouts, Surf east to Mossdeep City.",
    ],
    solution: [
      "É uma batalha dupla contra dois líderes de Psíquico. Sombrio, Fantasma e Inseto levam vantagem; Solrock e Lunatone são também de Pedra, então Água e Planta batem forte neles. Nesta geração, Surf atinge os dois adversários de uma vez sem acertar o seu parceiro.",
      "It's a double battle against two Psychic leaders. Dark, Ghost and Bug have the edge; Solrock and Lunatone are also Rock, so Water and Grass hit them hard. In this generation, Surf hits both foes at once without hitting your partner.",
    ],
  },
  {
    badge: 7,
    title: ["Oitava insígnia: Juan", "Eighth badge: Juan"],
    hint: ["A última cidade só se alcança por baixo d'água.", "The last city can only be reached underwater."],
    next: [
      "Com Dive, resolva a Seafloor Cavern. Depois que o clima enlouquecer, vá a Sootopolis, suba o Sky Pillar para chamar o Rayquaza e volte: o ginásio abre.",
      "With Dive, clear Seafloor Cavern. Once the weather goes wild, reach Sootopolis, climb Sky Pillar to summon Rayquaza and return: the gym opens.",
    ],
    solution: [
      "Juan é de Água. Elétrico e Planta levam vantagem, com duas exceções: o Whiscash é também de Terra (imune a Elétrico, Planta com vantagem quádrupla) e o Kingdra é também Dragão, fraco só a Dragão. Leve um de cada tipo e algo que aguente o Kingdra.",
      "Juan is Water. Electric and Grass have the edge, with two exceptions: Whiscash is also Ground (immune to Electric, quadruple weak to Grass) and Kingdra is also Dragon, weak only to Dragon. Bring one of each type and something that can take Kingdra.",
    ],
  },
];

const FRLG: HintStep[] = [
  {
    badge: 0,
    title: ["Primeira insígnia: Brock", "First badge: Brock"],
    hint: ["O primeiro ginásio fica depois de uma floresta, ao norte.", "The first gym is past a forest, to the north."],
    next: ["Atravesse a Viridian Forest até Pewter City. O ginásio é de Pedra.", "Cross Viridian Forest to Pewter City. It's a Rock gym."],
    solution: [
      "Brock usa Geodude e Onix, os dois de Pedra e Terra: Água e Planta batem com vantagem quádrupla. Com Charmander, capture um Mankey na Route 22 (a oeste de Viridian) ou evolua até aprender Metal Claw.",
      "Brock uses Geodude and Onix, both Rock and Ground: Water and Grass hit for quadruple damage. With Charmander, catch a Mankey on Route 22 (west of Viridian) or level up until it learns Metal Claw.",
    ],
  },
  {
    badge: 1,
    title: ["Segunda insígnia: Misty", "Second badge: Misty"],
    hint: ["O caminho para a próxima cidade passa por dentro de uma montanha.", "The way to the next city goes through a mountain."],
    next: ["Siga a Route 3 e atravesse o Mt. Moon até Cerulean City. O ginásio é de Água.", "Take Route 3 and cross Mt. Moon to Cerulean City. It's a Water gym."],
    solution: [
      "Misty é de Água; o Starmie dela é rápido e bate forte. Planta e Elétrico levam vantagem: Bulbasaur, um Pikachu da Viridian Forest ou um Oddish/Bellsprout das rotas ao norte de Cerulean. Fogo, Terra e Pedra ficam de fora.",
      "Misty is Water; her Starmie is fast and hits hard. Grass and Electric have the edge: Bulbasaur, a Pikachu from Viridian Forest or an Oddish/Bellsprout from the routes north of Cerulean. Leave Fire, Ground and Rock out.",
    ],
  },
  {
    badge: 2,
    title: ["Terceira insígnia: Lt. Surge", "Third badge: Lt. Surge"],
    hint: ["Uma árvore pequena bloqueia o ginásio: você precisa de um golpe de fora de batalha.", "A small tree blocks the gym: you need a field move."],
    next: [
      "Em Vermilion City, embarque no S.S. Anne com o bilhete do Bill e encontre o capitão: ele dá o HM de Cut. Depois corte a árvore ao lado do ginásio.",
      "In Vermilion City, board the S.S. Anne with Bill's ticket and find the captain: he gives you the Cut HM. Then cut the tree beside the gym.",
    ],
    solution: [
      "Dentro do ginásio, ache os dois interruptores escondidos nas lixeiras: o segundo fica sempre numa lixeira vizinha à do primeiro. Lt. Surge é de Elétrico; Terra é imune e leva vantagem — capture um Diglett na Diglett's Cave, ao lado da cidade.",
      "Inside, find the two switches hidden in the trash cans: the second is always in a can next to the first. Lt. Surge is Electric; Ground is immune and has the edge — catch a Diglett in Diglett's Cave, right by the city.",
    ],
  },
  {
    badge: 3,
    title: ["Quarta insígnia: Erika", "Fourth badge: Erika"],
    hint: ["O próximo trecho tem um túnel escuro. Há quem ajude a iluminar.", "The next stretch has a dark tunnel. Someone can help you light it."],
    next: [
      "De Cerulean siga para o leste e atravesse o Rock Tunnel até Lavender Town; depois vá para o oeste e use a passagem subterrânea até Celadon City.",
      "From Cerulean go east and cross Rock Tunnel to Lavender Town; then head west and take the underground path to Celadon City.",
    ],
    solution: [
      "Flash ajuda no Rock Tunnel: o assistente do Professor Oak entrega o HM na Route 2 a quem já capturou dez espécies. Em Celadon, Erika é de Planta: Fogo, Gelo, Voador e Inseto levam vantagem. Os pokémon dela usam golpes de status, então leve remédios para sono e veneno.",
      "Flash helps in Rock Tunnel: Professor Oak's aide hands the HM on Route 2 to anyone with ten species caught. In Celadon, Erika is Grass: Fire, Ice, Flying and Bug have the edge. Her team uses status moves, so bring cures for sleep and poison.",
    ],
  },
  {
    badge: 4,
    title: ["Quinta insígnia: Koga", "Fifth badge: Koga"],
    hint: ["Algo enorme dorme no meio do caminho. Existe um instrumento que o acorda.", "Something huge sleeps in the way. There's an instrument that wakes it."],
    next: [
      "Em Celadon, o esconderijo da Team Rocket fica atrás do Game Corner. O que você pega lá permite subir a Pokémon Tower de Lavender, e o Mr. Fuji dá a Poké Flute.",
      "In Celadon, Team Rocket's hideout is behind the Game Corner. What you get there lets you climb Lavender's Pokémon Tower, and Mr. Fuji gives you the Poké Flute.",
    ],
    solution: [
      "Use a Poké Flute no Snorlax e siga até Fuchsia City. O ginásio tem paredes invisíveis: ande rente a elas. Koga é de Veneno: Terra e Psíquico levam vantagem. Ele usa veneno e Selfdestruct — leve antídotos e não deixe o pokémon principal com pouca vida.",
      "Use the Poké Flute on Snorlax and continue to Fuchsia City. The gym has invisible walls: walk along them. Koga is Poison: Ground and Psychic have the edge. He uses poison and Selfdestruct — bring antidotes and keep your main pokémon healthy.",
    ],
  },
  {
    badge: 5,
    title: ["Sexta insígnia: Sabrina", "Sixth badge: Sabrina"],
    hint: ["Os guardas da cidade grande estão com sede.", "The big city's guards are thirsty."],
    next: [
      "Pegue o Tea com a senhora na Celadon Mansion e ofereça a um guarda para entrar em Saffron City. O ginásio só abre depois que a Silph Co. for liberada.",
      "Get the Tea from the old lady in Celadon Mansion and offer it to a guard to enter Saffron City. The gym only opens after Silph Co. is cleared.",
    ],
    solution: [
      "Suba a Silph Co., ache a Card Key e vença o chefe da Team Rocket no último andar. No ginásio, os teleportes levam até Sabrina, que é de Psíquico. Inseto, Fantasma e Sombrio levam vantagem; Lutador e Veneno ficam de fora.",
      "Climb Silph Co., find the Card Key and beat Team Rocket's boss on the top floor. In the gym, the warp tiles lead to Sabrina, who is Psychic. Bug, Ghost and Dark have the edge; leave Fighting and Poison out.",
    ],
  },
  {
    badge: 6,
    title: ["Sétima insígnia: Blaine", "Seventh badge: Blaine"],
    hint: ["O próximo ginásio fica numa ilha ao sul, e a porta está trancada.", "The next gym is on an island to the south, and its door is locked."],
    next: [
      "Com Surf (o HM vem da Safari Zone), desça pelo mar a partir de Pallet Town ou de Fuchsia até Cinnabar Island. A chave do ginásio está na mansão abandonada.",
      "With Surf (the HM comes from the Safari Zone), sail south from Pallet Town or Fuchsia to Cinnabar Island. The gym key is in the abandoned mansion.",
    ],
    solution: [
      "Pegue a Secret Key no subsolo da Pokémon Mansion. No ginásio, responder certo ao quiz abre as portas sem lutar com os treinadores. Blaine é de Fogo: Água, Terra e Pedra levam vantagem.",
      "Get the Secret Key in the basement of the Pokémon Mansion. In the gym, answering the quiz correctly opens the doors without fighting the trainers. Blaine is Fire: Water, Ground and Rock have the edge.",
    ],
  },
  {
    badge: 7,
    title: ["Oitava insígnia: Giovanni", "Eighth badge: Giovanni"],
    hint: ["Um ginásio que estava fechado desde o começo do jogo agora tem líder.", "A gym that was closed since the start of the game now has a leader."],
    next: ["Volte a Viridian City com sete insígnias: o ginásio está aberto.", "Return to Viridian City with seven badges: the gym is open."],
    solution: [
      "O piso tem setas que empurram você: observe para onde cada trilha leva antes de pisar. Giovanni é de Terra. Água, Planta e Gelo levam vantagem; contra os Nidoking e Nidoqueen dele, que são também de Veneno, Planta bate só neutro e entram Psíquico e Terra.",
      "The floor has arrows that push you around: watch where each track leads before stepping. Giovanni is Ground. Water, Grass and Ice have the edge; against his Nidoking and Nidoqueen, which are also Poison, Grass is only neutral and Psychic and Ground come in.",
    ],
  },
];

const FAMILIES: Record<HintFamily, HintStep[]> = { emerald: EMERALD, frlg: FRLG };

/**
 * A família de dicas de uma ROM, pelo nome oficial do arquivo. Romhack não
 * casa com `romRelease` e fica sem dica — o jogo é outro, mesmo que o
 * cabeçalho seja o de FireRed.
 */
export function hintFamilyOf(rom: string): HintFamily | undefined {
  const id = romRelease(rom)?.id;
  if (id === "emerald") return "emerald";
  if (id === "firered" || id === "leafgreen") return "frlg";
  return undefined;
}

export function hintsFor(family: HintFamily): HintStep[] {
  return FAMILIES[family];
}

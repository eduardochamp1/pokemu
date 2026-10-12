import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useEmulator } from "../../emulator/useEmulator";
import {
  type KeyBinding,
} from "../../emulator/keyBindings";
import { sdlKeyFromEvent } from "../../emulator/keyNames";
import {
  isTypingTarget,
  shortcutFor,
} from "../../emulator/shortcuts";
import { useGamepad } from "../../emulator/useGamepad";
import {
  type SaveStateSlot,
} from "../../emulator/types";
import { GAME_GENERATIONS } from "../../data/generations";
import { REGIONS } from "../../data/regions";
import { useDisplay } from "../../emulator/useDisplay";
import { useLang, tr, type Lang } from "../../i18n/lang";

export const GROUPS: KeyBinding["group"][] = [
  "direcional",
  "acao",
  "ombro",
  "sistema",
];

/**
 * Algarismo romano da geracao, tirado do mesmo dado que a Lore publica.
 *
 * Reusar em vez de converter numero para romano aqui: se um dia a tabela
 * mudar, as duas telas mudam juntas.
 */
export function romano(geracao: number): string {
  return (
    GAME_GENERATIONS.find((g) => g.id === geracao)?.roman ?? String(geracao)
  );
}

/**
 * Como anunciar o turbo.
 *
 * O atalho e a barra de espaco, mas ele so existe se a barra de espaco nao
 * estiver mapeada para um botao do jogo — senao a tecla teria dois donos.
 * Ver `shortcutFor` em shortcuts.ts.
 */
export function teclaDoTurbo(bindings: KeyBinding[], lang: Lang): string {
  return bindings.some((b) => b.sdlKey === "Space")
    ? tr(lang, "a tecla de turbo (hoje ocupada pelo jogo)", "the turbo key (taken by the game right now)")
    : tr(lang, "Espaço", "Space");
}

/** Nome da regiao como o resto do site a escreve. */
export function nomeDaRegiao(id: string): string {
  return REGIONS.find((r) => r.id === id)?.name ?? id;
}

/**
 * O estado da página do emulador: tudo o que a PlayPage decidia antes de
 * desenhar. Saiu de lá para a página poder ser dividida em áreas — palco,
 * troca de jogo, saves e ajustes — sem cada uma repetir os efeitos de teclado,
 * foco e pausa, que dependem um do outro e da ordem em que rodam.
 */
export function usePlayPage() {
  const emu = useEmulator();
  const lang = useLang();
  const en = lang === "en";
  // `t` já é usado nos laços desta página; a tradução se chama `tx`.
  const tx = (pt: string, enText: string) => tr(lang, pt, enText);
  const romInputRef = useRef<HTMLInputElement>(null);
  const saveInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  // A tela cheia e a escala medem a moldura, não o host do canvas: é a moldura
  // que vira o elemento de tela cheia e que define o espaço disponível.
  const screenRef = useRef<HTMLDivElement>(null);
  const display = useDisplay(screenRef, emu.canvas, emu.notify);
  // A idade dos slots é relativa a este instante. Com timer próprio: pausado,
  // nada mais re-renderiza a página, e "há 2 min" ficava parado para sempre.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  /**
   * `?jogo=<versionGroupId>` — de onde a ficha e a lore apontam para ca.
   *
   * Destaca a ROM correspondente na biblioteca, se ela existir. Se nao existir,
   * fica calado de proposito: o site nao distribui ROM e nao pode prometer um
   * jogo que quem chegou aqui talvez nao tenha.
   */
  const [searchParams, setWorkspaceParams] = useSearchParams();
  const libraryView = searchParams.get("area") !== "jogar";
  const panelParam = searchParams.get("painel");
  const sidebarArea = panelParam === "saves" || panelParam === "settings" ? panelParam : "adventure";
  const setSidebarArea = (area: "adventure" | "saves" | "settings") => setWorkspaceParams(previous => {
    const next = new URLSearchParams(previous);
    next.set("painel", area);
    return next;
  });
  const jogoPedido = searchParams.get("jogo") ?? undefined;
  const romPedida = jogoPedido
    ? emu.roms.find((r) => r.versionGroupId === jogoPedido)?.fileName
    : undefined;

  const currentRom =
    emu.status.kind === "running" || emu.status.kind === "paused"
      ? emu.status.rom
      : undefined;
  const playing = currentRom !== undefined;

  /** Ação esperando uma tecla nova, ou null. */
  const [capturing, setCapturing] = useState<string | null>(null);
  /** ROM com a remoção pendente de confirmação, ou null. */
  const [removing, setRemoving] = useState<string | null>(null);
  const gamepadName = useGamepad(emu.gamepadApi, playing && !libraryView);
  // Avulsas para o efeito dos atalhos: cada uma é estável por si, ao contrário
  // do objeto `emu`, que é novo a cada render.
  const { bindings, setTurbo, setRewinding, saveState, loadState } = emu;
  const { setInputEnabled, notify, rebindKey } = emu;
  const { pause } = emu;
  useEffect(() => {
    if (libraryView && emu.status.kind === "running") pause();
    setInputEnabled(!libraryView && !isTypingTarget(document.activeElement));
  }, [libraryView, emu.status.kind, pause, setInputEnabled]);

  const showWorkspace = (area: "biblioteca" | "jogar") => {
    setCapturing(null);
    if (area === "jogar" && emu.status.kind === "paused") emu.resume();
    setWorkspaceParams(previous => {
      const next = new URLSearchParams(previous);
      if (area === "jogar") next.set("area", "jogar");
      else next.delete("area");
      return next;
    });
  };
  const libraryGames = [
    ...(emu.localRoms ?? []).map(rom => ({ ...rom, local: true })),
    ...emu.roms.filter(rom => !emu.localRoms?.some(local => local.fileName === rom.fileName)).map(rom => ({ ...rom, local: false })),
  ];

  // Enquanto captura, o core não pode receber o teclado: a tecla que está
  // sendo escolhida iria para o jogo junto. `toggleInput(false)` desliga a
  // entrada no core, e o listener em fase de captura impede que o evento
  // chegue aos handlers que o SDL registrou.
  useEffect(() => {
    if (!capturing) return;
    setInputEnabled(false);

    const onKey = (e: KeyboardEvent) => {
      // Tab sai da captura e segue o caminho normal: sem isto o foco ficava
      // preso aqui e a ação acabava vinculada à própria tecla Tab.
      if (e.key === "Tab") {
        setCapturing(null);
        return;
      }
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.key === "Escape") {
        setCapturing(null);
        return;
      }
      const sdlKey = sdlKeyFromEvent(e);
      if (!sdlKey) {
        const shown = e.key || e.code;
        notify(
          shown
            ? tr(lang, `"${shown}" não serve como tecla de jogo. Escolha outra.`, `"${shown}" can't be used as a game key. Pick another.`)
            : tr(lang, "Não deu para identificar essa tecla. Escolha outra.", "Couldn't identify that key. Pick another.")
        );
        return;
      }
      rebindKey(capturing, sdlKey);
      setCapturing(null);
    };

    window.addEventListener("keydown", onKey, { capture: true });
    return () => {
      window.removeEventListener("keydown", onKey, { capture: true });
      setInputEnabled(true);
    };
    // Funções avulsas, e não o objeto `emu`: ele é novo a cada render, e com
    // ele na lista o efeito religava e desligava a entrada do core toda vez.
  }, [capturing, lang, setInputEnabled, notify, rebindKey]);

  /**
   * Põe o foco no palco do emulador.
   *
   * O turbo não depende mais disto — `isTypingTarget` deixou de descartar
   * teclas vindas de botões —, mas devolver o teclado ao jogo depois de
   * acionar um controle continua sendo o comportamento certo.
   */
  const focarPalco = useCallback(() => {
    emu.stageRef.current?.focus({ preventScroll: true });
  }, [emu.stageRef]);

  /** Assim que o jogo passa a rodar, o teclado é dele. */
  useEffect(() => {
    if (playing && !capturing && !libraryView) focarPalco();
  }, [playing, capturing, libraryView, focarPalco]);

  /**
   * Atalhos de teclado. Só com jogo carregado, e nunca enquanto a tela espera
   * uma tecla nova — ali a próxima tecla é a escolha, não um comando.
   */
  useEffect(() => {
    if (!playing || capturing || libraryView) return;
    const boundKeys = new Set(bindings.map((b) => b.sdlKey));

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const shortcut = shortcutFor(e, boundKeys);
      if (!shortcut) return;
      e.preventDefault();
      if (shortcut.kind === "turbo") {
        // Direto no core: o turbo é momentâneo e não pode mexer na barra de
        // velocidade, que é a preferência de quem joga.
        if (!e.repeat) setTurbo(true);
        return;
      }
      if (shortcut.kind === "rewind") {
        if (!e.repeat) setRewinding(true);
        return;
      }
      const slot = shortcut.slot as SaveStateSlot;
      if (shortcut.kind === "save") void saveState(slot);
      else loadState(slot);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const kind = shortcutFor(e, boundKeys)?.kind;
      if (kind === "turbo") setTurbo(false);
      else if (kind === "rewind") setRewinding(false);
    };

    // Tecla solta com a janela sem foco (Alt+Tab no meio do turbo) nunca gera
    // keyup aqui: sem isto o jogo ficava acelerado, ou rebobinando, até alguém
    // apertar e soltar a tecla de novo.
    const soltarTudo = () => {
      setTurbo(false);
      setRewinding(false);
    };

    // Fase de **captura**, e na janela: assim estes dois rodam antes de
    // qualquer outro ouvinte da página. O core registra os próprios handlers
    // de teclado (é como o SDL entrega as teclas ao jogo) e, na fase de
    // borbulhamento, bastaria um deles parar a propagação para o Espaço nunca
    // chegar aqui — sem deixar rastro nenhum de que sumiu. Na captura isso não
    // pode acontecer. Só o `preventDefault` atravessa, e é o que queremos: ele
    // impede que o Espaço acione um botão focado.
    window.addEventListener("keydown", onKeyDown, { capture: true });
    window.addEventListener("keyup", onKeyUp, { capture: true });
    window.addEventListener("blur", soltarTudo);
    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      window.removeEventListener("keyup", onKeyUp, { capture: true });
      window.removeEventListener("blur", soltarTudo);
      soltarTudo();
    };
    // Dependências avulsas, e não o objeto `emu`: ele é recriado a cada render,
    // e com ele na lista a limpeza rodava toda renderização — o turbo ligava e
    // era desligado no mesmo instante pelo próprio efeito.
  }, [playing, capturing, libraryView, bindings, setTurbo, setRewinding, saveState, loadState]);

  /**
   * Arquivo solto fora da moldura.
   *
   * Sem isto o navegador trata o arquivo como navegação: abre a ROM como se
   * fosse uma página e a sessão do jogo morre. A moldura continua sendo o
   * único alvo que carrega; o resto da página só recusa.
   */
  useEffect(() => {
    const recusar = (e: globalThis.DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
    };
    window.addEventListener("dragover", recusar);
    window.addEventListener("drop", recusar);
    return () => {
      window.removeEventListener("dragover", recusar);
      window.removeEventListener("drop", recusar);
    };
  }, []);

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) { showWorkspace("jogar"); void emu.playFile(file); }
  };

  return {
    capturing,
    currentRom,
    display,
    dragging,
    emu,
    en,
    focarPalco,
    gamepadName,
    lang,
    libraryGames,
    libraryView,
    now,
    onDrop,
    playing,
    removing,
    romInputRef,
    romPedida,
    saveInputRef,
    screenRef,
    setCapturing,
    setDragging,
    setInputEnabled,
    setRemoving,
    setSidebarArea,
    showWorkspace,
    sidebarArea,
    tx,
  };
}

export type PlayState = ReturnType<typeof usePlayPage>;

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import {
  listLocalSaves,
  readLocalSave,
  saveNameFor,
  writeLocalSave,
  type LocalSave,
} from "./storage";
import type { mGBAEmulator } from "./types";
import { getLoadedRom } from "./core";
import { setDiskDurability } from "./durability";

/** Intervalo mínimo entre duas gravações automáticas do mesmo jogo. */
export const DISK_BACKUP_WINDOW_MS = 5000;

/**
 * Ha progresso de verdade nestes bytes?
 *
 * O guard original testava so `length === 0`, e isso nao pega o caso comum. A
 * flash de um jogo de Gen 3 tem o tamanho certo — 131072 bytes — antes de o
 * jogo gravar qualquer coisa. Esse buffer passava pela checagem, virava arquivo
 * em `saves/` e o dono ficava com algo que parece progresso e nao e.
 *
 * **Nao basta rejeitar zeros.** Medido nos quatro saves deste repositorio:
 * `Pokemon - Emerald.sav` e uniforme `0x00`, mas os de Leaf Green, Rocket e
 * Unbound sao uniformes `0xFF` — flash apagada, que e o outro estado virgem.
 * Um teste de "tem algum byte diferente de zero" aprovaria os tres.
 *
 * Entao o criterio e "nao e uniforme": buffer em que todo byte e igual nao
 * carrega informacao nenhuma, seja 0x00, 0xFF ou o que for. Continua sendo uma
 * checagem generica de proposito, sem olhar assinatura de formato — vale igual
 * para GB, GBC e GBA, e nao precisa saber de qual geracao e o jogo. Validar por
 * assinatura de setor pertence ao parsing de save, que e outro assunto.
 */
export function hasRealSaveData(
  data: Uint8Array | undefined | null
): data is Uint8Array {
  if (!data || data.length === 0) return false;
  const primeiro = data[0];
  return data.some((byte) => byte !== primeiro);
}

/**
 * Espelho dos saves na pasta `saves/` do projeto.
 *
 * Essa e a garantia forte de durabilidade: o IndexedDB sobrevive a recarregar
 * mas pode ser descartado pelo navegador; arquivo em disco, nao. A pasta so
 * existe em dev e preview — em producao `localSaves` fica null e tudo aqui vira
 * silencio, sem quebrar nada.
 *
 * Vive fora do `useEmulator` porque nao depende do ciclo de vida do core: e uma
 * conversa com o servidor de desenvolvimento, com o core entrando so como fonte
 * dos bytes.
 */
export function useDiskBackup(
  coreRef: RefObject<mGBAEmulator | null>,
  notify: (message: string) => void,
  refreshLibrary: () => void
) {
  /** null = pasta `saves/` indisponivel (producao). */
  const [localSaves, setLocalSaves] = useState<LocalSave[] | null>(null);
  /** Último espelho que deu certo, por jogo: trocar de jogo não suprime o do outro. */
  const ultimoRef = useRef<Record<string, number>>({});
  /** A gravação final agendada de cada jogo, para o último evento da janela não se perder. */
  const pendenteRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  /** A gravacao anterior falhou? Evita repetir o aviso a cada cinco segundos. */
  const falhouAntesRef = useRef(false);
  const backupRef = useRef<((rom: string, opts?: { force?: boolean; quiet?: boolean }) => Promise<boolean>) | null>(null);

  const refreshLocalSaves = useCallback(async () => {
    setLocalSaves(await listLocalSaves());
  }, []);

  useEffect(() => {
    void refreshLocalSaves();
  }, [refreshLocalSaves]);

  useEffect(() => {
    setDiskDurability({ available: localSaves !== null });
  }, [localSaves]);

  const backupToDisk = useCallback(
    async (romName: string, opts: { force?: boolean; quiet?: boolean } = {}) => {
      const core = coreRef.current;
      if (!core || localSaves === null) return false;

      // O core dispara saveDataUpdated com frequência. Dentro da janela, em
      // vez de descartar, agenda uma gravação no fim dela — que lê o save
      // daquele momento, o mais novo. O instante só conta quando grava.
      const now = Date.now();
      const passou = now - (ultimoRef.current[romName] ?? 0);
      if (!opts.force && passou < DISK_BACKUP_WINDOW_MS) {
        if (!pendenteRef.current[romName]) {
          pendenteRef.current[romName] = setTimeout(() => {
            delete pendenteRef.current[romName];
            void backupRef.current?.(romName);
          }, DISK_BACKUP_WINDOW_MS - passou);
          setDiskDurability({ state: "pending" });
        }
        return false;
      }
      clearTimeout(pendenteRef.current[romName]);
      delete pendenteRef.current[romName];
      // O save na memória é o do jogo aberto: de outro jogo, não há o que copiar.
      if (getLoadedRom() !== romName) return false;

      const data = core.getSave();
      if (!hasRealSaveData(data)) {
        // Clique manual sem dado nao pode ser silencioso: alguns jogos (e ROMs
        // de teste) simplesmente nao tem SRAM de bateria, e um jogo que ainda
        // nao gravou tem a flash alocada e zerada — que nao e progresso.
        if (opts.force) {
          notify(
            "Este jogo ainda não gravou nada — não há save de bateria para copiar."
          );
        }
        return false;
      }

      const fileName = saveNameFor(romName);
      setDiskDurability({ state: "saving" });
      try {
        await writeLocalSave(fileName, data);
        ultimoRef.current[romName] = Date.now();
        setDiskDurability({ state: "saved", lastOk: ultimoRef.current[romName], error: undefined });
        await refreshLocalSaves();
        falhouAntesRef.current = false;
        if (opts.force && !opts.quiet) {
          notify(`${fileName} copiado para saves/ (${data.length} bytes).`);
        }
        return true;
      } catch (error) {
        const motivo =
          error instanceof Error ? error.message : String(error);
        // O backup automatico falhando em silencio e o pior caso: quem joga
        // acredita que o progresso esta espelhado em disco e nao esta. Antes,
        // o aviso so saia no clique manual.
        //
        // Avisa uma vez por sequencia de falhas, e nao a cada gravacao: o core
        // dispara saveDataUpdated com frequencia, e repetir o aviso a cada
        // cinco segundos viraria ruido que a pessoa aprende a ignorar.
        if (opts.force || !falhouAntesRef.current) {
          notify(`Não deu para gravar ${fileName} em saves/: ${motivo}`);
        }
        falhouAntesRef.current = true;
        // Sem marcar o instante: o próximo evento tenta de novo.
        setDiskDurability({ state: "failed", error: motivo });
        return false;
      }
    },
    [coreRef, localSaves, notify, refreshLocalSaves]
  );
  useEffect(() => {
    backupRef.current = backupToDisk;
  }, [backupToDisk]);

  /**
   * Grava agora o que estava esperando o fim da janela. Para as transições —
   * fechar o jogo, trocar de jogo, esconder a aba —, enquanto o jogo de antes
   * ainda está carregado.
   */
  const flushDiskBackups = useCallback(async () => {
    const pendentes = Object.keys(pendenteRef.current);
    for (const rom of pendentes) {
      clearTimeout(pendenteRef.current[rom]);
      delete pendenteRef.current[rom];
      await backupRef.current?.(rom, { force: true, quiet: true });
    }
  }, []);

  /** Traz um save da pasta `saves/` para dentro do core. */
  const restoreFromDisk = useCallback(
    async (fileName: string) => {
      const core = coreRef.current;
      if (!core) return;
      try {
        const bytes = await readLocalSave(fileName);
        const file = new File([bytes], fileName);
        await new Promise<void>((done) =>
          core.uploadSaveOrSaveState(file, done)
        );
        await core.FSSync();
        refreshLibrary();
        notify(
          `"${fileName}" restaurado da pasta saves/. Recarregue o jogo para valer.`
        );
      } catch (error) {
        notify(
          `Não deu para restaurar ${fileName}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    },
    [coreRef, notify, refreshLibrary]
  );

  return { localSaves, refreshLocalSaves, backupToDisk, flushDiskBackups, restoreFromDisk };
}

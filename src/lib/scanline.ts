/**
 * Scanline do tubo, desenhada so sobre a tela do jogo (ver App.css). Tem
 * botao para desligar porque muda a imagem de quem esta jogando.
 *
 * O estado mora num atributo do <html> em vez de num contexto do React: o
 * main.tsx aplica antes do primeiro render, entao a pagina nunca aparece sem
 * a textura para so depois ganhar ela.
 */
const KEY = "pokedex:scanline";

export function readScanline(): boolean {
  try {
    // Ligada por padrao: so fica desligada se a pessoa tiver desligado.
    return localStorage.getItem(KEY) !== "off";
  } catch {
    // Modo privado ou storage bloqueado: segue no padrao, sem quebrar.
    return true;
  }
}

export function applyScanline(on: boolean): void {
  document.documentElement.dataset.scanline = on ? "on" : "off";
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // Sem persistencia a preferencia vale so nesta visita.
  }
}

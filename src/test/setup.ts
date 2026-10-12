/**
 * Os testes rodam com o site em português, em qualquer máquina.
 *
 * O idioma padrão sai do navegador. O jsdom se apresenta como "en-US", e o
 * Node também tem um `navigator` desde a versão 21, com o idioma do sistema —
 * português na máquina de quem escreveu os testes, inglês no runner do CI. Sem
 * isto as asserções sobre texto em português passavam aqui e falhavam lá.
 *
 * Duas travas, porque há testes que trocam o `localStorage` por um falso e
 * recarregam o idioma: a preferência gravada e o idioma do "navegador". Quem
 * quer testar o inglês passa o idioma explicitamente (`tr("en", …)`).
 */
try {
  Object.defineProperty(globalThis.navigator, "languages", { value: ["pt-BR"], configurable: true });
  Object.defineProperty(globalThis.navigator, "language", { value: "pt-BR", configurable: true });
} catch {
  // sem navigator: a detecção já cai em português
}
try {
  localStorage.setItem("pokedex:lang", "pt");
} catch {
  // ambiente node, sem localStorage
}

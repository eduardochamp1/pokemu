/** Validate one cartridge header and, optionally, its battery save.
 * npm run save:check -- <rom> [save]
 * Uses the project's readers, compiled in memory; never changes the files.
 */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
async function moduleUrl(file) {
  const source = await readFile(file, 'utf8');
  let code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  const imports = [...code.matchAll(/from\s+["'](\.[^"']+)["']/g)];
  for (const match of imports) {
    const dependency = resolve(dirname(file), `${match[1]}.ts`);
    code = code.replace(match[0], `from '${await moduleUrl(dependency)}'`);
  }
  return `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
}
const [romPath, savePath] = process.argv.slice(2);
if (!romPath) throw new Error('Usage: npm run save:check -- <rom> [save]');
const { identifyRom } = await import(await moduleUrl(resolve(root, 'src/emulator/romId.ts')));
const rom = identifyRom(new Uint8Array(await readFile(romPath)));
if (!rom) throw new Error('Unrecognized or invalid cartridge header');
console.log(JSON.stringify({ rom: romPath, game: rom.jogo, generation: rom.geracao, language: rom.language, revision: rom.versao }));
if (savePath) {
  const bytes = new Uint8Array(await readFile(savePath));
  const { parseLegacySave } = await import(await moduleUrl(resolve(root, 'src/emulator/saveParse/legacy.ts')));
  const { parseGen3Save } = await import(await moduleUrl(resolve(root, 'src/emulator/saveParse/gen3.ts')));
  const save = rom.geracao < 3 ? parseLegacySave(bytes, rom) : parseGen3Save(bytes);
  if (!save) throw new Error('Battery save did not pass the cartridge reader validation');
  console.log(JSON.stringify(save, null, 2));
}

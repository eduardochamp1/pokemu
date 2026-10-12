# Assinatura digital do executável Windows

Estado em 12/10/2026: o `Pokemu-0.1.0-Windows.exe` gerado por
`npm run desktop:pack` **não é assinado**. O `package.json` diz isso de
propósito (`"signExecutable": false`): o build só edita os metadados do
executável. Sem assinatura, o Windows mostra o aviso do SmartScreen e, em
máquinas com o Smart App Control ligado, o executável é bloqueado.

Nada aqui pode ser resolvido só com código: falta um certificado, que precisa
ser comprado ou contratado por quem publica o aplicativo.

## O que falta

1. **Um certificado de assinatura de código emitido para você.** Duas formas
   comuns:
   - certificado de assinatura de código de uma autoridade certificadora (OV
     ou EV). Desde 2023 a chave privada desses certificados fica em hardware
     (token USB ou HSM na nuvem), não num arquivo `.pfx` solto;
   - um serviço de assinatura gerenciado, como o Azure Trusted Signing, em que
     a chave fica com o serviço e o build assina por uma conta.
2. **Decidir onde o build assina.** Com token USB, só a máquina com o token
   assina. Com serviço na nuvem, dá para assinar também no CI.
3. **Reputação.** Um certificado novo ainda pode mostrar o aviso do
   SmartScreen até o executável acumular reputação. Certificado autoassinado
   não resolve: o Windows não confia nele.

## O que muda no projeto quando houver certificado

As opções abaixo existem no `electron-builder` instalado (ver
`node_modules/app-builder-lib/out/options/winOptions.d.ts`). Confira os nomes
na documentação da versão em uso antes de aplicar.

- Trocar `"signExecutable": false` por `true` em `build.win`.
- **Com arquivo de certificado** (quando a autoridade ainda entrega um):
  variáveis de ambiente `CSC_LINK` (caminho ou base64 do certificado) e
  `CSC_KEY_PASSWORD`. Nunca commitar o certificado nem a senha.
- **Com token ou certificado na loja do Windows:** `build.win.signtoolOptions`
  com `certificateSubjectName` (o nome em "emitido para") ou
  `certificateSha1`.
- **Com Azure Trusted Signing:** `build.win.azureSignOptions` e as credenciais
  da conta nas variáveis de ambiente. Não pode ser combinado com
  `signtoolOptions`.

Depois de assinar, conferir no Windows: botão direito no `.exe` →
Propriedades → Assinaturas Digitais, ou `Get-AuthenticodeSignature` no
PowerShell. O status tem que ser `Valid`.

## O que não fazer

- Desligar o Smart App Control para testar. Ele não pode ser religado sem
  reinstalar o Windows, e o problema continuaria para qualquer outra pessoa.
- Distribuir o executável como "pronto para usar" enquanto ele não estiver
  assinado.

## Enquanto não há certificado

O aplicativo continua disponível de duas formas que não dependem de
assinatura: o site no navegador (com instalação como PWA) e
`npm run desktop`, que abre a janela do Electron direto do código.

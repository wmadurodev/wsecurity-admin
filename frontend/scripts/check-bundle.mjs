// Pacote inicial da SPA (RNF-DES-02): soma o tamanho gzip dos scripts, estilos e modulepreloads que o index.html
// carrega e falha o build se passar do limite. As áreas carregadas sob demanda não entram na conta.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const LIMIT_KIB = 300
const outDir = new URL('../../target/classes/static/', import.meta.url).pathname
const html = readFileSync(join(outDir, 'index.html'), 'utf8')
const assets = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.(?:js|css))"/g)].map((match) => match[1])

let total = 0
for (const asset of new Set(assets)) {
  const size = gzipSync(readFileSync(join(outDir, asset))).length
  total += size
  console.log(`  ${(size / 1024).toFixed(1).padStart(7)} KiB  ${asset}`)
}
const kib = total / 1024
console.log(`Pacote inicial: ${kib.toFixed(1)} KiB gzip (limite ${LIMIT_KIB} KiB)`)
if (kib > LIMIT_KIB) {
  console.error(
    'O pacote inicial passou do limite de RNF-DES-02. Carregue a área sob demanda (lazy) ou reduza dependências.',
  )
  process.exit(1)
}

// Atualiza os contratos OpenAPI (RNF-ARQ-04): baixa /v3/api-docs do IdP e da autorização (ambiente local, perfil dev)
// para openapi/ e gera os tipos em src/lib/api/types. Os arquivos gerados são versionados; o build não depende do
// ambiente. Endereços: IDP_URL (http://localhost:9000) e AUTHZ_URL (http://localhost:9100).
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const apis = {
  idp: process.env.IDP_URL ?? 'http://localhost:9000',
  authz: process.env.AUTHZ_URL ?? 'http://localhost:9100',
}

for (const [name, base] of Object.entries(apis)) {
  const response = await fetch(`${base}/v3/api-docs`)
  if (!response.ok) {
    throw new Error(`${base}/v3/api-docs respondeu ${response.status}. Suba o ambiente (make up-app, perfil dev).`)
  }
  const contract = await response.json()
  // O endereço do servidor muda com o ambiente; fora dele o contrato é estável.
  delete contract.servers
  writeFileSync(`openapi/${name}.json`, `${JSON.stringify(contract, null, 2)}\n`)
  console.log(`openapi/${name}.json atualizado (${Object.keys(contract.paths ?? {}).length} caminhos)`)
}

execFileSync('npm', ['run', 'openapi:generate'], { stdio: 'inherit' })

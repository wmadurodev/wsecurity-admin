# Contratos OpenAPI

Cópias versionadas de `/v3/api-docs` do IdP (`idp.json`) e da autorização (`authz.json`), usadas para gerar os tipos
da SPA em `src/lib/api/types/` com `openapi-typescript` (RNF-ARQ-04). O build não depende do ambiente.

Para atualizar, com o ambiente local no ar no perfil `dev` (`make up-app` no `wsecurity-infra`):

```bash
npm run openapi:update                                   # baixa os contratos e regenera os tipos
IDP_URL=http://localhost:19000 AUTHZ_URL=http://localhost:19100 npm run openapi:update   # portas alternativas
npm run openapi:generate                                 # só regenera os tipos a partir dos arquivos daqui
```

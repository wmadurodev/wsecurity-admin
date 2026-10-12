# wsecurity-admin

Console de administração do **wsecurity**. Pelo navegador, o administrador da plataforma gerencia o IdP (usuários,
clientes, escopos e chaves) e a autorização (catálogo, papéis globais, tenants, chaves e auditoria). O dono ou
administrador de um tenant gerencia os próprios membros, papéis e auditoria.

> Estado: **fase 0004, prompt 02 (ambiente local)**. O BFF sobe e serve uma SPA provisória, também pelo
> `wsecurity-infra`. Login, proxy e telas entram nos próximos prompts ([`wsecurity-docs/prompts/0004-admin-console`](../../wsecurity-docs/prompts/0004-admin-console/README.md)).

## Arquitetura

Padrão **BFF** (*backend-for-frontend*, DEC-01): o Spring Boot é o cliente OAuth confidencial, guarda os tokens na
sessão do servidor e repassa as chamadas da SPA às APIs. O navegador só recebe um cookie de sessão `HttpOnly`. A SPA
React é construída pelo Maven e servida pelo próprio BFF, na mesma origem (DEC-02, DEC-10).

```mermaid
flowchart LR
    browser[Navegador<br/>SPA React]
    subgraph admin[wsecurity-admin · :9200]
        bff[BFF Spring Boot<br/>sessão + tokens]
        static[SPA estática]
    end
    idp[IdP · :9000]
    az[Autorização · :9100]
    browser -->|cookie de sessão + CSRF| bff
    browser -->|GET /, /assets| static
    browser -.->|login hospedado| idp
    bff -->|code → tokens, refresh| idp
    bff -->|Bearer: /api/admin/v1/**| idp
    bff -->|Bearer: /api/admin/v1/**, /api/v1/**| az
```

## Pré-requisitos

1. [asdf](https://asdf-vm.com/) com os plugins `java`, `maven` e `nodejs`.
2. `asdf install` na raiz deste módulo. O `.tool-versions` fixa Java (openjdk-25.0.2), Maven (3.9.11) e Node
   (24.21.0 LTS, com npm 11.19.0). Daí vêm o Java da IDE e do `./mvnw` e o Node de `npm run dev`. Não use nvm nem Node/JDK
   instalados de outra forma.
3. Docker, para a imagem e para o ambiente local (`code/wsecurity-infra`).

O build pelo Maven não depende do Node da máquina: o `frontend-maven-plugin` baixa a mesma versão do Node em
`frontend/node`.

## Como construir

```bash
asdf install
./mvnw verify                    # SPA (npm ci, lint, testes, build) + BFF (testes, Spotless, ArchUnit, JaCoCo)
./mvnw verify -Dskip.frontend    # só o BFF
docker build -t wsecurity-admin .
```

## Como rodar

### Com o resto do sistema (Compose)

O console faz parte do ambiente local do [`wsecurity-infra`](../wsecurity-infra/README.md):

```bash
cd ../wsecurity-infra
make up-app        # banco, Mailpit, IdP, autorização e o console em http://localhost:9200
```

`make up-app` cadastra no IdP os dois clientes do console (`make configurar-idp`) e entrega as credenciais ao
contêiner por `.local/console-admin.env`.

### Na IDE

Suba o resto do sistema sem o console e rode o BFF no perfil `dev`. Os padrões desse perfil já apontam para o IdP em
`http://localhost:9000` e para a autorização em `http://localhost:9100`. As credenciais dos clientes vêm do arquivo
gerado pelo `wsecurity-infra`:

```bash
(cd ../wsecurity-infra && make up-app SEM_ADMIN=sim)    # ou, com o console no ar: make down-admin
set -a; source ../wsecurity-infra/.local/console-admin.env; set +a
java -jar target/wsecurity-admin-*.jar --spring.profiles.active=dev
# http://localhost:9200/            → SPA
# http://localhost:9201/actuator/health
```

Na IDE, carregue o mesmo arquivo nas variáveis de ambiente da configuração de execução (no IntelliJ, "Environment
variables" → arquivo `.env`, ou um plugin de EnvFile) e use o perfil `dev`.

Para desenvolver a SPA com recarga automática: `cd frontend && npm run dev` (Vite em `http://localhost:5174`).

## Versões fixadas

| Componente | Versão |
|------------|--------|
| Java / Spring Boot / Spring Security | 25 / 4.1.1 / 7.1 |
| Node / npm | 24.21.0 / 11.19.0 |
| React / React Router / TanStack Query | 19.3.0 / 8.4.0 / 5.104.2 |
| TypeScript / Vite / Vitest | 6.0.3 / 8.3.4 / 5.0.4 |
| Tailwind CSS / ESLint / Prettier | 4.3.3 / 10.12.0 / 3.9.10 |

As versões do `package.json` são exatas (sem `^`/`~`, RNF-TEC-03). A lista completa está em `frontend/package.json` e
no `pom.xml`.

## Configuração

Propriedades `wsecurity.admin.*` e variáveis `WSECURITY_ADMIN_*` (especificação, 04 §5):

| Variável | Padrão `dev` | Descrição |
|----------|--------------|-----------|
| `WSECURITY_ADMIN_IDP_ISSUER` | `http://localhost:9000` | `iss` esperado; base dos endpoints do IdP vistos pelo navegador |
| `WSECURITY_ADMIN_IDP_INTERNAL_URI` | o emissor | Base do IdP usada pelo BFF (no Compose: `http://authentication:9000`) |
| `WSECURITY_ADMIN_AUTHZ_URI` | `http://localhost:9100` | API da autorização (no Compose: `http://authorization:9100`) |
| `WSECURITY_ADMIN_CLIENT_ID` / `_SECRET` | — | Cliente do console (`.local/console-admin.env`) |
| `WSECURITY_ADMIN_SERVICE_CLIENT_ID` / `_SECRET` | — | Cliente de serviço do console (opcional) |
| `WSECURITY_ADMIN_PUBLIC_URI` | `http://localhost:9200` | Endereço público do console |
| `WSECURITY_ADMIN_SESSION_IDLE_TIMEOUT` / `_MAX_AGE` | `30m` / `12h` | Sessão do console |
| `WSECURITY_ADMIN_PROXY_CONNECT_TIMEOUT` / `_READ_TIMEOUT` | `2s` / `10s` | Tempos limite do BFF para as APIs |
| `WSECURITY_ADMIN_PORT` / `WSECURITY_ADMIN_MANAGEMENT_PORT` | `9200` / `9201` | Portas da aplicação e do Actuator |

Fora do perfil `dev` não há padrões para os endereços. No perfil `prod`, a subida
falha se faltarem `WSECURITY_ADMIN_IDP_ISSUER`, `WSECURITY_ADMIN_PUBLIC_URI`, `WSECURITY_ADMIN_CLIENT_ID` ou
`WSECURITY_ADMIN_CLIENT_SECRET`.

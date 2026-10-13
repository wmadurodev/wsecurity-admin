# Rastreabilidade — fase 0004 (console de administração)

Requisitos de `wsecurity-docs/specification/0004-admin-console` → status → onde está → como foi validado
(RNF-DOC-03). Os prompts são os de `wsecurity-docs/prompts/0004-admin-console` (P01 a P13). Toda validação real foi
feita contra o ambiente do `wsecurity-infra`, num projeto Compose e em portas próprias, sem tocar no ambiente que já
estava no ar na máquina (RNF-QUA-05).

Legenda das evidências: **IT** = teste de integração do BFF (`src/test/java/.../admin`); **SPA** = teste Vitest
(`frontend/src/**/*.test.ts(x)`); **E2E** = jornada Playwright (`frontend/e2e/`); **real** = validação manual pelo
navegador (Playwright) ou `curl` no ambiente do prompt indicado.

## Requisitos funcionais

| ID | Prio | Status | Onde | Validação |
|----|------|--------|------|-----------|
| RF-AUT-01 | M | implementado | `session/SecurityConfiguration`, `OAuthClientConfiguration` | IT `LoginFlowIT`; E2E jornadas 1 a 6 (login pelo formulário real do IdP) |
| RF-AUT-02 | M | implementado | `session/ScopeFallback` | IT `LoginFlowIT` (recuo uma vez, outro erro → `/login-error`); E2E jornada 1 (sem recuo) e 2 (recuo, senha pedida uma vez) |
| RF-AUT-03 | M | implementado | `session/SessionController`, `TenantAccessClient` | IT `ApplicationIT`, `LoginFlowIT`; SPA `App.test.tsx`; real P03 |
| RF-AUT-04 | M | implementado | `session/SessionTokens` | IT `LoginFlowIT` (`expiringAccessTokenIsRefreshedBeforeTheCall`, `refusedRefreshEndsTheSession`), `ProxyIT` |
| RF-AUT-05 | M | implementado | `session/SessionLifetime`; `AppLayout` (aviso) | IT `SessionLifetimeIT` (ociosidade e idade máxima); SPA `App.test.tsx`; E2E jornada 5 (ociosidade de 20 s, volta para a mesma tela) |
| RF-AUT-06 | M | implementado | `session/LogoutHandlers`; `lib/session.ts` | IT `LoginFlowIT`; SPA `App.test.tsx`; E2E jornada 1 (logout → login do IdP, `/bff/session` → `401`) |
| RF-AUT-07 | M | implementado | `templates/login-error.html`, `no-access.html`, `web/BffPagesController` | IT `ApplicationIT`; E2E jornada 4 (página "sem acesso administrativo") |
| RF-AUT-08 | S | implementado | `components/layout/AppLayout.tsx` | SPA `App.test.tsx`; real P05 (aviso para `wsecurity.admin` sem `otp`) |
| RF-BFF-01 | M | implementado | `proxy/ProxyController`, `shared/ApiClients` | IT `ProxyIT`; real P04 |
| RF-BFF-02 | M | implementado | `proxy/ProxyRoutes` | IT `ProxyRoutesSpecificationTest`, `ProxyIT` (`routesOutsideTheListAnswer404WithoutCallingTheApi`, `platformRoutesNeedTheAdminScopeAndAreNotCalledWithoutIt`); E2E jornada 6 (rota de plataforma com usuário comum → `403`) |
| RF-BFF-03 | S | implementado | `access/UserAccessController`, `ServiceTokens` | IT `UserAccessIT`, `UserAccessRefusedIT`; real P06 (aba "Acessos") |
| RF-BFF-04 | M | implementado | `shared/UpstreamErrors`, `Problems` | IT `ProxyIT` (`connectionFailureAnswers502`, `slowApiAnswers504`) |
| RF-BFF-05 | M | implementado | `proxy/ProxyController` (registro das escritas, sem corpo, token nem cookie) | IT `ProxyIT` (`writesAreLoggedWithoutBodyTokenOrCookie`) |
| RF-NAV-01 | M | implementado | `components/layout`, `routes/router.tsx` | SPA `App.test.tsx`; E2E (todas as jornadas) |
| RF-NAV-02 | M | implementado | `components/layout/AppLayout.tsx` (seletor "Contexto") | SPA `App.test.tsx` |
| RF-NAV-03 | M | implementado | `routes/guards.tsx`, `features/home` | SPA `App.test.tsx`; E2E jornadas 1 (`/platform`) e 2 (cai no único tenant) |
| RF-NAV-04 | M | implementado | `components/data-table.tsx`, `use-list-params.ts` | SPA `patterns.test.tsx`; real P05 a P11 |
| RF-NAV-05 | M | implementado | `components/form-field.tsx`, `api-form.ts`, `problem-toast.ts` | SPA `patterns.test.tsx`, `users.test.tsx`, `clients.test.tsx` |
| RF-NAV-06 | M | implementado | `components/confirm-dialog.tsx` | SPA `patterns.test.tsx`, `tenants.test.tsx` (confirmação forte); E2E jornada 2 |
| RF-NAV-07 | M | implementado | `components/conflict-notice.tsx`, `lib/api/client.ts` (`If-Match`) | SPA `patterns.test.tsx`, `tenant.test.tsx`, `tenant-roles.test.tsx` (`412`) |
| RF-NAV-08 | M | implementado | `components/permission-gate.tsx`, `routes/guards.tsx` | SPA `permission-gate.test.tsx`, `tenant.test.tsx`; E2E jornada 3 |
| RF-USR-01 | M | implementado | `features/users/UsersPage.tsx` | SPA `users.test.tsx`; E2E jornada 1 (com axe) |
| RF-USR-02 | M | implementado (MFA: ver Q-08) | `features/users/UserDetailPage.tsx`, `UserActions.tsx` | SPA `users.test.tsx`; E2E jornadas 1 e 6; a API não informa o MFA (Q-08) |
| RF-USR-03 | M | implementado | `features/users/CreateUserDialog.tsx` | SPA `users.test.tsx`; E2E jornada 1 (convite) |
| RF-USR-04 | M | implementado | `features/users/UserDataForm.tsx` | SPA `users.test.tsx` (`If-Match`); real P06 |
| RF-USR-05 | S | implementado | `features/users/UserEventsTab.tsx` | SPA `users.test.tsx`; real P06 |
| RF-USR-06 | S | implementado | `features/users/UserAccessTab.tsx` | SPA `users.test.tsx`; real P06 |
| RF-CLI-01 | M | implementado | `features/clients/ClientsPage.tsx`, `ClientDetailPage.tsx` | SPA `clients.test.tsx`; real P07 |
| RF-CLI-02 | M | implementado | `features/clients/NewClientPage.tsx`, `ClientForm.tsx`, `SecretDialog.tsx` | SPA `clients.test.tsx` (segredo exibido uma vez); real P07 |
| RF-CLI-03 | M | implementado | `features/clients/ClientForm.tsx` | SPA `clients.test.tsx`; real P07 |
| RF-CLI-04 | M | implementado | `features/clients/ClientDetailPage.tsx` | SPA `clients.test.tsx`; real P07 |
| RF-CLI-05 | M | implementado | `features/clients/ClientSecretsTab.tsx` | SPA `clients.test.tsx`; real P07 |
| RF-CLI-06 | M | implementado | `features/clients/ScopesPage.tsx` | SPA `clients.test.tsx`; real P07 |
| RF-KEY-01 | M | implementado | `features/clients/KeysPage.tsx` | SPA `clients.test.tsx`; real P07 |
| RF-KEY-02 | S | implementado | `features/clients/KeysPage.tsx` (rotação com confirmação) | SPA `clients.test.tsx`; real P07 |
| RF-CAT-01 | M | implementado | `features/catalog/ModulesPage.tsx`, `ModuleDetailPage.tsx`, `ModuleFormDialog.tsx` | SPA `roles.test.tsx`; real P08 |
| RF-CAT-02 | M | implementado | `features/catalog/FeatureFormDialog.tsx` | SPA `roles.test.tsx`; real P08 |
| RF-ROL-01 | M | implementado | `features/roles/GlobalRolesPage.tsx`, `GlobalRoleDetailPage.tsx`, `RoleEditor.tsx` | SPA `roles.test.tsx`; E2E jornada 1 |
| RF-ROL-02 | M | implementado (sem número de membros: a API não informa) | `features/tenant/TenantRolesPage.tsx`, `TenantRoleDetailPage.tsx` | SPA `tenant-roles.test.tsx`; E2E jornada 2; real P11 (papel `atendente` em `globex-sa`) |
| RF-ROL-03 | M | implementado (nomes só para a plataforma: Q-09) | `features/roles/components/PermissionMatrix.tsx`, `features/tenant/role-matrix.ts`, `permissions.ts` | SPA `roles.test.tsx`, `tenant-roles.test.tsx` (`canGrant` por chamador, só módulos contratados, linha travada); real P11 (admin sem `demo.reports`, `PUT` forjado → `403 privilege-escalation`) |
| RF-TEN-01 | M | implementado | `features/tenants/NewTenantPage.tsx`, `features/users/UserPicker.tsx` | SPA `tenants.test.tsx`; E2E jornada 1 |
| RF-TEN-02 | M | implementado | `features/tenants/TenantsPage.tsx`, `PlatformTenantPage.tsx` | SPA `tenants.test.tsx`; real P09 |
| RF-TEN-03 | M | implementado | `features/tenants/PlatformTenantPage.tsx`, `TenantDataForm.tsx` | SPA `tenants.test.tsx`; real P09 |
| RF-TEN-04 | M | implementado | `features/tenants/TenantModulesSection.tsx` | SPA `tenants.test.tsx`; real P09 |
| RF-TAD-01 | M | implementado | `features/tenant/TenantOverviewPage.tsx` | SPA `tenant.test.tsx`; E2E jornada 2 (com axe); real P10 |
| RF-TAD-02 | S | implementado | `features/tenant/TenantProfileForm.tsx` | SPA `tenant.test.tsx`; real P10 |
| RF-MEM-01 | M | implementado | `features/tenant/MembersPage.tsx`, `MemberIdentity.tsx` | SPA `tenant.test.tsx` (identificação por tipo de chamador, Q-03); E2E jornadas 2 e 3; real P10 |
| RF-MEM-02 | M | implementado | `features/tenant/AddMemberDialog.tsx`, `RolePicker.tsx` | SPA `tenant.test.tsx` (anti-escalonamento, `409`); E2E jornada 2; real P10 |
| RF-MEM-03 | M | implementado | `features/tenant/MemberDetailPage.tsx` | SPA `tenant.test.tsx` (`412`, último dono); E2E jornadas 2 e 3; real P10 |
| RF-AUD-01 | M | implementado | `features/tenant/TenantAuditPage.tsx`, `features/audit/AuditFilters.tsx`, `AuditTable.tsx` | SPA `tenant-roles.test.tsx`; E2E jornada 2; real P11 |
| RF-AUD-02 | S | implementado | `features/tenants/PlatformAuditPage.tsx` | SPA `tenants.test.tsx`; real P09 |
| RF-INF-01..05 | M/S | implementado | `code/wsecurity-infra` | veja `code/wsecurity-infra/docs/rastreabilidade.md`, seção "Fase 0004" |

## Requisitos não funcionais

| ID | Prio | Status | Validação |
|----|------|--------|-----------|
| RNF-TEC-01 | M | implementado | `pom.xml` (Java 25, Spring Boot 4.1.1, Security 7.1); `./mvnw verify` |
| RNF-TEC-02 | M | implementado | `frontend/package.json`; diálogo e seleção nativos no lugar do Radix (DEC-15) |
| RNF-TEC-03 | M | implementado | versões exatas no `package.json`, imagens com tag fixa; tabela "Versões fixadas" do README; DEC-13 |
| RNF-TEC-04 | M | implementado | `frontend-maven-plugin` no `pom.xml`: `npm ci`, `npm audit`, lint, build e testes no `./mvnw verify` |
| RNF-TEC-05 | M | implementado | coordenadas e pacote no `pom.xml`; `ArchitectureTest` |
| RNF-TEC-06 | M | implementado | `application.yaml` (9200/9201), `vite.config.ts` (5174, `strictPort`) |
| RNF-TEC-07 | M | implementado | `.tool-versions` (Java, Maven, Node); README "Pré-requisitos" |
| RNF-ARQ-01 | M | implementado | BFF sem regra de identidade ou autorização; `ArchitectureTest`; as recusas vêm das APIs (E2E jornada 3) |
| RNF-ARQ-02 | S | implementado | pacotes `session`, `proxy`, `access`, `web`, `shared`; `ArchitectureTest` (sem ciclos) |
| RNF-ARQ-03 | S | implementado | `src/features/<área>`; ESLint barra importação de arquivos internos de outra área (`eslint.config.js`) |
| RNF-ARQ-04 | S | implementado | `frontend/openapi/*.json`, `scripts/openapi-update.mjs`, tipos gerados em `src/lib/api/types` |
| RNF-ARQ-05 | M | implementado | `shared/AdminProperties`, `ProductionConfigurationCheck`; README "Configuração"; IT `ApplicationIT` |
| RNF-ARQ-06 | M | implementado | `Dockerfile` (multiestágio, JRE 25, não-root, `HEALTHCHECK`); imagem usada pelo `make up-app` |
| RNF-SEG-01 | M | implementado | IT `LoginFlowIT`; E2E jornada 6 (`HttpOnly`, `SameSite=Lax`, nome próprio) |
| RNF-SEG-02 | M | implementado | IT `LoginFlowIT` (`postWithoutCsrfHeaderIsForbidden`), `SecurityConfigurationTest`; E2E jornada 6 (`POST` sem `X-XSRF-TOKEN` → `403`) |
| RNF-SEG-03 | M | implementado | IT `LoginFlowIT` (`sessionNeverExposesTokens`, `logoutRevokesTheRefreshTokenAndRedirectsToTheIdp`); E2E jornada 6 (nenhum JWT no navegador nem em `/bff/**`) |
| RNF-SEG-04 | M | implementado | IT `SecurityHeadersIT`; E2E jornada 6 (CSP presente, sem `unsafe-*`, nenhuma violação registrada; zod `jitless`, DEC-17) |
| RNF-SEG-05 | M | implementado | IT `SecurityHeadersIT` |
| RNF-SEG-06 | M | implementado | segredos só por ambiente ou `.local/console-admin.env`; Actuator só `health` e `info` (IT `ApplicationIT`) |
| RNF-SEG-07 | M | implementado | IT `ProxyIT` (`bodiesAboveOneMebibyteAreRefused`, `ambiguousPathsAreRejectedBeforeMatching`, `locationIsRewrittenToTheBffRoute`) |
| RNF-SEG-08 | M | implementado | ESLint (`no-eval`, `dangerouslySetInnerHTML`, `localStorage`/`sessionStorage` só em `lib/preferences`); E2E jornada 6 |
| RNF-SEG-09 | S | implementado; Dependency-Check não executado | `npm audit --audit-level=high` no `./mvnw verify` (0 vulnerabilidades); Dependency-Check no perfil `security`, que exige `NVD_API_KEY`, ausente na máquina (DEC-17) |
| RNF-SEG-10 | M | implementado | `application-prod.yaml` (logs ECS em JSON); `traceparent` pelo `RestClient` com Micrometer Tracing (`shared/ApiClients`, `application.yaml`); sem tokens e corpos no log (IT `ProxyIT`) |
| RNF-UX-01 | M | implementado | textos em pt-BR; `components/date-time.tsx` (`dd/MM/yyyy HH:mm`, fuso do navegador) |
| RNF-UX-02 | S | implementado | `eslint-plugin-jsx-a11y`; axe (WCAG 2.2 AA) nas telas principais das jornadas 1, 2 e 4, sem violações sérias ou críticas, depois das correções de contraste de DEC-17 |
| RNF-UX-03 | S | implementado | barra lateral recolhível (`AppLayout`); jornadas em 1280 px |
| RNF-UX-04 | M | implementado | botões desabilitados com indicador durante as mutações (`isPending`) em todos os formulários |
| RNF-DES-01 | S | implementado | `scripts/medir-proxy.sh`: acréscimo do BFF de 8,5 ms no p95 (limite 20 ms), medição de 2026-10-12 (P04) |
| RNF-DES-02 | S | implementado | `scripts/check-bundle.mjs` no build (limite 300 KiB gzip); pacote inicial de 135 KiB (P05); rotas sob demanda |
| RNF-DES-03 | M | implementado | `shared/HttpClientsConfiguration` (pool, 2 s / 10 s configuráveis) |
| RNF-OPE-01 | M | implementado | `application-dev.yaml`, `application-prod.yaml`, `ProductionConfigurationCheck` (IT e teste unitário) |
| RNF-OPE-02 | M | implementado | probes no Actuator (9201); `HEALTHCHECK` da imagem; readiness independente das APIs (IT `ApplicationIT`) |
| RNF-OPE-03 | M | implementado | `server.shutdown=graceful` (`application.yaml`) |
| RNF-OPE-04 | M | implementado | `vite.config.ts` (proxy de `/bff`, `/oauth2`, `/login`, mesma origem 5174) |
| RNF-QUA-01 | M | implementado | WireMock (`testsupport/TestIdp`), ITs de login, recuo, renovação, proxy e cabeçalhos; JaCoCo |
| RNF-QUA-02 | M | implementado | 93 testes Vitest (10 arquivos); ESLint e Prettier sem apontamentos |
| RNF-QUA-03 | M | implementado | `frontend/e2e` + `make e2e-admin`: 7/7 num ambiente recém-criado e de novo sem reset |
| RNF-QUA-04 | M | implementado | Spotless e Prettier no `./mvnw verify` (o build falha fora do padrão) |
| RNF-QUA-05 | M | implementado | validação real em todos os prompts (coluna "Validação" acima) |
| RNF-QUA-06 | M | implementado | P13: clone novo com `--recurse-submodules` → `./mvnw verify`, `make up-app`, `make dados-exemplo`, `make verificar`, `make e2e-admin` (duas vezes), `make lint` e `make reset` |
| RNF-DOC-01 | M | implementado | `README.md` (objetivo, arquitetura, pré-requisitos, como rodar, configuração, segurança, E2E, solução de problemas) |
| RNF-DOC-02 | M | implementado | `CLAUDE.md` |
| RNF-DOC-03 | M | implementado | este documento |
| RNF-DOC-04 | M | implementado | README do workspace raiz; tabelas de fases em `specification/README.md` e `prompts/README.md` |

# wsecurity-admin

**Console de administração** do wsecurity (fase 0004): um BFF Spring Boot, que é o cliente OAuth confidencial e guarda
os tokens na sessão do servidor, e uma SPA React servida por ele na mesma origem. O console cobre as APIs
administrativas do IdP (`code/wsecurity-authentication`, fase 0001) e da autorização (`code/wsecurity-authorization`,
fase 0002). O navegador nunca recebe token.

- **Especificação (fonte de verdade):** `../../wsecurity-docs/specification/0004-admin-console/`
- **Prompts de implementação:** `../../wsecurity-docs/prompts/0004-admin-console/`

## Stack

- **BFF:** Java 25 · Spring Boot 4.1 (Spring Security 7, `oauth2Login`, `RestClient`) · Maven (wrapper) · WireMock ·
  ArchUnit · Spotless (palantir-java-format) · JaCoCo.
- **SPA:** Node 24 LTS · React 19 · TypeScript (`strict`) · Vite · React Router · TanStack Query · react-hook-form + zod ·
  Tailwind CSS 4 · shadcn/ui · lucide-react · sonner · Vitest + Testing Library + MSW · ESLint (`jsx-a11y`) + Prettier.

O ambiente vem do **asdf** (`.tool-versions`: Java, Maven e Node). Não use nvm nem Node/JDK do sistema.

## Comandos

```bash
asdf install                          # Java, Maven e Node do .tool-versions
source ~/.zshrc                       # dentro deste diretório: JAVA_HOME passa a apontar para o Java 25
./mvnw verify                         # build completo: lint, testes e build da SPA + testes, Spotless, ArchUnit e JaCoCo do BFF
./mvnw verify -Dskip.frontend         # ciclo rápido do BFF, sem a SPA
./mvnw spotless:apply                 # formata o Java
java -jar target/wsecurity-admin-*.jar --spring.profiles.active=dev   # http://localhost:9200

cd frontend                           # sempre com o Node do asdf
npm run dev                           # Vite em http://localhost:5174
npm test                              # Vitest (modo observação); npm test -- --run para uma execução
npm run lint                          # ESLint + Prettier (npm run format corrige a formatação)
```

Portas: aplicação `9200`, Actuator `9201` (só `health` e `info`), Vite `5174`. O IdP roda em `9000` e a autorização em
`9100`. O ambiente local completo é do `code/wsecurity-infra`.

## Estrutura

```
pom.xml                         # BFF + build da SPA (frontend-maven-plugin, Node em frontend/node)
src/main/java/dev/wmaduro/wsecurity/admin/
├── session/                    # oauth2Login, recuo de escopo, /bff/session, logout
├── proxy/                      # lista de rotas, repasse com Bearer, erros
├── access/                     # acessos do usuário (cliente de serviço, wsecurity.authz)
├── web/                        # SPA (fallback para index.html), cabeçalhos, páginas de erro
└── shared/                     # propriedades wsecurity.admin.*, RestClient, observabilidade
src/main/resources/             # application.yaml (+ -dev, -prod), templates/ (páginas fora da SPA)
frontend/
├── openapi/                    # contratos copiados de /v3/api-docs
└── src/
    ├── routes/                 # rotas do React Router
    ├── features/<área>/        # páginas, componentes, chamadas e esquemas zod de cada área
    ├── components/ui/          # componentes do shadcn/ui (copiados só quando usados)
    └── lib/                    # cliente HTTP, sessão, erros, utilitários
```

Pacotes do BFF sem ciclos e `shared` sem depender dos demais (`ArchitectureTest`). Na SPA, uma área de `features/`
não importa os arquivos internos de outra.

## Regras gerais

1. **Fonte de verdade:** `wsecurity-docs/specification/0004-admin-console/`. Em conflito, vale a especificação;
   aponte a divergência no resumo final.
2. **Fases anteriores congeladas:** nunca altere especificações, prompts ou **código** de `wsecurity-authentication`
   e `wsecurity-authorization`. Se faltar algo numa API, registre uma questão `Q-xx` e contorne no console sem mudar
   o módulo. Em `wsecurity-infra`, mude só o que RF-INF pede, sem alterar a especificação da fase 0003.
3. **Escopo:** implemente apenas o que o prompt pede; não antecipe prompts futuros nem itens `C`/`W`.
4. **Idioma:** código, identificadores, rotas e testes em inglês. Textos da interface, mensagens, comentários de
   documentação e documentação em pt-BR. Scripts do `wsecurity-infra` seguem o padrão em português de lá.
5. **Contratos reais:** antes de escrever uma tela, leia o contrato da API em `/v3/api-docs` (cópia em
   `frontend/openapi/`) e confira os campos, os filtros e os erros com o ambiente rodando. Não invente campos.
6. **Segurança primeiro:** nenhum token no navegador (RN-01); nenhuma rota fora da lista (04 §3.2); nada de
   `dangerouslySetInnerHTML`, `eval`, `localStorage` para dados de sessão; CSP sem `unsafe-inline`.
7. **Interface:** componentes do `src/components/ui` (shadcn) e os padrões de lista, formulário, erro e confirmação do
   prompt 05; nada de estilos ad hoc repetidos. Toda tela tem estados de carregamento, vazio e erro.
8. **Validação real (RNF-QUA-05):** suba o ambiente com `wsecurity-infra` (`make up-app`, `make dados-exemplo`) e
   exercite o que o prompt entrega no navegador e por `curl` no BFF. Se já houver um ambiente usando as portas padrão,
   use `COMPOSE_PROJECT_NAME` e portas alternativas e nunca pare processos ou contêineres que não foram criados pelo
   prompt. Ao final, derrube o que subiu.
9. **Build:** `./mvnw verify` verde (inclui lint, testes e build da SPA) ao final de cada prompt. Rode o Maven depois
   de `source ~/.zshrc` neste diretório, para carregar o `JAVA_HOME`. Java, Maven e Node vêm do `.tool-versions`
   (`asdf install`); `npm`/`node` sempre dentro do módulo, com o Node do asdf.
10. **Resumo final:** arquivos criados ou alterados, IDs implementados, como foi validado, desvios e pendências.

## Fluxo de trabalho (git)

Remoto `git@github.com:wmadurodev/wsecurity-admin.git`, submódulo `code/wsecurity-admin` do workspace (DEC-11). Para
cada prompt da fase:

1. Branch `0004/NN-nome-do-prompt` criada a partir de `main`, em cada repositório alterado.
2. Commit com `./mvnw verify` verde; push dos submódulos antes de atualizar as referências no workspace.
3. Tag anotada `0004-NN` em **todos** os repositórios (admin, infra, authentication, authorization, docs e workspace).
4. Merge em `main` somente por fast-forward (`git merge --ff-only`), depois de validado; push de branches, tags e `main`.

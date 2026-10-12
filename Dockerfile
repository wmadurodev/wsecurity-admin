# Imagem OCI do wsecurity-admin (RNF-ARQ-06): build com Maven Wrapper (que também instala o Node e constrói a SPA,
# RNF-TEC-04), camadas do Spring Boot extraídas para melhor cache, execução com JRE 25 como usuário não-root e health
# check na porta de gerenciamento.

FROM eclipse-temurin:25-jdk AS build
WORKDIR /workspace
COPY mvnw pom.xml ./
COPY .mvn .mvn
RUN ./mvnw -B -ntp dependency:go-offline
# Node, npm e node_modules numa camada própria: só mudam com o package-lock.json.
COPY frontend/package.json frontend/package-lock.json frontend/.npmrc frontend/
RUN ./mvnw -B -ntp frontend:install-node-and-npm@install-node-and-npm frontend:npm@npm-ci
COPY frontend frontend
COPY src src
RUN ./mvnw -B -ntp -DskipTests -Dspotless.check.skip=true -Djacoco.skip=true package \
    && java -Djarmode=tools -jar target/wsecurity-admin-*.jar extract --layers --launcher --destination extracted

FROM eclipse-temurin:25-jre
ARG UID=10001
RUN useradd --system --uid ${UID} --no-create-home --shell /usr/sbin/nologin wsecurity
WORKDIR /app
COPY --from=build --chown=wsecurity /workspace/extracted/dependencies/ ./
COPY --from=build --chown=wsecurity /workspace/extracted/spring-boot-loader/ ./
COPY --from=build --chown=wsecurity /workspace/extracted/application/ ./
USER wsecurity
ENV SPRING_PROFILES_ACTIVE=prod \
    JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError"
EXPOSE 9200 9201
# Sem curl/wget na imagem: o health check usa o /dev/tcp do bash.
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=3 \
    CMD bash -c 'exec 3<>/dev/tcp/127.0.0.1/${WSECURITY_ADMIN_MANAGEMENT_PORT:-9201} \
        && printf "GET /actuator/health/readiness HTTP/1.0\r\n\r\n" >&3 && grep -q "\"UP\"" <&3'
ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]

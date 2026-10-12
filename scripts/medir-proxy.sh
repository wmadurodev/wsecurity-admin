#!/usr/bin/env bash
#
# Mede o acréscimo de latência do proxy do BFF (RNF-DES-01): compara GET /bff/api/authz/admin/v1/tenants (pelo console,
# com a sessão de um administrador) com a mesma chamada direta à autorização (com um token wsecurity.admin).
#
# Uso:
#   COOKIES=<cookie jar do curl com a sessão do console> TOKEN=<access token wsecurity.admin> ./scripts/medir-proxy.sh
#
# Variáveis opcionais: CONSOLE (http://localhost:9200), AUTHZ (http://localhost:9100), N (200 requisições por lado).
# O token vai ao curl pela entrada padrão, nunca pela linha de comando.

set -euo pipefail

CONSOLE=${CONSOLE:-http://localhost:9200}
AUTHZ=${AUTHZ:-http://localhost:9100}
N=${N:-200}
: "${COOKIES:?informe COOKIES (cookie jar do curl com a sessão do console)}"
: "${TOKEN:?informe TOKEN (access token com wsecurity.admin, ex.: make -s token-admin no wsecurity-infra)}"

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

amostras() { # amostras <rótulo> <curl args...> → tempos em ms, um por linha
  local rotulo=$1
  shift
  for _ in $(seq 1 "$N"); do
    "$@" -s -o /dev/null -w '%{time_total}\n'
  done | awk '{ printf "%.3f\n", $1 * 1000 }' >"$TMP/$rotulo.txt"
}

percentil() { # percentil <arquivo> <p>
  sort -n "$1" | awk -v p="$2" '{ v[NR] = $1 } END { i = int((NR * p / 100) + 0.999); if (i < 1) i = 1; print v[i] }'
}

# Aquecimento
curl -s -o /dev/null -b "$COOKIES" "$CONSOLE/bff/api/authz/admin/v1/tenants"
printf 'header = "Authorization: Bearer %s"\n' "$TOKEN" | curl -s -o /dev/null -K - "$AUTHZ/api/admin/v1/tenants"

amostras bff curl -b "$COOKIES" "$CONSOLE/bff/api/authz/admin/v1/tenants"
direto() { printf 'header = "Authorization: Bearer %s"\n' "$TOKEN" | curl -K - "$@"; }
amostras direto direto "$AUTHZ/api/admin/v1/tenants"

printf '%-8s %8s %8s\n' '' 'p50 (ms)' 'p95 (ms)'
for lado in direto bff; do
  printf '%-8s %8s %8s\n' "$lado" "$(percentil "$TMP/$lado.txt" 50)" "$(percentil "$TMP/$lado.txt" 95)"
done
awk -v a="$(percentil "$TMP/bff.txt" 95)" -v b="$(percentil "$TMP/direto.txt" 95)" \
  'BEGIN { printf "acréscimo do BFF no p95: %.1f ms (limite: 20 ms)\n", a - b }'

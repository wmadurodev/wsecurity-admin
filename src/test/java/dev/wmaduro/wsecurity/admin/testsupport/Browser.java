package dev.wmaduro.wsecurity.admin.testsupport;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.HttpCookie;
import java.net.URI;
import java.net.URLDecoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

/** Navegador mínimo dos testes: guarda cookies e não segue redirecionamentos. */
public final class Browser {

    private final String base;
    private final CookieManager cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
    private final HttpClient client;

    public Browser(String base) {
        this.base = base;
        this.client = HttpClient.newBuilder()
                .cookieHandler(cookies)
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
    }

    public HttpResponse<String> get(String pathOrUrl, String... headers) {
        return send(HttpRequest.newBuilder(uri(pathOrUrl)).GET(), headers);
    }

    public HttpResponse<String> post(String pathOrUrl, String... headers) {
        return send(HttpRequest.newBuilder(uri(pathOrUrl)).POST(HttpRequest.BodyPublishers.noBody()), headers);
    }

    public HttpResponse<String> postJson(String pathOrUrl, String json, String... headers) {
        return send(
                HttpRequest.newBuilder(uri(pathOrUrl))
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(json)),
                headers);
    }

    public HttpResponse<String> put(String pathOrUrl, String... headers) {
        return send(HttpRequest.newBuilder(uri(pathOrUrl)).PUT(HttpRequest.BodyPublishers.noBody()), headers);
    }

    public HttpResponse<String> patch(String pathOrUrl, String body, String... headers) {
        return send(
                HttpRequest.newBuilder(uri(pathOrUrl)).method("PATCH", HttpRequest.BodyPublishers.ofString(body)),
                headers);
    }

    public CookieManager cookies() {
        return cookies;
    }

    public HttpResponse<String> postForm(String pathOrUrl, String form, String... headers) {
        return send(
                HttpRequest.newBuilder(uri(pathOrUrl))
                        .header("Content-Type", "application/x-www-form-urlencoded")
                        .POST(HttpRequest.BodyPublishers.ofString(form)),
                headers);
    }

    public String cookie(String name) {
        return cookies.getCookieStore().getCookies().stream()
                .filter(cookie -> cookie.getName().equals(name))
                .map(HttpCookie::getValue)
                .findFirst()
                .orElse(null);
    }

    public static String location(HttpResponse<?> response) {
        return response.headers().firstValue("Location").orElseThrow();
    }

    public static Map<String, String> query(String url) {
        Map<String, String> params = new LinkedHashMap<>();
        String query = URI.create(url).getRawQuery();
        if (query == null) {
            return params;
        }
        for (String pair : query.split("&")) {
            int equals = pair.indexOf('=');
            params.put(
                    URLDecoder.decode(pair.substring(0, equals), StandardCharsets.UTF_8),
                    URLDecoder.decode(pair.substring(equals + 1), StandardCharsets.UTF_8));
        }
        return params;
    }

    private URI uri(String pathOrUrl) {
        return URI.create(pathOrUrl.startsWith("http") ? pathOrUrl : base + pathOrUrl);
    }

    private HttpResponse<String> send(HttpRequest.Builder request, String... headers) {
        for (int i = 0; i < headers.length; i += 2) {
            request.header(headers[i], headers[i + 1]);
        }
        try {
            return client.send(request.build(), HttpResponse.BodyHandlers.ofString());
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
    }
}

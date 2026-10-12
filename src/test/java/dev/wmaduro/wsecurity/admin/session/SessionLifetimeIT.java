package dev.wmaduro.wsecurity.admin.session;

import static org.assertj.core.api.Assertions.assertThat;

import dev.wmaduro.wsecurity.admin.testsupport.AbstractLoginIT;
import dev.wmaduro.wsecurity.admin.testsupport.Browser;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.TestPropertySource;

/** Expiração por inatividade e por idade máxima (RF-AUT-05), com tempos curtos. */
@TestPropertySource(properties = {"wsecurity.admin.session.idle-timeout=2s", "wsecurity.admin.session.max-age=4s"})
class SessionLifetimeIT extends AbstractLoginIT {

    @Test
    void sessionExpiresAfterInactivity() throws InterruptedException {
        Browser browser = browser();
        login(browser, "/", Login.asAdmin());
        assertThat(browser.get("/bff/session").statusCode()).isEqualTo(200);

        Thread.sleep(3_000);

        assertThat(browser.get("/bff/session").statusCode()).isEqualTo(401);
    }

    @Test
    void sessionExpiresAtMaxAgeEvenWhenInUse() throws InterruptedException {
        Browser browser = browser();
        login(browser, "/", Login.asAdmin());
        HttpResponse<String> last = browser.get("/bff/session");
        for (int i = 0; i < 6 && last.statusCode() == 200; i++) {
            Thread.sleep(1_000);
            last = browser.get("/bff/session");
        }

        assertThat(last.statusCode()).isEqualTo(401);
        assertThat(last.body()).contains("https://wsecurity.dev/problems/session-expired");
        assertThat(browser.get("/").statusCode()).isEqualTo(302);
    }
}

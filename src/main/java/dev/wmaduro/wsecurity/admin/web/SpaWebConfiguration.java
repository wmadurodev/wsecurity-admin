package dev.wmaduro.wsecurity.admin.web;

import java.time.Duration;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * A SPA construída pelo Vite fica em {@code classpath:/static} e é servida na mesma origem do BFF (DEC-02, DEC-10).
 * Os <i>assets</i> têm <i>hash</i> no nome e cache longo; o {@code index.html} e o resto ficam com o {@code no-store}
 * padrão da segurança (RNF-SEG-05). As páginas do BFF fora da SPA usam o CSS de {@code classpath:/pages}.
 */
@Configuration(proxyBeanMethods = false)
class SpaWebConfiguration implements WebMvcConfigurer {

    static final CacheControl IMMUTABLE =
            CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable();

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/assets/**")
                .addResourceLocations("classpath:/static/assets/")
                .setCacheControl(IMMUTABLE);
        registry.addResourceHandler("/pages/**")
                .addResourceLocations("classpath:/pages/")
                .setCacheControl(CacheControl.maxAge(Duration.ofHours(1)));
        registry.addResourceHandler("/**")
                .addResourceLocations("classpath:/static/")
                .resourceChain(true)
                .addResolver(new SpaFallbackResourceResolver());
    }
}

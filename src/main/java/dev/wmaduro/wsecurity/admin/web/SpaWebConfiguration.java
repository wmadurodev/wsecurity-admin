package dev.wmaduro.wsecurity.admin.web;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** A SPA construída pelo Vite fica em {@code classpath:/static} e é servida na mesma origem do BFF (DEC-02, DEC-10). */
@Configuration(proxyBeanMethods = false)
class SpaWebConfiguration implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/**")
                .addResourceLocations("classpath:/static/")
                .resourceChain(true)
                .addResolver(new SpaFallbackResourceResolver());
    }
}

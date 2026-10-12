package dev.wmaduro.wsecurity.admin.shared;

import java.net.http.HttpClient;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration(proxyBeanMethods = false)
class HttpClientsConfiguration {

    @Bean
    ApiClients apiClients(RestClient.Builder builder, AdminProperties properties) {
        // Um HttpClient (e seu pool de conexões) compartilhado pelas duas APIs.
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(properties.proxy().connectTimeout())
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(properties.proxy().readTimeout());
        return new ApiClients(
                builder.clone()
                        .requestFactory(requestFactory)
                        .baseUrl(properties.idp().internalUri().toString())
                        .build(),
                builder.clone()
                        .requestFactory(requestFactory)
                        .baseUrl(properties.authz().uri().toString())
                        .build());
    }
}

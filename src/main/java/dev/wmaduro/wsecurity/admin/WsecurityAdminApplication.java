package dev.wmaduro.wsecurity.admin;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class WsecurityAdminApplication {

    public static void main(String[] args) {
        SpringApplication.run(WsecurityAdminApplication.class, args);
    }
}

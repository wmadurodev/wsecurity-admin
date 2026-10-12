package dev.wmaduro.wsecurity.admin.web;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

/** Páginas do BFF fora da SPA (RF-AUT-07), sem detalhes internos e sem <i>scripts</i>. */
@Controller
class BffPagesController {

    @GetMapping("/login-error")
    String loginError() {
        return "login-error";
    }

    @GetMapping("/no-access")
    String noAccess(@AuthenticationPrincipal OidcUser user, Model model) {
        model.addAttribute("email", user == null ? null : user.getEmail());
        return "no-access";
    }
}

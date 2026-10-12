package dev.wmaduro.wsecurity.admin;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.library.dependencies.SlicesRuleDefinition.slices;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

/**
 * Regras de arquitetura do BFF (RNF-ARQ-02): pacotes por responsabilidade ({@code session}, {@code proxy},
 * {@code access}, {@code web}, {@code shared}) sem ciclos entre si; {@code shared} não depende dos demais.
 */
@AnalyzeClasses(packages = "dev.wmaduro.wsecurity.admin", importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureTest {

    private static final String ROOT = "dev.wmaduro.wsecurity.admin";

    @ArchTest
    static final ArchRule noCyclesBetweenPackages =
            slices().matching(ROOT + ".(*)..").should().beFreeOfCycles();

    @ArchTest
    static final ArchRule sharedDoesNotDependOnOtherPackages = noClasses()
            .that()
            .resideInAPackage(ROOT + ".shared..")
            .should()
            .dependOnClassesThat()
            .resideInAnyPackage(ROOT + ".session..", ROOT + ".proxy..", ROOT + ".access..", ROOT + ".web..")
            .because("shared é transversal");
}

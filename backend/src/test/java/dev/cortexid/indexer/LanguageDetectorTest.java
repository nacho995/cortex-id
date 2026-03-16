package dev.cortexid.indexer;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for LanguageDetector.
 * Verifies all major file extensions, special filenames, and edge cases.
 */
@DisplayName("LanguageDetector")
class LanguageDetectorTest {

    private LanguageDetector detector;

    @BeforeEach
    void setUp() {
        detector = new LanguageDetector();
    }

    @Nested
    @DisplayName("JVM languages")
    class JvmLanguagesTests {

        @ParameterizedTest(name = "{0} → {1}")
        @CsvSource({
            "Main.java, java",
            "Service.kt, kotlin",
            "build.kts, kotlin",
            "Main.scala, scala",
            "build.groovy, groovy",
            "build.gradle, groovy"
        })
        @DisplayName("detects JVM language from extension")
        void detect_jvmLanguages(String fileName, String expectedLanguage) {
            assertThat(detector.detect(fileName)).isEqualTo(expectedLanguage);
        }
    }

    @Nested
    @DisplayName("Web languages")
    class WebLanguagesTests {

        @ParameterizedTest(name = "{0} → {1}")
        @CsvSource({
            "index.ts, typescript",
            "App.tsx, typescriptreact",
            "app.js, javascript",
            "Component.jsx, javascriptreact",
            "index.html, html",
            "page.htm, html",
            "styles.css, css",
            "styles.scss, scss",
            "styles.sass, sass",
            "styles.less, less"
        })
        @DisplayName("detects web language from extension")
        void detect_webLanguages(String fileName, String expectedLanguage) {
            assertThat(detector.detect(fileName)).isEqualTo(expectedLanguage);
        }
    }

    @Nested
    @DisplayName(".NET languages")
    class DotNetLanguagesTests {

        @ParameterizedTest(name = "{0} → {1}")
        @CsvSource({
            "Program.cs, csharp",
            "Module.fs, fsharp",
            "Module.vb, vb"
        })
        @DisplayName("detects .NET language from extension")
        void detect_dotNetLanguages(String fileName, String expectedLanguage) {
            assertThat(detector.detect(fileName)).isEqualTo(expectedLanguage);
        }
    }

    @Nested
    @DisplayName("Systems languages")
    class SystemsLanguagesTests {

        @ParameterizedTest(name = "{0} → {1}")
        @CsvSource({
            "main.c, c",
            "header.h, c",
            "main.cpp, cpp",
            "main.cc, cpp",
            "main.cxx, cpp",
            "header.hpp, cpp",
            "main.rs, rust",
            "main.go, go"
        })
        @DisplayName("detects systems language from extension")
        void detect_systemsLanguages(String fileName, String expectedLanguage) {
            assertThat(detector.detect(fileName)).isEqualTo(expectedLanguage);
        }
    }

    @Nested
    @DisplayName("Scripting languages")
    class ScriptingLanguagesTests {

        @ParameterizedTest(name = "{0} → {1}")
        @CsvSource({
            "main.py, python",
            "app.rb, ruby",
            "index.php, php",
            "script.lua, lua",
            "script.pl, perl",
            "script.sh, shell",
            "script.bash, shell",
            "script.zsh, shell",
            "script.fish, shell",
            "script.ps1, powershell"
        })
        @DisplayName("detects scripting language from extension")
        void detect_scriptingLanguages(String fileName, String expectedLanguage) {
            assertThat(detector.detect(fileName)).isEqualTo(expectedLanguage);
        }
    }

    @Nested
    @DisplayName("Data and config formats")
    class DataConfigTests {

        @ParameterizedTest(name = "{0} → {1}")
        @CsvSource({
            "package.json, json",
            "config.yaml, yaml",
            "config.yml, yaml",
            "Cargo.toml, toml",
            "pom.xml, xml",
            "schema.sql, sql",
            "schema.graphql, graphql",
            "schema.gql, graphql",
            "service.proto, protobuf",
            "main.tf, terraform",
            "main.hcl, hcl"
        })
        @DisplayName("detects data/config format from extension")
        void detect_dataConfigFormats(String fileName, String expectedLanguage) {
            assertThat(detector.detect(fileName)).isEqualTo(expectedLanguage);
        }
    }

    @Nested
    @DisplayName("Documentation formats")
    class DocumentationTests {

        @ParameterizedTest(name = "{0} → {1}")
        @CsvSource({
            "README.md, markdown",
            "guide.mdx, mdx",
            "guide.rst, restructuredtext",
            "paper.tex, latex"
        })
        @DisplayName("detects documentation format from extension")
        void detect_documentationFormats(String fileName, String expectedLanguage) {
            assertThat(detector.detect(fileName)).isEqualTo(expectedLanguage);
        }
    }

    @Nested
    @DisplayName("Other languages")
    class OtherLanguagesTests {

        @ParameterizedTest(name = "{0} → {1}")
        @CsvSource({
            "App.swift, swift",
            "main.dart, dart",
            "analysis.r, r"
        })
        @DisplayName("detects other languages from extension")
        void detect_otherLanguages(String fileName, String expectedLanguage) {
            assertThat(detector.detect(fileName)).isEqualTo(expectedLanguage);
        }
    }

    @Nested
    @DisplayName("Special filenames without extensions")
    class SpecialFilenamesTests {

        @Test
        @DisplayName("detects Dockerfile")
        void detect_dockerfile() {
            assertThat(detector.detect("Dockerfile")).isEqualTo("dockerfile");
            assertThat(detector.detect("dockerfile")).isEqualTo("dockerfile");
            assertThat(detector.detect("Dockerfile.dev")).isEqualTo("dockerfile");
        }

        @Test
        @DisplayName("detects Makefile")
        void detect_makefile() {
            assertThat(detector.detect("Makefile")).isEqualTo("makefile");
            assertThat(detector.detect("GNUmakefile")).isEqualTo("makefile");
        }

        @Test
        @DisplayName("detects .gitignore and .gitattributes")
        void detect_gitFiles() {
            assertThat(detector.detect(".gitignore")).isEqualTo("gitignore");
            assertThat(detector.detect(".gitattributes")).isEqualTo("gitignore");
        }

        @Test
        @DisplayName("detects .env files")
        void detect_envFiles() {
            assertThat(detector.detect(".env")).isEqualTo("dotenv");
            assertThat(detector.detect(".env.local")).isEqualTo("dotenv");
            assertThat(detector.detect(".env.production")).isEqualTo("dotenv");
        }
    }

    @Nested
    @DisplayName("Unknown extensions")
    class UnknownExtensionsTests {

        @ParameterizedTest(name = "{0} → plaintext")
        @ValueSource(strings = {"file.xyz", "file.unknown", "file.abc123", "file.qwerty"})
        @DisplayName("returns plaintext for unknown extensions")
        void detect_unknownExtension_returnsPlaintext(String fileName) {
            assertThat(detector.detect(fileName)).isEqualTo("plaintext");
        }

        @Test
        @DisplayName("returns plaintext for file with no extension")
        void detect_noExtension_returnsPlaintext() {
            assertThat(detector.detect("noextension")).isEqualTo("plaintext");
        }

        @Test
        @DisplayName("returns plaintext for file ending with dot")
        void detect_trailingDot_returnsPlaintext() {
            assertThat(detector.detect("file.")).isEqualTo("plaintext");
        }
    }

    @Nested
    @DisplayName("Edge cases")
    class EdgeCasesTests {

        @Test
        @DisplayName("returns plaintext for null input")
        void detect_null_returnsPlaintext() {
            assertThat(detector.detect(null)).isEqualTo("plaintext");
        }

        @Test
        @DisplayName("returns plaintext for empty string")
        void detect_emptyString_returnsPlaintext() {
            assertThat(detector.detect("")).isEqualTo("plaintext");
        }

        @Test
        @DisplayName("returns plaintext for blank string")
        void detect_blankString_returnsPlaintext() {
            assertThat(detector.detect("   ")).isEqualTo("plaintext");
        }

        @Test
        @DisplayName("is case-insensitive for extensions")
        void detect_caseInsensitive() {
            assertThat(detector.detect("Main.JAVA")).isEqualTo("java");
            assertThat(detector.detect("index.TS")).isEqualTo("typescript");
            assertThat(detector.detect("App.TSX")).isEqualTo("typescriptreact");
            assertThat(detector.detect("styles.CSS")).isEqualTo("css");
        }

        @Test
        @DisplayName("handles file paths with directory separators")
        void detect_withFullPath_detectsFromFileName() {
            // detect() works on the full string, so it uses the last dot
            assertThat(detector.detect("src/main/java/App.java")).isEqualTo("java");
            assertThat(detector.detect("/home/user/project/index.ts")).isEqualTo("typescript");
        }
    }

    @Nested
    @DisplayName("isIndexable")
    class IsIndexableTests {

        @Test
        @DisplayName("returns true for known programming language files")
        void isIndexable_knownLanguage_returnsTrue() {
            assertThat(detector.isIndexable("Main.java")).isTrue();
            assertThat(detector.isIndexable("index.ts")).isTrue();
            assertThat(detector.isIndexable("app.py")).isTrue();
        }

        @Test
        @DisplayName("returns true for known text files without language")
        void isIndexable_knownTextFiles_returnsTrue() {
            assertThat(detector.isIndexable("README")).isTrue();
            assertThat(detector.isIndexable("LICENSE")).isTrue();
            assertThat(detector.isIndexable("Makefile")).isTrue();
            assertThat(detector.isIndexable("Dockerfile")).isTrue();
            assertThat(detector.isIndexable(".gitignore")).isTrue();
        }

        @Test
        @DisplayName("returns false for unknown extension files")
        void isIndexable_unknownExtension_returnsFalse() {
            assertThat(detector.isIndexable("file.xyz")).isFalse();
            assertThat(detector.isIndexable("binary.bin")).isFalse();
        }
    }
}

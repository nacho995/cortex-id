package dev.cortexid.indexer;

import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Detects programming language from file extension.
 * Returns a language identifier compatible with Monaco Editor and LSP.
 */
@Component
public class LanguageDetector {

    private static final Map<String, String> EXTENSION_MAP = Map.ofEntries(
        // JVM
        Map.entry("java", "java"),
        Map.entry("kt", "kotlin"),
        Map.entry("kts", "kotlin"),
        Map.entry("scala", "scala"),
        Map.entry("groovy", "groovy"),
        // Web
        Map.entry("ts", "typescript"),
        Map.entry("tsx", "typescriptreact"),
        Map.entry("js", "javascript"),
        Map.entry("jsx", "javascriptreact"),
        Map.entry("html", "html"),
        Map.entry("htm", "html"),
        Map.entry("css", "css"),
        Map.entry("scss", "scss"),
        Map.entry("sass", "sass"),
        Map.entry("less", "less"),
        // .NET
        Map.entry("cs", "csharp"),
        Map.entry("fs", "fsharp"),
        Map.entry("vb", "vb"),
        // Systems
        Map.entry("c", "c"),
        Map.entry("h", "c"),
        Map.entry("cpp", "cpp"),
        Map.entry("cc", "cpp"),
        Map.entry("cxx", "cpp"),
        Map.entry("hpp", "cpp"),
        Map.entry("rs", "rust"),
        Map.entry("go", "go"),
        // Scripting
        Map.entry("py", "python"),
        Map.entry("rb", "ruby"),
        Map.entry("php", "php"),
        Map.entry("lua", "lua"),
        Map.entry("pl", "perl"),
        Map.entry("sh", "shell"),
        Map.entry("bash", "shell"),
        Map.entry("zsh", "shell"),
        Map.entry("fish", "shell"),
        Map.entry("ps1", "powershell"),
        // Data / Config
        Map.entry("json", "json"),
        Map.entry("yaml", "yaml"),
        Map.entry("yml", "yaml"),
        Map.entry("toml", "toml"),
        Map.entry("xml", "xml"),
        Map.entry("sql", "sql"),
        Map.entry("graphql", "graphql"),
        Map.entry("gql", "graphql"),
        Map.entry("proto", "protobuf"),
        // Docs
        Map.entry("md", "markdown"),
        Map.entry("mdx", "mdx"),
        Map.entry("rst", "restructuredtext"),
        Map.entry("tex", "latex"),
        // Build
        Map.entry("gradle", "groovy"),
        Map.entry("dockerfile", "dockerfile"),
        Map.entry("tf", "terraform"),
        Map.entry("hcl", "hcl"),
        Map.entry("swift", "swift"),
        Map.entry("dart", "dart"),
        Map.entry("r", "r")
    );

    /**
     * Detect language from a file name or path.
     *
     * @param fileName File name (e.g. "Main.java", "index.ts")
     * @return Language identifier or "plaintext" if unknown
     */
    public String detect(String fileName) {
        if (fileName == null || fileName.isBlank()) return "plaintext";

        String lower = fileName.toLowerCase();

        // Handle special filenames without extensions
        if (lower.equals("dockerfile") || lower.startsWith("dockerfile.")) return "dockerfile";
        if (lower.equals("makefile") || lower.equals("gnumakefile")) return "makefile";
        if (lower.equals(".gitignore") || lower.equals(".gitattributes")) return "gitignore";
        if (lower.equals(".env") || lower.startsWith(".env.")) return "dotenv";

        int dotIndex = lower.lastIndexOf('.');
        if (dotIndex < 0 || dotIndex == lower.length() - 1) return "plaintext";

        String extension = lower.substring(dotIndex + 1);
        return EXTENSION_MAP.getOrDefault(extension, "plaintext");
    }

    /**
     * Check if a file should be indexed based on its extension.
     */
    public boolean isIndexable(String fileName) {
        String language = detect(fileName);
        return !"plaintext".equals(language) || isKnownTextFile(fileName);
    }

    private boolean isKnownTextFile(String fileName) {
        String lower = fileName.toLowerCase();
        return lower.equals("readme") || lower.equals("license") || lower.equals("changelog")
            || lower.equals("makefile") || lower.equals("dockerfile")
            || lower.equals(".gitignore") || lower.equals(".editorconfig");
    }
}

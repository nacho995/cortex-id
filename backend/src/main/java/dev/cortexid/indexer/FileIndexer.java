package dev.cortexid.indexer;

import dev.cortexid.websocket.SessionRegistry;
import dev.cortexid.websocket.WsMessage;
import dev.cortexid.websocket.WsMessageTypes;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.attribute.BasicFileAttributes;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * File indexer service.
 * Walks a project directory, extracts file metadata, and stores it in SQLite.
 * Sends progress updates via WebSocket during indexing.
 */
@Service
public class FileIndexer {

    private static final Logger log = LoggerFactory.getLogger(FileIndexer.class);

    /** Directories to skip during indexing. */
    private static final Set<String> IGNORED_DIRS = Set.of(
        ".git", ".svn", ".hg",
        "node_modules", ".pnpm-store",
        "target", "build", "dist", "out", ".next", ".nuxt",
        "__pycache__", ".venv", "venv", ".env",
        ".idea", ".vscode", ".eclipse",
        "coverage", ".nyc_output",
        "vendor", "bower_components"
    );

    /** File extensions to skip. */
    private static final Set<String> IGNORED_EXTENSIONS = Set.of(
        "class", "jar", "war", "ear",
        "exe", "dll", "so", "dylib",
        "png", "jpg", "jpeg", "gif", "ico", "svg", "webp",
        "mp3", "mp4", "wav", "avi", "mov",
        "zip", "tar", "gz", "bz2", "7z",
        "pdf", "doc", "docx", "xls", "xlsx",
        "lock"
    );

    private static final long MAX_FILE_SIZE_BYTES = 1024 * 1024; // 1MB

    private final JdbcTemplate jdbcTemplate;
    private final LanguageDetector languageDetector;
    private final SessionRegistry sessionRegistry;

    public FileIndexer(
        JdbcTemplate jdbcTemplate,
        LanguageDetector languageDetector,
        SessionRegistry sessionRegistry
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.languageDetector = languageDetector;
        this.sessionRegistry = sessionRegistry;
    }

    /**
     * Index a project directory asynchronously.
     * Sends FILE_INDEX_STATUS updates to the requesting session.
     *
     * @param projectPath Absolute path to the project root
     * @param session     WebSocket session to send progress updates to
     */
    public CompletableFuture<Void> indexProject(String projectPath, WebSocketSession session) {
        return CompletableFuture.runAsync(() -> {
            log.info("Starting file indexing for project: {}", projectPath);
            Path root = Path.of(projectPath);

            if (!Files.exists(root) || !Files.isDirectory(root)) {
                log.warn("Project path does not exist or is not a directory: {}", projectPath);
                sendIndexStatus(session, 0, 0, null, "error");
                return;
            }

            try {
                // First pass: count files
                List<Path> filesToIndex = collectFiles(root);
                int totalFiles = filesToIndex.size();
                log.info("Found {} files to index in {}", totalFiles, projectPath);

                AtomicInteger processed = new AtomicInteger(0);

                // Second pass: index files
                for (Path file : filesToIndex) {
                    try {
                        indexFile(projectPath, file);
                        int count = processed.incrementAndGet();

                        // Send progress every 10 files or on last file
                        if (count % 10 == 0 || count == totalFiles) {
                            sendIndexStatus(session, totalFiles, count, file.toString(), "indexing");
                        }
                    } catch (Exception e) {
                        log.debug("Failed to index file {}: {}", file, e.getMessage());
                    }
                }

                // Send completion
                sendIndexStatus(session, totalFiles, totalFiles, null, "complete");
                log.info("Indexing complete: {} files indexed in {}", totalFiles, projectPath);

            } catch (Exception e) {
                log.error("Indexing failed for {}: {}", projectPath, e.getMessage(), e);
                sendIndexStatus(session, 0, 0, null, "error");
            }
        });
    }

    /**
     * Get all indexed files for a project.
     */
    public List<FileInfo> getIndexedFiles(String projectPath) {
        return jdbcTemplate.query(
            "SELECT file_path, file_name, language, size, last_modified FROM file_index WHERE project_path = ? ORDER BY file_path",
            (rs, rowNum) -> new FileInfo(
                rs.getString("file_path"),
                rs.getString("file_name"),
                rs.getString("language"),
                rs.getLong("size"),
                rs.getTimestamp("last_modified") != null
                    ? rs.getTimestamp("last_modified").toLocalDateTime()
                    : null
            ),
            projectPath
        );
    }

    /**
     * Clear the index for a project.
     */
    public void clearIndex(String projectPath) {
        int deleted = jdbcTemplate.update("DELETE FROM file_index WHERE project_path = ?", projectPath);
        log.info("Cleared {} indexed files for project: {}", deleted, projectPath);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private List<Path> collectFiles(Path root) throws IOException {
        List<Path> files = new ArrayList<>();
        Files.walkFileTree(root, new SimpleFileVisitor<>() {
            @Override
            public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) {
                String dirName = dir.getFileName() != null ? dir.getFileName().toString() : "";
                if (IGNORED_DIRS.contains(dirName)) {
                    return FileVisitResult.SKIP_SUBTREE;
                }
                return FileVisitResult.CONTINUE;
            }

            @Override
            public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) {
                if (shouldIndex(file, attrs)) {
                    files.add(file);
                }
                return FileVisitResult.CONTINUE;
            }

            @Override
            public FileVisitResult visitFileFailed(Path file, IOException exc) {
                log.debug("Cannot access file {}: {}", file, exc.getMessage());
                return FileVisitResult.CONTINUE;
            }
        });
        return files;
    }

    private boolean shouldIndex(Path file, BasicFileAttributes attrs) {
        if (attrs.size() > MAX_FILE_SIZE_BYTES) return false;
        if (attrs.isSymbolicLink()) return false;

        String fileName = file.getFileName().toString();
        if (fileName.startsWith(".") && !isKnownDotFile(fileName)) return false;

        int dotIndex = fileName.lastIndexOf('.');
        if (dotIndex > 0) {
            String ext = fileName.substring(dotIndex + 1).toLowerCase();
            if (IGNORED_EXTENSIONS.contains(ext)) return false;
        }

        return true;
    }

    private boolean isKnownDotFile(String fileName) {
        return fileName.equals(".gitignore") || fileName.equals(".editorconfig")
            || fileName.equals(".env") || fileName.startsWith(".env.")
            || fileName.equals(".eslintrc") || fileName.equals(".prettierrc")
            || fileName.equals(".babelrc");
    }

    private void indexFile(String projectPath, Path file) throws IOException {
        BasicFileAttributes attrs = Files.readAttributes(file, BasicFileAttributes.class);
        String fileName = file.getFileName().toString();
        String language = languageDetector.detect(fileName);
        LocalDateTime lastModified = LocalDateTime.ofInstant(
            attrs.lastModifiedTime().toInstant(), ZoneId.systemDefault()
        );

        jdbcTemplate.update("""
            INSERT INTO file_index (project_path, file_path, file_name, language, size, last_modified, indexed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(project_path, file_path) DO UPDATE SET
                file_name = excluded.file_name,
                language = excluded.language,
                size = excluded.size,
                last_modified = excluded.last_modified,
                indexed_at = excluded.indexed_at
            """,
            projectPath,
            file.toString(),
            fileName,
            language,
            attrs.size(),
            lastModified,
            LocalDateTime.now()
        );
    }

    private void sendIndexStatus(
        WebSocketSession session,
        int totalFiles,
        int processedFiles,
        String currentFile,
        String status
    ) {
        if (session == null || !session.isOpen()) return;

        Map<String, Object> payload = currentFile != null
            ? Map.of("totalFiles", totalFiles, "processedFiles", processedFiles,
                "currentFile", currentFile, "status", status)
            : Map.of("totalFiles", totalFiles, "processedFiles", processedFiles, "status", status);

        String type = "complete".equals(status)
            ? WsMessageTypes.FILE_INDEX_COMPLETE
            : WsMessageTypes.FILE_INDEX_STATUS;

        sessionRegistry.sendTo(session, WsMessage.create(type, payload));
    }
}

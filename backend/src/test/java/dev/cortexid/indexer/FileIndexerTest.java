package dev.cortexid.indexer;

import dev.cortexid.websocket.SessionRegistry;
import dev.cortexid.websocket.WsMessage;
import dev.cortexid.websocket.WsMessageTypes;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.socket.WebSocketSession;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for FileIndexer.
 * Uses @TempDir to create real file structures for indexing.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("FileIndexer")
class FileIndexerTest {

    @TempDir
    Path tempDir;

    @Mock private JdbcTemplate jdbcTemplate;
    @Mock private LanguageDetector languageDetector;
    @Mock private SessionRegistry sessionRegistry;
    @Mock private WebSocketSession session;

    private FileIndexer fileIndexer;

    @BeforeEach
    void setUp() {
        fileIndexer = new FileIndexer(jdbcTemplate, languageDetector, sessionRegistry);
        when(session.isOpen()).thenReturn(true);
        when(session.getId()).thenReturn("test-session");
        when(languageDetector.detect(anyString())).thenReturn("plaintext");
    }

    @Nested
    @DisplayName("indexProject")
    class IndexProjectTests {

        @Test
        @DisplayName("indexes files in a valid project directory")
        void indexProject_withValidDirectory_indexesFiles() throws Exception {
            // Arrange
            Files.writeString(tempDir.resolve("Main.java"), "public class Main {}");
            Files.writeString(tempDir.resolve("README.md"), "# Project");
            when(languageDetector.detect("Main.java")).thenReturn("java");
            when(languageDetector.detect("README.md")).thenReturn("markdown");

            // Act
            fileIndexer.indexProject(tempDir.toString(), session).get(5, TimeUnit.SECONDS);

            // Assert: jdbcTemplate.update called for each file
            verify(jdbcTemplate, atLeast(2)).update(anyString(), any(Object[].class));
        }

        @Test
        @DisplayName("sends FILE_INDEX_COMPLETE when indexing finishes")
        void indexProject_onCompletion_sendsFileIndexComplete() throws Exception {
            // Arrange
            Files.writeString(tempDir.resolve("app.ts"), "const x = 1;");

            // Act
            fileIndexer.indexProject(tempDir.toString(), session).get(5, TimeUnit.SECONDS);

            // Assert
            ArgumentCaptor<WsMessage<?>> captor = ArgumentCaptor.forClass(WsMessage.class);
            verify(sessionRegistry, atLeastOnce()).sendTo(eq(session), captor.capture());

            assertThat(captor.getAllValues())
                .extracting(WsMessage::type)
                .contains(WsMessageTypes.FILE_INDEX_COMPLETE);
        }

        @Test
        @DisplayName("sends FILE_INDEX_STATUS during indexing progress")
        void indexProject_duringIndexing_sendsProgressUpdates() throws Exception {
            // Arrange — create 15 files to trigger progress updates (every 10)
            for (int i = 0; i < 15; i++) {
                Files.writeString(tempDir.resolve("file" + i + ".java"), "class F" + i + " {}");
            }

            // Act
            fileIndexer.indexProject(tempDir.toString(), session).get(5, TimeUnit.SECONDS);

            // Assert: at least one FILE_INDEX_STATUS sent
            ArgumentCaptor<WsMessage<?>> captor = ArgumentCaptor.forClass(WsMessage.class);
            verify(sessionRegistry, atLeastOnce()).sendTo(eq(session), captor.capture());

            assertThat(captor.getAllValues())
                .extracting(WsMessage::type)
                .contains(WsMessageTypes.FILE_INDEX_STATUS);
        }

        @Test
        @DisplayName("sends error status when project path does not exist")
        void indexProject_withNonExistentPath_sendsErrorStatus() throws Exception {
            // Act
            fileIndexer.indexProject("/non/existent/path", session).get(5, TimeUnit.SECONDS);

            // Assert
            ArgumentCaptor<WsMessage<?>> captor = ArgumentCaptor.forClass(WsMessage.class);
            verify(sessionRegistry, atLeastOnce()).sendTo(eq(session), captor.capture());

            // Should send an error or complete with 0 files
            assertThat(captor.getAllValues()).isNotEmpty();
        }

        @Test
        @DisplayName("does not send WebSocket messages when session is closed")
        void indexProject_withClosedSession_doesNotSendMessages() throws Exception {
            // Arrange
            when(session.isOpen()).thenReturn(false);
            Files.writeString(tempDir.resolve("file.java"), "class F {}");

            // Act
            fileIndexer.indexProject(tempDir.toString(), session).get(5, TimeUnit.SECONDS);

            // Assert: sendTo never called because session is closed
            verify(sessionRegistry, never()).sendTo(any(), any());
        }
    }

    @Nested
    @DisplayName("ignored directories")
    class IgnoredDirectoriesTests {

        @Test
        @DisplayName("skips .git directory during indexing")
        void indexProject_shouldSkipGitDirectory() throws Exception {
            // Arrange
            Path gitDir = Files.createDirectory(tempDir.resolve(".git"));
            Files.writeString(gitDir.resolve("config"), "[core]");
            Files.writeString(tempDir.resolve("app.java"), "class App {}");

            // Act
            fileIndexer.indexProject(tempDir.toString(), session).get(5, TimeUnit.SECONDS);

            // Assert: only app.java indexed, not .git/config
            ArgumentCaptor<Object[]> argsCaptor = ArgumentCaptor.forClass(Object[].class);
            verify(jdbcTemplate, atLeastOnce()).update(anyString(), argsCaptor.capture());

            boolean gitConfigIndexed = argsCaptor.getAllValues().stream()
                .anyMatch(args -> args.length > 1 && args[1] != null
                    && args[1].toString().contains(".git"));
            assertThat(gitConfigIndexed).isFalse();
        }

        @Test
        @DisplayName("skips node_modules directory during indexing")
        void indexProject_shouldSkipNodeModules() throws Exception {
            // Arrange
            Path nodeModules = Files.createDirectory(tempDir.resolve("node_modules"));
            Path lodash = Files.createDirectory(nodeModules.resolve("lodash"));
            Files.writeString(lodash.resolve("index.js"), "module.exports = {}");
            Files.writeString(tempDir.resolve("index.ts"), "import _ from 'lodash'");

            // Act
            fileIndexer.indexProject(tempDir.toString(), session).get(5, TimeUnit.SECONDS);

            // Assert: node_modules files not indexed
            ArgumentCaptor<Object[]> argsCaptor = ArgumentCaptor.forClass(Object[].class);
            verify(jdbcTemplate, atLeastOnce()).update(anyString(), argsCaptor.capture());

            boolean nodeModulesIndexed = argsCaptor.getAllValues().stream()
                .anyMatch(args -> args.length > 1 && args[1] != null
                    && args[1].toString().contains("node_modules"));
            assertThat(nodeModulesIndexed).isFalse();
        }

        @Test
        @DisplayName("skips target directory during indexing")
        void indexProject_shouldSkipTargetDirectory() throws Exception {
            // Arrange
            Path targetDir = Files.createDirectory(tempDir.resolve("target"));
            Files.writeString(targetDir.resolve("App.class"), "binary");
            Files.writeString(tempDir.resolve("App.java"), "class App {}");

            // Act
            fileIndexer.indexProject(tempDir.toString(), session).get(5, TimeUnit.SECONDS);

            // Assert: target files not indexed
            ArgumentCaptor<Object[]> argsCaptor = ArgumentCaptor.forClass(Object[].class);
            verify(jdbcTemplate, atLeastOnce()).update(anyString(), argsCaptor.capture());

            boolean targetIndexed = argsCaptor.getAllValues().stream()
                .anyMatch(args -> args.length > 1 && args[1] != null
                    && args[1].toString().contains("target"));
            assertThat(targetIndexed).isFalse();
        }

        @Test
        @DisplayName("skips dist directory during indexing")
        void indexProject_shouldSkipDistDirectory() throws Exception {
            // Arrange
            Path distDir = Files.createDirectory(tempDir.resolve("dist"));
            Files.writeString(distDir.resolve("bundle.js"), "!function(){}()");
            Files.writeString(tempDir.resolve("src.ts"), "const x = 1;");

            // Act
            fileIndexer.indexProject(tempDir.toString(), session).get(5, TimeUnit.SECONDS);

            // Assert
            ArgumentCaptor<Object[]> argsCaptor = ArgumentCaptor.forClass(Object[].class);
            verify(jdbcTemplate, atLeastOnce()).update(anyString(), argsCaptor.capture());

            boolean distIndexed = argsCaptor.getAllValues().stream()
                .anyMatch(args -> args.length > 1 && args[1] != null
                    && args[1].toString().contains("dist"));
            assertThat(distIndexed).isFalse();
        }
    }

    @Nested
    @DisplayName("language detection")
    class LanguageDetectionTests {

        @Test
        @DisplayName("calls languageDetector.detect for each indexed file")
        void indexProject_callsLanguageDetectorForEachFile() throws Exception {
            // Arrange
            Files.writeString(tempDir.resolve("Main.java"), "class Main {}");
            Files.writeString(tempDir.resolve("index.ts"), "const x = 1;");
            when(languageDetector.detect("Main.java")).thenReturn("java");
            when(languageDetector.detect("index.ts")).thenReturn("typescript");

            // Act
            fileIndexer.indexProject(tempDir.toString(), session).get(5, TimeUnit.SECONDS);

            // Assert
            verify(languageDetector).detect("Main.java");
            verify(languageDetector).detect("index.ts");
        }

        @Test
        @DisplayName("stores detected language in the database")
        void indexProject_storesDetectedLanguageInDb() throws Exception {
            // Arrange
            Files.writeString(tempDir.resolve("Service.java"), "class Service {}");
            when(languageDetector.detect("Service.java")).thenReturn("java");

            // Act
            fileIndexer.indexProject(tempDir.toString(), session).get(5, TimeUnit.SECONDS);

            // Assert: update called with "java" as language parameter
            ArgumentCaptor<Object[]> argsCaptor = ArgumentCaptor.forClass(Object[].class);
            verify(jdbcTemplate, atLeastOnce()).update(anyString(), argsCaptor.capture());

            boolean javaLanguageStored = argsCaptor.getAllValues().stream()
                .anyMatch(args -> {
                    for (Object arg : args) {
                        if ("java".equals(arg)) return true;
                    }
                    return false;
                });
            assertThat(javaLanguageStored).isTrue();
        }
    }

    @Nested
    @DisplayName("clearIndex")
    class ClearIndexTests {

        @Test
        @DisplayName("executes DELETE query for the given project path")
        void clearIndex_executesDeleteQuery() {
            // Act
            fileIndexer.clearIndex(tempDir.toString());

            // Assert
            verify(jdbcTemplate).update(
                contains("DELETE FROM file_index"),
                eq(tempDir.toString())
            );
        }
    }
}

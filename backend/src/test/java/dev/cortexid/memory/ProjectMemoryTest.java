package dev.cortexid.memory;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for ProjectMemory service.
 * Verifies remember/recall semantics, context building, and delegation to MemoryRepository.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("ProjectMemory")
class ProjectMemoryTest {

    @Mock private MemoryRepository memoryRepository;

    @InjectMocks
    private ProjectMemory projectMemory;

    private static final String PROJECT_PATH = "/home/user/my-project";

    @Nested
    @DisplayName("remember")
    class RememberTests {

        @Test
        @DisplayName("saves new entity when key does not exist")
        void remember_withNewKey_savesNewEntity() {
            // Arrange
            when(memoryRepository.findByProjectPathAndKey(PROJECT_PATH, "framework"))
                .thenReturn(Optional.empty());

            // Act
            projectMemory.remember(PROJECT_PATH, "framework", "Spring Boot", "conventions");

            // Assert
            ArgumentCaptor<ProjectMemoryEntity> captor = ArgumentCaptor.forClass(ProjectMemoryEntity.class);
            verify(memoryRepository).save(captor.capture());

            ProjectMemoryEntity saved = captor.getValue();
            assertThat(saved.getProjectPath()).isEqualTo(PROJECT_PATH);
            assertThat(saved.getKey()).isEqualTo("framework");
            assertThat(saved.getValue()).isEqualTo("Spring Boot");
            assertThat(saved.getCategory()).isEqualTo("conventions");
        }

        @Test
        @DisplayName("updates existing entity when key already exists")
        void remember_withExistingKey_updatesValue() {
            // Arrange
            ProjectMemoryEntity existing = new ProjectMemoryEntity(PROJECT_PATH, "framework", "old-value", "conventions");
            when(memoryRepository.findByProjectPathAndKey(PROJECT_PATH, "framework"))
                .thenReturn(Optional.of(existing));

            // Act
            projectMemory.remember(PROJECT_PATH, "framework", "Spring Boot 3", "conventions");

            // Assert
            verify(memoryRepository).save(existing);
            assertThat(existing.getValue()).isEqualTo("Spring Boot 3");
            assertThat(existing.getUpdatedAt()).isNotNull();
        }

        @Test
        @DisplayName("uses 'general' category when none specified")
        void remember_withoutCategory_usesGeneralCategory() {
            // Arrange
            when(memoryRepository.findByProjectPathAndKey(PROJECT_PATH, "key"))
                .thenReturn(Optional.empty());

            // Act
            projectMemory.remember(PROJECT_PATH, "key", "value");

            // Assert
            ArgumentCaptor<ProjectMemoryEntity> captor = ArgumentCaptor.forClass(ProjectMemoryEntity.class);
            verify(memoryRepository).save(captor.capture());
            assertThat(captor.getValue().getCategory()).isEqualTo("general");
        }
    }

    @Nested
    @DisplayName("recall")
    class RecallTests {

        @Test
        @DisplayName("returns value when key exists")
        void recall_withExistingKey_returnsValue() {
            // Arrange
            ProjectMemoryEntity entity = new ProjectMemoryEntity(PROJECT_PATH, "language", "Java 21", "conventions");
            when(memoryRepository.findByProjectPathAndKey(PROJECT_PATH, "language"))
                .thenReturn(Optional.of(entity));

            // Act
            Optional<String> result = projectMemory.recall(PROJECT_PATH, "language");

            // Assert
            assertThat(result).hasValue("Java 21");
        }

        @Test
        @DisplayName("returns empty Optional when key does not exist")
        void recall_withMissingKey_returnsEmpty() {
            // Arrange
            when(memoryRepository.findByProjectPathAndKey(PROJECT_PATH, "missing"))
                .thenReturn(Optional.empty());

            // Act
            Optional<String> result = projectMemory.recall(PROJECT_PATH, "missing");

            // Assert
            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("recallAll returns all entries as a map")
        void recallAll_returnsAllEntriesAsMap() {
            // Arrange
            List<ProjectMemoryEntity> entities = List.of(
                new ProjectMemoryEntity(PROJECT_PATH, "key1", "value1", "general"),
                new ProjectMemoryEntity(PROJECT_PATH, "key2", "value2", "general")
            );
            when(memoryRepository.findByProjectPath(PROJECT_PATH)).thenReturn(entities);

            // Act
            Map<String, String> result = projectMemory.recallAll(PROJECT_PATH);

            // Assert
            assertThat(result).hasSize(2)
                .containsEntry("key1", "value1")
                .containsEntry("key2", "value2");
        }

        @Test
        @DisplayName("recallByCategory returns only entries in that category")
        void recallByCategory_returnsFilteredEntries() {
            // Arrange
            List<ProjectMemoryEntity> entities = List.of(
                new ProjectMemoryEntity(PROJECT_PATH, "indent", "4 spaces", "preferences"),
                new ProjectMemoryEntity(PROJECT_PATH, "quotes", "double", "preferences")
            );
            when(memoryRepository.findByProjectPathAndCategory(PROJECT_PATH, "preferences"))
                .thenReturn(entities);

            // Act
            Map<String, String> result = projectMemory.recallByCategory(PROJECT_PATH, "preferences");

            // Assert
            assertThat(result).hasSize(2)
                .containsEntry("indent", "4 spaces")
                .containsEntry("quotes", "double");
        }
    }

    @Nested
    @DisplayName("forget")
    class ForgetTests {

        @Test
        @DisplayName("delegates to repository deleteByProjectPathAndKey")
        void forget_delegatesToRepository() {
            // Act
            projectMemory.forget(PROJECT_PATH, "old-key");

            // Assert
            verify(memoryRepository).deleteByProjectPathAndKey(PROJECT_PATH, "old-key");
        }

        @Test
        @DisplayName("forgetAll delegates to repository deleteByProjectPath")
        void forgetAll_delegatesToRepository() {
            // Act
            projectMemory.forgetAll(PROJECT_PATH);

            // Assert
            verify(memoryRepository).deleteByProjectPath(PROJECT_PATH);
        }
    }

    @Nested
    @DisplayName("buildContextString")
    class BuildContextStringTests {

        @Test
        @DisplayName("returns empty string when no conventions or preferences exist")
        void buildContextString_withNoMemory_returnsEmptyString() {
            // Arrange
            when(memoryRepository.findByProjectPathAndCategory(PROJECT_PATH, "conventions"))
                .thenReturn(List.of());
            when(memoryRepository.findByProjectPathAndCategory(PROJECT_PATH, "preferences"))
                .thenReturn(List.of());

            // Act
            String result = projectMemory.buildContextString(PROJECT_PATH);

            // Assert
            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("includes conventions section when conventions exist")
        void buildContextString_withConventions_includesConventionsSection() {
            // Arrange
            when(memoryRepository.findByProjectPathAndCategory(PROJECT_PATH, "conventions"))
                .thenReturn(List.of(
                    new ProjectMemoryEntity(PROJECT_PATH, "framework", "Spring Boot", "conventions")
                ));
            when(memoryRepository.findByProjectPathAndCategory(PROJECT_PATH, "preferences"))
                .thenReturn(List.of());

            // Act
            String result = projectMemory.buildContextString(PROJECT_PATH);

            // Assert
            assertThat(result).contains("## Project Context");
            assertThat(result).contains("### Conventions");
            assertThat(result).contains("framework: Spring Boot");
            assertThat(result).doesNotContain("### Preferences");
        }

        @Test
        @DisplayName("includes preferences section when preferences exist")
        void buildContextString_withPreferences_includesPreferencesSection() {
            // Arrange
            when(memoryRepository.findByProjectPathAndCategory(PROJECT_PATH, "conventions"))
                .thenReturn(List.of());
            when(memoryRepository.findByProjectPathAndCategory(PROJECT_PATH, "preferences"))
                .thenReturn(List.of(
                    new ProjectMemoryEntity(PROJECT_PATH, "indent", "2 spaces", "preferences")
                ));

            // Act
            String result = projectMemory.buildContextString(PROJECT_PATH);

            // Assert
            assertThat(result).contains("## Project Context");
            assertThat(result).contains("### Preferences");
            assertThat(result).contains("indent: 2 spaces");
            assertThat(result).doesNotContain("### Conventions");
        }

        @Test
        @DisplayName("includes both sections when both conventions and preferences exist")
        void buildContextString_withBothCategories_includesBothSections() {
            // Arrange
            when(memoryRepository.findByProjectPathAndCategory(PROJECT_PATH, "conventions"))
                .thenReturn(List.of(
                    new ProjectMemoryEntity(PROJECT_PATH, "language", "Java 21", "conventions")
                ));
            when(memoryRepository.findByProjectPathAndCategory(PROJECT_PATH, "preferences"))
                .thenReturn(List.of(
                    new ProjectMemoryEntity(PROJECT_PATH, "theme", "dark", "preferences")
                ));

            // Act
            String result = projectMemory.buildContextString(PROJECT_PATH);

            // Assert
            assertThat(result).contains("### Conventions");
            assertThat(result).contains("language: Java 21");
            assertThat(result).contains("### Preferences");
            assertThat(result).contains("theme: dark");
        }

        @Test
        @DisplayName("context string starts with newlines for proper prompt formatting")
        void buildContextString_withMemory_startsWithNewlines() {
            // Arrange
            when(memoryRepository.findByProjectPathAndCategory(PROJECT_PATH, "conventions"))
                .thenReturn(List.of(
                    new ProjectMemoryEntity(PROJECT_PATH, "key", "value", "conventions")
                ));
            when(memoryRepository.findByProjectPathAndCategory(PROJECT_PATH, "preferences"))
                .thenReturn(List.of());

            // Act
            String result = projectMemory.buildContextString(PROJECT_PATH);

            // Assert
            assertThat(result).startsWith("\n\n");
        }
    }

    @Nested
    @DisplayName("listAll")
    class ListAllTests {

        @Test
        @DisplayName("returns all entities for a project")
        void listAll_returnsAllEntities() {
            // Arrange
            List<ProjectMemoryEntity> entities = List.of(
                new ProjectMemoryEntity(PROJECT_PATH, "k1", "v1", "general"),
                new ProjectMemoryEntity(PROJECT_PATH, "k2", "v2", "conventions")
            );
            when(memoryRepository.findByProjectPath(PROJECT_PATH)).thenReturn(entities);

            // Act
            List<ProjectMemoryEntity> result = projectMemory.listAll(PROJECT_PATH);

            // Assert
            assertThat(result).hasSize(2);
            assertThat(result).isSameAs(entities);
        }

        @Test
        @DisplayName("returns empty list when no memory exists")
        void listAll_withNoMemory_returnsEmptyList() {
            // Arrange
            when(memoryRepository.findByProjectPath(PROJECT_PATH)).thenReturn(List.of());

            // Act
            List<ProjectMemoryEntity> result = projectMemory.listAll(PROJECT_PATH);

            // Assert
            assertThat(result).isEmpty();
        }
    }
}

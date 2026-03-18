package dev.cortexid.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.file.*;
import java.util.Set;
import java.util.concurrent.TimeUnit;

/**
 * Executes autonomous agent actions on the user's machine.
 *
 * <p>Supported action types:
 * <ul>
 *   <li>{@code create_directory} — creates a directory tree</li>
 *   <li>{@code write_file}       — writes (or overwrites) a file</li>
 *   <li>{@code run_command}      — runs a shell command via bash</li>
 *   <li>{@code create_project}   — scaffolds a full project (MERN, Spring Boot, FastAPI)</li>
 * </ul>
 *
 * <p>A safety filter blocks a set of known destructive commands before execution.
 */
@Service
public class AgentActionService {

    private static final Logger log = LoggerFactory.getLogger(AgentActionService.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    /** Substrings that are never allowed in a run_command action. */
    private static final Set<String> FORBIDDEN_COMMANDS = Set.of(
        "rm -rf /",
        "dd if=",
        "mkfs",
        "format c:",
        "> /dev/sda",
        "chmod 777 /",
        "sudo rm -rf"
    );

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Execute a single agent action.
     *
     * @param type   action type string (e.g. {@code "write_file"})
     * @param params JSON node containing action-specific parameters
     * @return result node with at least {@code success} and {@code message} fields
     */
    public ObjectNode executeAction(String type, JsonNode params) {
        ObjectNode result = MAPPER.createObjectNode();
        try {
            switch (type) {
                case "create_directory" -> executeCreateDirectory(params, result);
                case "write_file"       -> executeWriteFile(params, result);
                case "run_command"      -> executeRunCommand(params, result);
                case "create_project"   -> {
                    ObjectNode projectResult = executeCreateProject(params);
                    return projectResult;
                }
                default -> {
                    result.put("success", false);
                    result.put("message", "Unknown action type: " + type);
                }
            }
        } catch (Exception e) {
            result.put("success", false);
            result.put("message", "Error executing action '" + type + "': " + e.getMessage());
            log.error("[AgentAction] Error executing {}: {}", type, e.getMessage(), e);
        }
        return result;
    }

    // ── Action implementations ────────────────────────────────────────────────

    private void executeCreateDirectory(JsonNode params, ObjectNode result) throws IOException {
        String path = requireText(params, "path");
        Files.createDirectories(Path.of(path));
        result.put("success", true);
        result.put("message", "Directory created: " + path);
        log.info("[AgentAction] Created directory: {}", path);
    }

    private void executeWriteFile(JsonNode params, ObjectNode result) throws IOException {
        String path    = requireText(params, "path");
        String content = requireText(params, "content");
        Path filePath  = Path.of(path);
        Files.createDirectories(filePath.getParent());
        Files.writeString(filePath, content);
        result.put("success", true);
        result.put("message", "File written: " + path);
        log.info("[AgentAction] Wrote file: {}", path);
    }

    private void executeRunCommand(JsonNode params, ObjectNode result) throws IOException, InterruptedException {
        String command = requireText(params, "command");
        String cwd     = params.has("cwd") ? params.get("cwd").asText() : System.getProperty("user.home");

        // Safety check — block known destructive patterns
        String lowerCmd = command.toLowerCase();
        for (String forbidden : FORBIDDEN_COMMANDS) {
            if (lowerCmd.contains(forbidden)) {
                result.put("success", false);
                result.put("message", "Command blocked by safety filter: contains forbidden pattern '" + forbidden + "'");
                log.warn("[AgentAction] Blocked dangerous command: {}", command);
                return;
            }
        }

        ProcessBuilder pb = new ProcessBuilder("bash", "-c", command);
        pb.directory(new File(cwd));
        pb.redirectErrorStream(true);
        Process process = pb.start();

        StringBuilder output = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line).append("\n");
            }
        }

        boolean finished = process.waitFor(120, TimeUnit.SECONDS);
        if (!finished) {
            process.destroyForcibly();
            output.append("\n[TIMEOUT after 120s]");
        }

        int exitCode = finished ? process.exitValue() : -1;
        result.put("success", exitCode == 0);
        result.put("output", output.toString());
        result.put("exitCode", exitCode);
        result.put("message", exitCode == 0
            ? "Command completed successfully"
            : "Command exited with code " + exitCode);
        log.info("[AgentAction] Ran command: {} (exit: {})", command, exitCode);
    }

    private ObjectNode executeCreateProject(JsonNode params) throws IOException, InterruptedException {
        String path        = requireText(params, "path");
        String projectType = requireText(params, "projectType");

        ObjectNode result      = MAPPER.createObjectNode();
        ArrayNode  filesCreated = MAPPER.createArrayNode();

        Files.createDirectories(Path.of(path));
        String projectName = Path.of(path).getFileName().toString();

        switch (projectType.toLowerCase()) {
            case "mern" -> scaffoldMern(path, projectName, filesCreated);
            case "spring", "spring-boot", "java" -> scaffoldSpringBoot(path, projectName, filesCreated);
            case "fastapi", "python" -> scaffoldFastApi(path, projectName, filesCreated);
            default -> writeProjectFile(path, "README.md", "# " + projectName + "\n", filesCreated);
        }

        result.put("success", true);
        result.put("message", "Project created: " + path + " (type: " + projectType + ")");
        result.set("files", filesCreated);
        log.info("[AgentAction] Created {} project at {}", projectType, path);
        return result;
    }

    // ── Project scaffolders ───────────────────────────────────────────────────

    private void scaffoldMern(String path, String name, ArrayNode files) throws IOException, InterruptedException {
        writeProjectFile(path, "package.json", """
            {
              "name": "%s",
              "version": "1.0.0",
              "scripts": { "dev": "node server.js" },
              "dependencies": {
                "express": "^4.18.0",
                "mongoose": "^8.0.0",
                "cors": "^2.8.5",
                "dotenv": "^16.0.0",
                "bcryptjs": "^2.4.3",
                "jsonwebtoken": "^9.0.0"
              }
            }
            """.formatted(name), files);

        writeProjectFile(path, "server.js", """
            const express = require('express');
            const cors = require('cors');
            const mongoose = require('mongoose');
            require('dotenv').config();

            const app = express();
            app.use(cors());
            app.use(express.json());

            app.get('/', (req, res) => res.json({ message: 'API running' }));

            const PORT = process.env.PORT || 5000;
            mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/%s')
              .then(() => app.listen(PORT, () => console.log('Server on ' + PORT)))
              .catch(err => console.error(err));
            """.formatted(name), files);

        writeProjectFile(path, ".env",
            "PORT=5000\nMONGODB_URI=mongodb://localhost:27017/" + name + "\n", files);

        writeProjectFile(path, ".gitignore", "node_modules/\n.env\nclient/build/\n", files);

        writeProjectFile(path, "models/Item.js", """
            const mongoose = require('mongoose');
            const ItemSchema = new mongoose.Schema({
              title:     { type: String,  required: true },
              completed: { type: Boolean, default: false },
            }, { timestamps: true });
            module.exports = mongoose.model('Item', ItemSchema);
            """, files);

        writeProjectFile(path, "routes/items.js", """
            const router = require('express').Router();
            const Item   = require('../models/Item');

            router.get('/',    async (req, res) => res.json(await Item.find()));
            router.post('/',   async (req, res) => res.status(201).json(await Item.create(req.body)));
            router.delete('/:id', async (req, res) => {
              await Item.findByIdAndDelete(req.params.id);
              res.json({ ok: true });
            });
            module.exports = router;
            """, files);

        writeProjectFile(path, "README.md",
            "# " + name + "\n\nMERN Stack\n\n```bash\nnpm install && npm run dev\n```\n", files);

        // Run npm install in the background — non-blocking for the response
        runInDir(path, "npm install");
    }

    private void scaffoldSpringBoot(String path, String name, ArrayNode files) throws IOException {
        String artifactId = name.replaceAll("[^a-zA-Z0-9]", "").toLowerCase();

        writeProjectFile(path, "pom.xml", """
            <?xml version="1.0" encoding="UTF-8"?>
            <project xmlns="http://maven.apache.org/POM/4.0.0"
                     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                     xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
              <modelVersion>4.0.0</modelVersion>
              <parent>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-starter-parent</artifactId>
                <version>3.4.0</version>
              </parent>
              <groupId>com.%s</groupId>
              <artifactId>%s</artifactId>
              <version>0.1.0</version>
              <properties>
                <java.version>21</java.version>
              </properties>
              <dependencies>
                <dependency>
                  <groupId>org.springframework.boot</groupId>
                  <artifactId>spring-boot-starter-web</artifactId>
                </dependency>
              </dependencies>
              <build>
                <plugins>
                  <plugin>
                    <groupId>org.springframework.boot</groupId>
                    <artifactId>spring-boot-maven-plugin</artifactId>
                  </plugin>
                </plugins>
              </build>
            </project>
            """.formatted(artifactId, artifactId), files);

        writeProjectFile(path, "src/main/java/com/app/Application.java", """
            package com.app;

            import org.springframework.boot.SpringApplication;
            import org.springframework.boot.autoconfigure.SpringBootApplication;

            @SpringBootApplication
            public class Application {
                public static void main(String[] args) {
                    SpringApplication.run(Application.class, args);
                }
            }
            """, files);

        writeProjectFile(path, "src/main/java/com/app/HelloController.java", """
            package com.app;

            import org.springframework.web.bind.annotation.GetMapping;
            import org.springframework.web.bind.annotation.RestController;

            @RestController
            public class HelloController {

                @GetMapping("/")
                public String hello() {
                    return "Hello from %s!";
                }
            }
            """.formatted(name), files);

        writeProjectFile(path, "src/main/resources/application.properties",
            "server.port=8080\nspring.application.name=" + artifactId + "\n", files);

        writeProjectFile(path, "README.md",
            "# " + name + "\n\nSpring Boot 3.4 / Java 21\n\n```bash\nmvn spring-boot:run\n```\n", files);
    }

    private void scaffoldFastApi(String path, String name, ArrayNode files) throws IOException {
        writeProjectFile(path, "main.py", """
            from fastapi import FastAPI

            app = FastAPI(title="%s")

            @app.get("/")
            def root():
                return {"message": "Hello from %s"}
            """.formatted(name, name), files);

        writeProjectFile(path, "requirements.txt",
            "fastapi==0.115.0\nuvicorn[standard]==0.30.0\n", files);

        writeProjectFile(path, ".gitignore", "__pycache__/\n*.pyc\n.venv/\n.env\n", files);

        writeProjectFile(path, "README.md",
            "# " + name + "\n\nFastAPI\n\n```bash\npip install -r requirements.txt\nuvicorn main:app --reload\n```\n",
            files);
    }

    // ── Utilities ─────────────────────────────────────────────────────────────

    /**
     * Write a file relative to {@code basePath}, creating parent directories as needed.
     * Strips leading whitespace from content (text blocks add indentation).
     */
    private void writeProjectFile(String basePath, String relativePath, String content, ArrayNode files)
        throws IOException {
        Path fullPath = Path.of(basePath, relativePath);
        Files.createDirectories(fullPath.getParent());
        Files.writeString(fullPath, content.stripLeading());
        files.add(relativePath);
    }

    /**
     * Run a shell command in the given directory, waiting up to 120 seconds.
     * Errors are logged but not propagated — project creation still succeeds.
     */
    private void runInDir(String dir, String command) {
        try {
            ProcessBuilder pb = new ProcessBuilder("bash", "-c", command);
            pb.directory(new File(dir));
            pb.redirectErrorStream(true);
            Process p = pb.start();
            // Drain stdout to prevent blocking
            p.getInputStream().transferTo(OutputStream.nullOutputStream());
            p.waitFor(120, TimeUnit.SECONDS);
        } catch (Exception e) {
            log.warn("[AgentAction] Background command '{}' in '{}' failed: {}", command, dir, e.getMessage());
        }
    }

    /**
     * Extract a required text field from a JSON params node.
     *
     * @throws IllegalArgumentException if the field is missing or blank
     */
    private String requireText(JsonNode params, String field) {
        JsonNode node = params.get(field);
        if (node == null || node.isNull() || node.asText().isBlank()) {
            throw new IllegalArgumentException("Missing required parameter: '" + field + "'");
        }
        return node.asText();
    }
}

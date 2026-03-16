package dev.cortexid.git;

import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.Status;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.eclipse.jgit.diff.DiffEntry;
import org.eclipse.jgit.diff.DiffFormatter;
import org.eclipse.jgit.lib.ObjectId;
import org.eclipse.jgit.lib.PersonIdent;
import org.eclipse.jgit.lib.Ref;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.revwalk.RevCommit;
import org.eclipse.jgit.revwalk.RevWalk;
import org.eclipse.jgit.storage.file.FileRepositoryBuilder;
import org.eclipse.jgit.treewalk.AbstractTreeIterator;
import org.eclipse.jgit.treewalk.CanonicalTreeParser;
import org.eclipse.jgit.treewalk.FileTreeIterator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

/**
 * Git operations service using JGit.
 * Provides status, diff, log, stage, and commit operations.
 */
@Service
public class GitService {

    private static final Logger log = LoggerFactory.getLogger(GitService.class);

    /**
     * Get the working tree status of a repository.
     *
     * @param repoPath Path to the repository root
     * @return GitStatus with modified, added, deleted, untracked files and current branch
     */
    public GitStatus getStatus(String repoPath) {
        try (Repository repo = openRepo(repoPath);
             Git git = new Git(repo)) {

            Status status = git.status().call();
            String branch = repo.getBranch();

            return new GitStatus(
                new ArrayList<>(status.getModified()),
                new ArrayList<>(status.getAdded()),
                new ArrayList<>(status.getRemoved()),
                new ArrayList<>(status.getUntracked()),
                branch
            );
        } catch (Exception e) {
            log.error("Failed to get git status for {}: {}", repoPath, e.getMessage());
            throw new GitOperationException("Failed to get git status: " + e.getMessage(), e);
        }
    }

    /**
     * Get the diff of a specific file against HEAD.
     *
     * @param repoPath Path to the repository root
     * @param filePath Relative file path within the repository
     * @return Unified diff string
     */
    public String getDiff(String repoPath, String filePath) {
        try (Repository repo = openRepo(repoPath);
             Git git = new Git(repo);
             ByteArrayOutputStream out = new ByteArrayOutputStream();
             DiffFormatter formatter = new DiffFormatter(out)) {

            formatter.setRepository(repo);

            ObjectId headId = repo.resolve("HEAD^{tree}");
            if (headId == null) {
                return ""; // Empty repository
            }

            AbstractTreeIterator oldTree = prepareTreeParser(repo, headId);
            AbstractTreeIterator newTree = new FileTreeIterator(repo);

            List<DiffEntry> diffs = formatter.scan(oldTree, newTree);
            for (DiffEntry diff : diffs) {
                String path = diff.getNewPath().equals("/dev/null") ? diff.getOldPath() : diff.getNewPath();
                if (path.equals(filePath)) {
                    formatter.format(diff);
                    return out.toString();
                }
            }

            return "";
        } catch (Exception e) {
            log.error("Failed to get diff for {} in {}: {}", filePath, repoPath, e.getMessage());
            throw new GitOperationException("Failed to get diff: " + e.getMessage(), e);
        }
    }

    /**
     * Get the commit log for a repository.
     *
     * @param repoPath Path to the repository root
     * @param maxCount Maximum number of commits to return
     * @return List of CommitInfo records
     */
    public List<CommitInfo> getLog(String repoPath, int maxCount) {
        try (Repository repo = openRepo(repoPath);
             Git git = new Git(repo)) {

            List<CommitInfo> commits = new ArrayList<>();
            Iterable<RevCommit> log = git.log().setMaxCount(maxCount).call();

            for (RevCommit commit : log) {
                PersonIdent author = commit.getAuthorIdent();
                LocalDateTime date = LocalDateTime.ofInstant(
                    Instant.ofEpochSecond(commit.getCommitTime()),
                    ZoneId.systemDefault()
                );
                commits.add(new CommitInfo(
                    commit.getName(),
                    commit.getShortMessage(),
                    author.getName() + " <" + author.getEmailAddress() + ">",
                    date
                ));
            }

            return commits;
        } catch (Exception e) {
            log.error("Failed to get git log for {}: {}", repoPath, e.getMessage());
            throw new GitOperationException("Failed to get git log: " + e.getMessage(), e);
        }
    }

    /**
     * Stage files for commit (git add).
     *
     * @param repoPath  Path to the repository root
     * @param filePaths List of relative file paths to stage
     */
    public void stage(String repoPath, List<String> filePaths) {
        try (Repository repo = openRepo(repoPath);
             Git git = new Git(repo)) {

            var addCommand = git.add();
            for (String filePath : filePaths) {
                addCommand.addFilepattern(filePath);
            }
            addCommand.call();
            log.info("Staged {} files in {}", filePaths.size(), repoPath);

        } catch (Exception e) {
            log.error("Failed to stage files in {}: {}", repoPath, e.getMessage());
            throw new GitOperationException("Failed to stage files: " + e.getMessage(), e);
        }
    }

    /**
     * Create a commit with the staged changes.
     *
     * @param repoPath Path to the repository root
     * @param message  Commit message
     * @return The created CommitInfo
     */
    public CommitInfo commit(String repoPath, String message) {
        try (Repository repo = openRepo(repoPath);
             Git git = new Git(repo)) {

            RevCommit commit = git.commit().setMessage(message).call();
            PersonIdent author = commit.getAuthorIdent();
            LocalDateTime date = LocalDateTime.ofInstant(
                Instant.ofEpochSecond(commit.getCommitTime()),
                ZoneId.systemDefault()
            );

            log.info("Created commit {} in {}", commit.getName().substring(0, 7), repoPath);
            return new CommitInfo(
                commit.getName(),
                commit.getShortMessage(),
                author.getName() + " <" + author.getEmailAddress() + ">",
                date
            );

        } catch (Exception e) {
            log.error("Failed to commit in {}: {}", repoPath, e.getMessage());
            throw new GitOperationException("Failed to commit: " + e.getMessage(), e);
        }
    }

    /**
     * Get the current branch name.
     *
     * @param repoPath Path to the repository root
     * @return Branch name (e.g. "main", "feature/my-feature")
     */
    public String getCurrentBranch(String repoPath) {
        try (Repository repo = openRepo(repoPath)) {
            return repo.getBranch();
        } catch (Exception e) {
            log.error("Failed to get current branch for {}: {}", repoPath, e.getMessage());
            throw new GitOperationException("Failed to get current branch: " + e.getMessage(), e);
        }
    }

    /**
     * Get all branches in the repository.
     *
     * @param repoPath Path to the repository root
     * @return List of branch names
     */
    public List<String> getBranches(String repoPath) {
        try (Repository repo = openRepo(repoPath);
             Git git = new Git(repo)) {

            List<Ref> refs = git.branchList().call();
            return refs.stream()
                .map(ref -> ref.getName().replace("refs/heads/", ""))
                .toList();

        } catch (Exception e) {
            log.error("Failed to get branches for {}: {}", repoPath, e.getMessage());
            throw new GitOperationException("Failed to get branches: " + e.getMessage(), e);
        }
    }

    /**
     * Check if a directory is a Git repository.
     */
    public boolean isGitRepository(String path) {
        try (Repository repo = openRepo(path)) {
            return repo.getObjectDatabase().exists();
        } catch (Exception e) {
            return false;
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private Repository openRepo(String repoPath) throws IOException {
        return new FileRepositoryBuilder()
            .setGitDir(new File(repoPath, ".git"))
            .readEnvironment()
            .findGitDir()
            .build();
    }

    private AbstractTreeIterator prepareTreeParser(Repository repo, ObjectId objectId) throws IOException {
        try (RevWalk walk = new RevWalk(repo)) {
            RevCommit commit = walk.parseCommit(objectId);
            var treeId = commit.getTree().getId();
            try (var reader = repo.newObjectReader()) {
                CanonicalTreeParser treeParser = new CanonicalTreeParser();
                treeParser.reset(reader, treeId);
                return treeParser;
            }
        }
    }

    /**
     * Runtime exception for Git operation failures.
     */
    public static class GitOperationException extends RuntimeException {
        public GitOperationException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}

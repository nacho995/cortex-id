/**
 * @file file-system.types.ts
 * @description IPC contract types for all file system operations between
 *              Angular (renderer) and Electron (main process).
 *
 * IMPACT: Changes here affect:
 *   - electron/src/ipc/file-system.handler.ts  (must update handler signatures)
 *   - electron/preload/index.ts                 (must update contextBridge bindings)
 *   - frontend/src/app/core/ipc.service.ts      (must update service method signatures)
 */

// ---------------------------------------------------------------------------
// Primitive / shared structures
// ---------------------------------------------------------------------------

/**
 * Metadata for a single file or directory entry returned by the file system.
 */
export interface FileInfo {
  /** Absolute path on disk. */
  path: string;
  /** Base name (file or directory name without parent path). */
  name: string;
  /** True when the entry is a directory. */
  isDirectory: boolean;
  /** True when the entry is a regular file. */
  isFile: boolean;
  /** File size in bytes (0 for directories). */
  size: number;
  /** Last-modified timestamp in milliseconds since epoch. */
  modifiedAt: number;
  /** File extension including the leading dot (e.g. ".ts"). Absent for directories. */
  extension?: string;
}

/**
 * A directory entry that may recursively contain children when a recursive
 * listing is requested.
 */
export interface DirectoryEntry extends FileInfo {
  /** Child entries, populated only when a recursive listing is requested. */
  children?: DirectoryEntry[];
}

// ---------------------------------------------------------------------------
// Read file
// ---------------------------------------------------------------------------

/** Request payload to read a file from disk. */
export interface ReadFileRequest {
  /** Absolute path of the file to read. */
  path: string;
  /** Text encoding to use (default: 'utf-8'). */
  encoding?: string;
}

/** Response payload containing the file content. */
export interface ReadFileResponse {
  /** Absolute path of the file that was read. */
  path: string;
  /** Raw file content as a string. */
  content: string;
  /** Encoding that was used to decode the file. */
  encoding: string;
}

// ---------------------------------------------------------------------------
// Write file
// ---------------------------------------------------------------------------

/** Request payload to write content to a file on disk. */
export interface WriteFileRequest {
  /** Absolute path of the file to write. */
  path: string;
  /** Content to write. */
  content: string;
  /** Text encoding to use (default: 'utf-8'). */
  encoding?: string;
  /** When true, creates the file (and any missing parent directories) if it does not exist. */
  createIfNotExists?: boolean;
}

/** Response payload confirming a write operation. */
export interface WriteFileResponse {
  /** Absolute path of the file that was written. */
  path: string;
  /** True when the write succeeded. */
  success: boolean;
}

// ---------------------------------------------------------------------------
// Create directory
// ---------------------------------------------------------------------------

/** Request payload to create a directory on disk. */
export interface CreateDirectoryRequest {
  /** Absolute path of the directory to create. */
  path: string;
  /** Create parent directories when missing. */
  recursive?: boolean;
}

/** Response payload confirming directory creation. */
export interface CreateDirectoryResponse {
  /** Absolute path of the directory that was created. */
  path: string;
  /** True when the operation succeeded. */
  success: boolean;
}

// ---------------------------------------------------------------------------
// Delete path
// ---------------------------------------------------------------------------

/** Request payload to delete a file or directory. */
export interface DeletePathRequest {
  /** Absolute path of the file or directory to delete. */
  path: string;
  /** Delete non-empty directories recursively. */
  recursive?: boolean;
}

/** Response payload confirming deletion. */
export interface DeletePathResponse {
  /** Absolute path that was deleted. */
  path: string;
  /** True when the delete operation succeeded. */
  success: boolean;
}

// ---------------------------------------------------------------------------
// List directory
// ---------------------------------------------------------------------------

/** Request payload to list the contents of a directory. */
export interface ListDirectoryRequest {
  /** Absolute path of the directory to list. */
  path: string;
  /** When true, recursively lists all descendants. */
  recursive?: boolean;
  /** When true, includes hidden files and directories (names starting with '.'). */
  includeHidden?: boolean;
}

/** Response payload containing directory entries. */
export interface ListDirectoryResponse {
  /** Absolute path of the directory that was listed. */
  path: string;
  /** Top-level entries (children populated when recursive was true). */
  entries: DirectoryEntry[];
}

// ---------------------------------------------------------------------------
// Open / Save dialogs
// ---------------------------------------------------------------------------

/** Filter definition used in native open/save dialogs. */
export interface DialogFilter {
  /** Human-readable label shown in the dialog (e.g. "TypeScript Files"). */
  name: string;
  /** List of extensions without the leading dot (e.g. ["ts", "tsx"]). */
  extensions: string[];
}

/** Request payload to open a native file/directory picker dialog. */
export interface OpenDialogRequest {
  /** Dialog window title. */
  title?: string;
  /** Initial directory shown in the dialog. */
  defaultPath?: string;
  /** File type filters. */
  filters?: DialogFilter[];
  /**
   * Dialog behaviour flags:
   * - 'openFile'       – allow selecting files
   * - 'openDirectory'  – allow selecting directories
   * - 'multiSelections'– allow selecting multiple items
   */
  properties?: ('openFile' | 'openDirectory' | 'multiSelections')[];
}

/** Response payload from a native open dialog. */
export interface OpenDialogResponse {
  /** True when the user dismissed the dialog without selecting anything. */
  canceled: boolean;
  /** Absolute paths of the selected files/directories. Empty when canceled. */
  filePaths: string[];
}

/** Request payload to open a native save dialog. */
export interface SaveDialogRequest {
  /** Dialog window title. */
  title?: string;
  /** Initial path/filename shown in the dialog. */
  defaultPath?: string;
  /** File type filters. */
  filters?: DialogFilter[];
}

/** Response payload from a native save dialog. */
export interface SaveDialogResponse {
  /** True when the user dismissed the dialog without choosing a path. */
  canceled: boolean;
  /** Absolute path chosen by the user. Absent when canceled. */
  filePath?: string;
}

// ---------------------------------------------------------------------------
// File watcher
// ---------------------------------------------------------------------------

/** Request payload to start watching a directory for changes. */
export interface WatchDirectoryRequest {
  /** Absolute path of the directory to watch. */
  path: string;
  /** When true, watches all descendants recursively. */
  recursive?: boolean;
}

/**
 * Event emitted by the file watcher whenever a change is detected.
 * Delivered to the renderer via the IPC_CHANNELS.FILE_CHANGE channel.
 */
export interface FileChangeEvent {
  /** Nature of the change. */
  type: 'created' | 'modified' | 'deleted' | 'renamed';
  /** Absolute path of the affected file or directory. */
  path: string;
  /** Previous absolute path — only present for 'renamed' events. */
  oldPath?: string;
}

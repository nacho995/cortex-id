import { Pipe, PipeTransform } from '@angular/core';

const EXTENSION_ICONS: Record<string, string> = {
  // TypeScript
  ts: 'icon-ts',
  tsx: 'icon-tsx',
  // JavaScript
  js: 'icon-js',
  jsx: 'icon-jsx',
  mjs: 'icon-js',
  cjs: 'icon-js',
  // Web
  html: 'icon-html',
  htm: 'icon-html',
  css: 'icon-css',
  scss: 'icon-scss',
  sass: 'icon-scss',
  less: 'icon-css',
  // Data
  json: 'icon-json',
  yaml: 'icon-yaml',
  yml: 'icon-yaml',
  toml: 'icon-toml',
  xml: 'icon-xml',
  // Docs
  md: 'icon-md',
  mdx: 'icon-md',
  txt: 'icon-txt',
  pdf: 'icon-pdf',
  // Java
  java: 'icon-java',
  kt: 'icon-kotlin',
  gradle: 'icon-gradle',
  // Python
  py: 'icon-python',
  pyi: 'icon-python',
  // Rust
  rs: 'icon-rust',
  // Go
  go: 'icon-go',
  // C/C++
  c: 'icon-c',
  cpp: 'icon-cpp',
  h: 'icon-c',
  hpp: 'icon-cpp',
  // Shell
  sh: 'icon-shell',
  bash: 'icon-shell',
  zsh: 'icon-shell',
  fish: 'icon-shell',
  // Config
  env: 'icon-env',
  gitignore: 'icon-git',
  gitattributes: 'icon-git',
  dockerfile: 'icon-docker',
  // Images
  png: 'icon-image',
  jpg: 'icon-image',
  jpeg: 'icon-image',
  gif: 'icon-image',
  svg: 'icon-svg',
  webp: 'icon-image',
  ico: 'icon-image',
};

const FILENAME_ICONS: Record<string, string> = {
  'package.json': 'icon-npm',
  'package-lock.json': 'icon-npm',
  'pnpm-lock.yaml': 'icon-npm',
  'yarn.lock': 'icon-npm',
  '.gitignore': 'icon-git',
  '.gitattributes': 'icon-git',
  'dockerfile': 'icon-docker',
  'docker-compose.yml': 'icon-docker',
  'docker-compose.yaml': 'icon-docker',
  'angular.json': 'icon-angular',
  'tsconfig.json': 'icon-ts',
  'tsconfig.app.json': 'icon-ts',
  'tsconfig.spec.json': 'icon-ts',
  '.eslintrc.json': 'icon-eslint',
  '.eslintrc.js': 'icon-eslint',
  'pom.xml': 'icon-java',
  'build.gradle': 'icon-gradle',
  'settings.gradle': 'icon-gradle',
  'readme.md': 'icon-md',
  'license': 'icon-txt',
  'makefile': 'icon-shell',
};

/**
 * Pipe that returns a CSS class name based on file name or extension.
 * Used by the file explorer to show appropriate file type icons.
 */
@Pipe({
  name: 'fileIcon',
  pure: true,
  standalone: true,
})
export class FileIconPipe implements PipeTransform {
  transform(filename: string, isDirectory = false): string {
    if (isDirectory) return 'icon-folder';

    const lower = filename.toLowerCase();

    // Check exact filename match first
    if (FILENAME_ICONS[lower]) return FILENAME_ICONS[lower];

    // Check extension
    const lastDot = filename.lastIndexOf('.');
    if (lastDot !== -1) {
      const ext = filename.slice(lastDot + 1).toLowerCase();
      if (EXTENSION_ICONS[ext]) return EXTENSION_ICONS[ext];
    }

    return 'icon-file';
  }
}

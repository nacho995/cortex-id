/**
 * Minimal shim for NodeJS types used in shared-types.
 * This avoids adding @types/node as a dependency to the Angular frontend.
 */
declare namespace NodeJS {
  type Platform =
    | 'aix'
    | 'android'
    | 'darwin'
    | 'freebsd'
    | 'haiku'
    | 'linux'
    | 'openbsd'
    | 'sunos'
    | 'win32'
    | 'cygwin'
    | 'netbsd';
}

import * as path from 'path';

interface ResolveFrontendEntryPathParams {
  isDev: boolean;
  dirname: string;
  resourcesPath: string;
}

type FrontendEntry = { type: 'url'; value: string } | { type: 'file'; value: string };

export function resolveFrontendEntryPath(params: ResolveFrontendEntryPathParams): FrontendEntry {
  if (params.isDev) {
    return { type: 'url', value: 'http://localhost:4200' };
  }

  const legacyDistPath = path.join(
    params.dirname,
    '..',
    '..',
    'frontend',
    'dist',
    'frontend',
    'browser',
    'index.html',
  );
  const packagedPath = path.join(params.resourcesPath, 'frontend', 'index.html');
  // Prefer packaged resources path; keep legacy dist path for local fallback in non-packaged runs.
  return { type: 'file', value: params.resourcesPath ? packagedPath : legacyDistPath };
}

import { resolveFrontendEntryPath } from '../../window/frontend-path';

describe('resolveFrontendEntryPath', () => {
  it('returns dev URL in development mode', () => {
    const entry = resolveFrontendEntryPath({
      isDev: true,
      dirname: '/app/electron/dist/src',
      resourcesPath: '/app/resources',
    });

    expect(entry).toEqual({ type: 'url', value: 'http://localhost:4200' });
  });

  it('returns packaged frontend index path in production mode', () => {
    const entry = resolveFrontendEntryPath({
      isDev: false,
      dirname: '/app/electron/dist/src',
      resourcesPath: '/app/resources',
    });

    expect(entry).toEqual({
      type: 'file',
      value: '/app/resources/frontend/index.html',
    });
  });
});

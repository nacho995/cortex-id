import { TestBed } from '@angular/core/testing';
import { FileExplorerComponent } from './file-explorer.component';
import { IpcService } from '../../core/ipc.service';

describe('FileExplorerComponent context actions', () => {
  const ipcMock = {
    openDialog: jasmine.createSpy('openDialog'),
    listDirectory: jasmine.createSpy('listDirectory').and.resolveTo({ path: '/tmp', entries: [] }),
    writeFile: jasmine.createSpy('writeFile').and.resolveTo({ path: '/tmp/new.ts', success: true }),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: IpcService, useValue: ipcMock }],
    });
    ipcMock.writeFile.calls.reset();
    ipcMock.listDirectory.calls.reset();
  });

  function createComponent(): FileExplorerComponent {
    return TestBed.runInInjectionContext(() => new FileExplorerComponent());
  }

  it('newFile creates a file in selected directory', async () => {
    const component = createComponent();
    spyOn(window, 'prompt').and.returnValue('new-file.ts');
    component.contextMenu.set({
      x: 0,
      y: 0,
      node: {
        path: '/workspace',
        name: 'workspace',
        isDirectory: true,
        isFile: false,
        size: 0,
        modifiedAt: Date.now(),
        level: 0,
      } as any,
    });
    component.rootPath.set('/workspace');

    await (component as any).newFile();

    expect(ipcMock.writeFile).toHaveBeenCalledWith(
      jasmine.objectContaining({
        path: '/workspace/new-file.ts',
        createIfNotExists: true,
      }),
    );
  });
});

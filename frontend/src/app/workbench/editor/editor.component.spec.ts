import { ChangeDetectorRef, ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EditorComponent } from './editor.component';
import { IpcService } from '../../core/ipc.service';
import { ConfigService } from '../../core/config.service';
import { ThemeService } from '../../core/theme.service';

describe('EditorComponent folder flow', () => {
  const ipcMock = {
    openDialog: jasmine.createSpy('openDialog'),
    readFile: jasmine.createSpy('readFile'),
    writeFile: jasmine.createSpy('writeFile'),
  };
  const configMock = {
    settings: jasmine.createSpy('settings').and.returnValue({
      fontSize: 14,
      fontFamily: 'JetBrains Mono',
      tabSize: 2,
      wordWrap: false,
      minimap: true,
      scrollBeyondLastLine: false,
      renderWhitespace: 'selection',
      lineNumbers: 'on',
      folding: true,
      bracketPairColorization: true,
      smoothScrolling: true,
      cursorBlinking: 'smooth',
      cursorStyle: 'line',
      fontLigatures: true,
      guides: true,
      autoSaveDelay: 1000,
    }),
    autoSave: jasmine.createSpy('autoSave').and.returnValue(false),
  };
  const themeMock = {
    activeTheme: jasmine.createSpy('activeTheme').and.returnValue({ monacoTheme: 'vs-dark' }),
    notifyMonacoReady: jasmine.createSpy('notifyMonacoReady'),
  };
  const cdrMock = { markForCheck: jasmine.createSpy('markForCheck') };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: IpcService, useValue: ipcMock },
        { provide: ConfigService, useValue: configMock },
        { provide: ThemeService, useValue: themeMock },
        { provide: ChangeDetectorRef, useValue: cdrMock },
      ],
    });
    ipcMock.openDialog.calls.reset();
  });

  function createComponent(): EditorComponent {
    const comp = TestBed.runInInjectionContext(() => new EditorComponent());
    comp.editorContainer = new ElementRef(document.createElement('div'));
    return comp;
  }

  it('openFolder emits selected folder path', async () => {
    ipcMock.openDialog.and.resolveTo({ canceled: false, filePaths: ['/workspace/project'] });
    const component = createComponent();
    const emitSpy = jasmine.createSpy('emit');
    (component as any).folderOpened = { emit: emitSpy };

    await component.openFolder();

    expect(emitSpy).toHaveBeenCalledWith('/workspace/project');
  });
});

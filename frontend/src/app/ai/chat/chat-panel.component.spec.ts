import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, EMPTY } from 'rxjs';
import { ChatPanelComponent } from './chat-panel.component';
import { WebSocketService } from '../../core/websocket.service';
import { IpcService } from '../../core/ipc.service';
import { ChangeDetectorRef } from '@angular/core';

describe('ChatPanelComponent provider key handling', () => {
  const status$ = new BehaviorSubject<'connected' | 'disconnected' | 'reconnecting'>('disconnected');

  const wsMock = {
    connectionStatus$: status$.asObservable(),
    send: jasmine.createSpy('send'),
    on: jasmine.createSpy('on').and.returnValue(EMPTY),
    createMessage: jasmine
      .createSpy('createMessage')
      .and.callFake((type: string, payload: unknown) => ({ type, payload, id: '1', timestamp: 1 })),
  };
  const ipcMock = {
    getApiKey: jasmine.createSpy('getApiKey'),
  };
  const cdrMock = {
    markForCheck: jasmine.createSpy('markForCheck'),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: WebSocketService, useValue: wsMock },
        { provide: IpcService, useValue: ipcMock },
        { provide: ChangeDetectorRef, useValue: cdrMock },
      ],
    });
    wsMock.send.calls.reset();
    wsMock.createMessage.calls.reset();
    ipcMock.getApiKey.calls.reset();
    status$.next('disconnected');
    localStorage.clear();
  });

  function createComponent(): ChatPanelComponent {
    return TestBed.runInInjectionContext(() => new ChatPanelComponent());
  }

  it('marks provider models as available when key exists in IPC (Electron)', async () => {
    ipcMock.getApiKey.and.callFake(async ({ service }: { service: string }) => ({
      service,
      exists: service === 'anthropic',
      maskedKey: 'sk-ant-...test',
    }));
    const component = createComponent();

    await (component as any).updateModelAvailability();

    const anthropicModel = component.allModels.find((model) => model.id.startsWith('claude-'));
    const openaiModel = component.allModels.find((model) => model.id.startsWith('gpt-'));
    expect(anthropicModel?.available).toBeTrue();
    expect(openaiModel?.available).toBeFalse();
  });
});

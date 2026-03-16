import { TestBed } from '@angular/core/testing';
import { SettingsPanelComponent } from './settings-panel.component';
import { ConfigService } from '../../core/config.service';
import { IpcService } from '../../core/ipc.service';
import { WebSocketService } from '../../core/websocket.service';
import { ThemeService } from '../../core/theme.service';
import { WsMessageType } from '@cortex-id/shared-types/ws/messages.types';

describe('SettingsPanelComponent API key flow', () => {
  const configMock = {
    settings: jasmine.createSpy('settings').and.returnValue({}),
    updateSettings: jasmine.createSpy('updateSettings').and.resolveTo(),
  };
  const ipcMock = {
    setApiKey: jasmine.createSpy('setApiKey').and.resolveTo(),
    getApiKey: jasmine.createSpy('getApiKey').and.resolveTo({ exists: false }),
  };
  const wsMock = {
    send: jasmine.createSpy('send'),
    createMessage: jasmine
      .createSpy('createMessage')
      .and.callFake((type: WsMessageType, payload: unknown) => ({
        type,
        payload,
        id: 'id-1',
        timestamp: 1,
      })),
    on: jasmine.createSpy('on'),
  };
  const themeMock = {
    activeTheme: jasmine.createSpy('activeTheme').and.returnValue({ id: 'dark' }),
    backgroundConfig: jasmine
      .createSpy('backgroundConfig')
      .and.returnValue({ type: 'none', opacity: 15, blur: 8, position: 'cover' }),
    setTheme: jasmine.createSpy('setTheme'),
    setBackground: jasmine.createSpy('setBackground'),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: ConfigService, useValue: configMock },
        { provide: IpcService, useValue: ipcMock },
        { provide: WebSocketService, useValue: wsMock },
        { provide: ThemeService, useValue: themeMock },
      ],
    });
    ipcMock.setApiKey.calls.reset();
    wsMock.send.calls.reset();
    wsMock.createMessage.calls.reset();
  });

  function createComponent(): SettingsPanelComponent {
    return TestBed.runInInjectionContext(() => new SettingsPanelComponent());
  }

  it('saveApiKey stores key and sends API_KEY_SET to backend', async () => {
    const component = createComponent();
    component.apiKey.set('sk-ant-test');

    await component.saveApiKey();

    expect(ipcMock.setApiKey).toHaveBeenCalledWith({ service: 'anthropic', key: 'sk-ant-test' });
    expect(wsMock.createMessage).toHaveBeenCalledWith(
      WsMessageType.API_KEY_SET,
      jasmine.objectContaining({ provider: 'anthropic', apiKey: 'sk-ant-test' }),
    );
    expect(wsMock.send).toHaveBeenCalled();
  });

  it('chooseBackgroundImage triggers file picker only once', () => {
    const component = createComponent();
    const fakeInput = {
      type: '',
      accept: '',
      style: { display: '' },
      files: [],
      onchange: null as null | (() => void),
      click: jasmine.createSpy('click'),
    };
    spyOn(document, 'createElement').and.returnValue(fakeInput as unknown as HTMLInputElement);
    spyOn(document.body, 'appendChild').and.callFake(() => fakeInput as any);
    spyOn(document.body, 'removeChild').and.callFake(() => fakeInput as any);

    component.chooseBackgroundImage();

    expect(fakeInput.click).toHaveBeenCalledTimes(1);
  });
});

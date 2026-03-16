import { TestBed } from '@angular/core/testing';
import { PanelsComponent } from './panels.component';

describe('PanelsComponent actions', () => {
  function createComponent(): PanelsComponent {
    return TestBed.runInInjectionContext(() => new PanelsComponent());
  }

  it('emits close request when close action is triggered', () => {
    const component = createComponent();
    const emitSpy = spyOn((component as any).closeRequested, 'emit');

    (component as any).onCloseClick();

    expect(emitSpy).toHaveBeenCalled();
  });

  it('emits maximize toggle state when maximize action is triggered', () => {
    const component = createComponent();
    const emitSpy = spyOn((component as any).maximizeRequested, 'emit');

    (component as any).onToggleMaximizeClick();

    expect(emitSpy).toHaveBeenCalledWith(true);
  });
});

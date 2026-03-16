import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./workbench/workbench.component').then(
        (m) => m.WorkbenchComponent
      ),
  },
  { path: '**', redirectTo: '' },
];

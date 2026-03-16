import { Injectable, signal } from '@angular/core';

export interface VSXExtension {
  id: string;
  name: string;
  publisher: string;
  displayName: string;
  description: string;
  version: string;
  iconUrl?: string;
  installed: boolean;
}

@Injectable({ providedIn: 'root' })
export class ExtensionsService {
  readonly searchResults = signal<VSXExtension[]>([]);
  readonly isSearching = signal(false);

  async search(query: string): Promise<void> {
    if (!query.trim()) { this.searchResults.set([]); return; }
    this.isSearching.set(true);
    try {
      const res = await fetch(`https://open-vsx.org/api/-/search?query=${encodeURIComponent(query)}&size=20&sortBy=relevance`);
      const data = await res.json();
      this.searchResults.set((data.extensions ?? []).map((e: any) => ({
        id: `${e.namespace}.${e.name}`,
        name: e.name,
        publisher: e.namespace,
        displayName: e.displayName || e.name,
        description: e.description || '',
        version: e.version,
        iconUrl: e.files?.icon,
        installed: this.isInstalled(`${e.namespace}.${e.name}`),
      })));
    } catch { this.searchResults.set([]); }
    finally { this.isSearching.set(false); }
  }

  isInstalled(id: string): boolean {
    return JSON.parse(localStorage.getItem('cortex.ext.installed') || '[]').includes(id);
  }

  install(ext: VSXExtension): void {
    const list: string[] = JSON.parse(localStorage.getItem('cortex.ext.installed') || '[]');
    if (!list.includes(ext.id)) { list.push(ext.id); localStorage.setItem('cortex.ext.installed', JSON.stringify(list)); }
    this.searchResults.update(r => r.map(x => x.id === ext.id ? { ...x, installed: true } : x));
  }

  uninstall(id: string): void {
    const list: string[] = JSON.parse(localStorage.getItem('cortex.ext.installed') || '[]');
    localStorage.setItem('cortex.ext.installed', JSON.stringify(list.filter(x => x !== id)));
    this.searchResults.update(r => r.map(x => x.id === id ? { ...x, installed: false } : x));
  }
}

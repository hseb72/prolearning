import { DOCUMENT } from '@angular/common';
import { effect, inject, Injectable, signal } from '@angular/core';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'pl-theme';

function isPreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

/**
 * Thème de l'interface : celui du système par défaut, ou clair / sombre choisi par la
 * personne (SPEC-UI § 2 : `data-theme` sur la racine). Le choix reste sur ce poste.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly root = inject(DOCUMENT).documentElement;
  readonly preference = signal<ThemePreference>(this.read());

  constructor() {
    effect(() => {
      const preference = this.preference();
      if (preference === 'system') this.root.removeAttribute('data-theme');
      else this.root.setAttribute('data-theme', preference);
      this.write(preference);
    });
  }

  // Stockage du navigateur indisponible (navigation privée stricte) : on garde le thème système.
  private read(): ThemePreference {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return isPreference(stored) ? stored : 'system';
    } catch {
      return 'system';
    }
  }

  private write(preference: ThemePreference): void {
    try {
      if (preference === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // Sans stockage, le choix vaut pour cette visite seulement.
    }
  }
}

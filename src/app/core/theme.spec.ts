import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme';

describe('ThemeService', () => {
  const root = document.documentElement;

  beforeEach(() => {
    localStorage.clear();
    root.removeAttribute('data-theme');
    TestBed.resetTestingModule();
  });

  it('suit le système par défaut, sans attribut data-theme', () => {
    const theme = TestBed.inject(ThemeService);
    TestBed.tick();
    expect(theme.preference()).toBe('system');
    expect(root.hasAttribute('data-theme')).toBe(false);
  });

  it('applique et mémorise un choix, puis revient au système', () => {
    const theme = TestBed.inject(ThemeService);
    theme.preference.set('dark');
    TestBed.tick();
    expect(root.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('pl-theme')).toBe('dark');

    theme.preference.set('system');
    TestBed.tick();
    expect(root.hasAttribute('data-theme')).toBe(false);
    expect(localStorage.getItem('pl-theme')).toBeNull();
  });

  it('reprend le choix mémorisé et ignore une valeur inconnue', () => {
    localStorage.setItem('pl-theme', 'light');
    expect(TestBed.inject(ThemeService).preference()).toBe('light');
    TestBed.resetTestingModule();
    localStorage.setItem('pl-theme', 'fluo');
    expect(TestBed.inject(ThemeService).preference()).toBe('system');
  });
});

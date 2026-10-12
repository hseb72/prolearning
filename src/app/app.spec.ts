import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { Me } from '@shared/auth';
import { App } from './app';
import { AuthService } from './core/auth';
import { LABELS } from './labels';

function me(overrides: Partial<Me> = {}): Me {
  const user = {
    id: 1,
    displayName: 'Léa Dupont',
    email: 'lea@soredi.example',
    role: 'employee' as const,
  };
  return { user, actor: user, space: 'production', canSwitchSpace: false, ...overrides };
}

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  function render(session: Me | null): HTMLElement {
    TestBed.inject(AuthService).me.set(session);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it('affiche la marque et un lien d’évitement vers le contenu', () => {
    const el = render(null);
    expect(el.querySelector('.logo')?.textContent).toContain(LABELS.app.name);
    expect(el.querySelector('.skip-link')?.getAttribute('href')).toBe('#contenu');
    expect(el.querySelector('main#contenu')).not.toBeNull();
    expect(el.querySelector('nav')).toBeNull();
  });

  it('montre à un collaborateur son nom et son rôle, sans bandeau ni administration', () => {
    const el = render(me());
    expect(el.querySelector('.me-name')?.textContent).toContain('Léa Dupont · collaborateur');
    expect(el.querySelector('.spacesw')).toBeNull();
    const banner = el.querySelector('.demo[data-space]');
    expect(banner?.getAttribute('data-space')).toBe('production');
    expect(banner?.textContent).toContain(LABELS.space.productionBanner);
    expect(el.querySelector('nav.nav')?.textContent).not.toContain(LABELS.nav.admin);
  });

  it('signale l’espace production à un administrateur et propose la démonstration', () => {
    const admin = {
      id: 2,
      displayName: 'Paul',
      email: 'paul@soredi.example',
      role: 'admin' as const,
    };
    const el = render(me({ user: admin, actor: admin, canSwitchSpace: true }));
    const banner = el.querySelector('.demo[data-space]');
    expect(banner?.getAttribute('data-space')).toBe('production');
    expect(banner?.textContent).toContain(LABELS.space.productionBanner);
    const toDemo = el.querySelector(`.spacesw button[aria-label="${LABELS.space.toDemo}"]`);
    expect(toDemo?.getAttribute('aria-pressed')).toBe('false');
    expect(el.querySelector('nav.nav')?.textContent).toContain(LABELS.nav.admin);
  });

  it('signale la démonstration et le rôle joué', () => {
    const admin = {
      id: 2,
      displayName: 'Paul',
      email: 'paul@soredi.example',
      role: 'admin' as const,
    };
    const persona = {
      id: 4,
      displayName: 'David Moreau',
      email: 'david@demo.invalid',
      role: 'employee' as const,
    };
    const el = render(me({ user: admin, actor: persona, space: 'demo', canSwitchSpace: true }));
    TestBed.inject(HttpTestingController).match('/api/space/personas');
    const banner = el.querySelector('.demo[data-space]');
    expect(banner?.getAttribute('data-space')).toBe('demo');
    expect(banner?.textContent).toContain(LABELS.space.demoBanner);
    expect(el.querySelector('#persona')?.textContent).toContain('David Moreau — Collaborateur');
    expect(el.querySelector('.me-name')?.textContent).toContain('David Moreau · collaborateur');
    // Le compte joué est un collaborateur : pas d'administration, même pour un administrateur.
    expect(el.querySelector('nav.nav')?.textContent).not.toContain(LABELS.nav.admin);
  });
});

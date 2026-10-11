import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { LABELS } from './labels';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('affiche la marque et un lien d’évitement vers le contenu', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.brand-name')?.textContent).toContain(LABELS.app.name);
    const skip = el.querySelector<HTMLAnchorElement>('.skip-link');
    expect(skip?.getAttribute('href')).toBe('#contenu');
    expect(el.querySelector('main#contenu')).not.toBeNull();
  });
});

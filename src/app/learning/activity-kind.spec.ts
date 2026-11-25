import { TestBed } from '@angular/core/testing';
import { ActivityIcon, activityKind } from './activity-kind';

describe('famille des activités', () => {
  it('range leçons, diaporamas et fiches dans les cours', () => {
    for (const type of ['lecon', 'diaporama', 'fiches']) expect(activityKind(type)).toBe('cours');
  });

  it('distingue le quiz des autres exercices', () => {
    expect(activityKind('quiz')).toBe('quiz');
    for (const type of ['ordre', 'association', 'scenario', 'pratique']) {
      expect(activityKind(type)).toBe('exercice');
    }
  });

  it('dessine une icône décorative, ignorée des lecteurs d’écran', () => {
    const fixture = TestBed.createComponent(ActivityIcon);
    fixture.componentRef.setInput('kind', 'quiz');
    fixture.detectChanges();
    const svg = (fixture.nativeElement as HTMLElement).querySelector('svg')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.querySelectorAll('path').length).toBe(3);
  });
});

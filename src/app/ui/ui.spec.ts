import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LABELS } from '../labels';
import { Badge } from './badge';
import { FilterChips } from './filter-chips';
import { ImportReport } from './import';
import { ModuleTile } from './module-tile';
import { ProgressRing } from './progress';
import { SessionRow } from './session-row';
import { RequestSteps, StatusPill, statusKey, stepIndex } from './status';

@Component({
  imports: [
    StatusPill,
    RequestSteps,
    FilterChips,
    ModuleTile,
    ProgressRing,
    Badge,
    ImportReport,
    SessionRow,
  ],
  template: `
    <app-status status="attente_manager" />
    <app-status status="confirmee" />
    <app-request-steps status="attente_formation" />
    <app-filter-chips label="Modalité" [options]="options" [(value)]="value" />
    <button appModuleTile type="button" num="3" heading="L’ADM" tileState="locked"></button>
    <button appModuleTile type="button" num="1" heading="Introduction" tileState="done"></button>
    <app-progress-ring [value]="4" [max]="9" />
    <app-badge id="sans-faute" />
    <app-import-report name="f.json" [errors]="['a', 'b']" [warnings]="['c']" />
    <app-session-row
      start="2026-11-03T08:00:00.000Z"
      heading="Kubernetes"
      modalite="site"
      [remaining]="0"
      [capacity]="10"
    />
  `,
})
class Host {
  readonly options = [
    { value: 'a', label: 'Toutes' },
    { value: 'b', label: 'En ligne' },
  ] as const;
  readonly value = signal<'a' | 'b'>('a');
}

describe('composants communs', () => {
  function render(): { el: HTMLElement; host: Host; detect: () => void } {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return {
      el: fixture.nativeElement,
      host: fixture.componentInstance,
      detect: () => fixture.detectChanges(),
    };
  }

  it('affiche les statuts du prototype, validation manager comprise (décision C)', () => {
    expect(statusKey('attente_manager')).toBe('envoyee');
    expect(statusKey('a_traiter')).toBe('envoyee');
    expect(statusKey('attente_formation')).toBe('en_cours');
    expect(statusKey('confirmee')).toBe('acceptee');
    expect(stepIndex('annulee')).toBe(-1);
    const { el } = render();
    const pills = el.querySelectorAll('app-status');
    expect([...pills[0]!.classList].sort()).toEqual(['st-envoyee', 'status']);
    expect(pills[0]!.textContent).toBe(LABELS.ui.status.envoyee);
    expect(pills[1]!.textContent).toBe('Acceptée');
    const steps = el.querySelectorAll('app-request-steps > span');
    expect(Array.from(steps).map((s) => s.classList.contains('on'))).toEqual([true, true, false]);
    expect(steps[1]!.textContent).toContain('Validation manager');
  });

  it('filtre en pilules avec aria-pressed', () => {
    const { el, host, detect } = render();
    const buttons = el.querySelectorAll<HTMLButtonElement>('.chipbtn');
    expect(buttons[0]!.getAttribute('aria-pressed')).toBe('true');
    buttons[1]!.click();
    detect();
    expect(host.value()).toBe('b');
    expect(buttons[1]!.getAttribute('aria-pressed')).toBe('true');
    expect(buttons[0]!.getAttribute('aria-pressed')).toBe('false');
  });

  it('signale une tuile verrouillée et coche une tuile terminée', () => {
    const { el } = render();
    const [locked, done] = Array.from(el.querySelectorAll('button.node'));
    expect([...locked!.classList].sort()).toEqual(['locked', 'node']);
    expect(locked!.getAttribute('aria-disabled')).toBe('true');
    expect(done!.querySelector('.num')?.textContent).toBe('✓');
  });

  it('dessine l’anneau et nomme la progression', () => {
    const { el } = render();
    const ring = el.querySelector('app-progress-ring')!;
    expect(ring.getAttribute('aria-label')).toBe('4 modules terminés sur 9');
    expect(ring.querySelector('text')?.textContent?.trim()).toBe('4/9');
    expect(ring.querySelectorAll('circle')).toHaveLength(2);
  });

  it('grise un badge non obtenu', () => {
    const { el } = render();
    const badge = el.querySelector('app-badge')!;
    expect([...badge.classList].sort()).toEqual(['badge', 'off']);
    expect(badge.textContent).toContain('Sans faute');
  });

  it('résume le rapport d’import', () => {
    const { el } = render();
    const report = el.querySelector('app-import-report')!;
    expect(report.textContent).toContain('2 erreurs bloquantes');
    expect(report.textContent).toContain('1 avertissement');
    expect(report.querySelectorAll('div.e')).toHaveLength(2);
  });

  it('affiche une session complète à l’heure de Paris', () => {
    const { el } = render();
    const row = el.querySelector('app-session-row')!;
    expect(row.querySelector('.date b')?.textContent).toBe('3');
    expect(row.querySelector('.seats')?.textContent).toContain('Complet');
    expect(row.querySelector('.seats em')?.getAttribute('style')).toContain('width: 100%');
  });
});

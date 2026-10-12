import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LABELS } from '../../labels';
import type { ActivityContext } from './activity-context';
import { Order } from './order';

const CTX: ActivityContext = {
  formationId: 'f',
  moduleId: 'm',
  activity: {
    id: 'etapes',
    type: 'ordre',
    titre: 'Les étapes',
    obligatoire: true,
    consigne: 'Remettez les étapes dans l’ordre.',
    elements: [
      { cle: 'k2', texte: 'Deux' },
      { cle: 'k1', texte: 'Un' },
      { cle: 'k3', texte: 'Trois' },
    ],
  },
  state: { statut: 'a-faire', points: 0, score: null },
  glossary: [],
  references: [],
};

describe('Order (activité « ordre »)', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [Order],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  function render() {
    const fixture = TestBed.createComponent(Order);
    fixture.componentRef.setInput('ctx', CTX);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const button = (label: string) =>
      [...el.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === label)!;
    const texts = () => [...el.querySelectorAll('.order-text')].map((t) => t.textContent?.trim());
    return { fixture, el, button, texts };
  }

  it('déplace les éléments avec les boutons et annonce la nouvelle position', async () => {
    const { fixture, el, button, texts } = render();
    expect(texts()).toEqual(['Deux', 'Un', 'Trois']);
    expect(button(LABELS.learning.moveUp('Deux')).disabled).toBe(true);
    expect(button(LABELS.learning.moveDown('Trois')).disabled).toBe(true);

    button(LABELS.learning.moveUp('Un')).click();
    fixture.detectChanges();
    expect(texts()).toEqual(['Un', 'Deux', 'Trois']);
    expect(el.querySelector('[aria-live]')?.textContent).toContain(
      `Un : ${LABELS.learning.position(1, 3)}`,
    );
  });

  it('envoie l’ordre choisi, par clés, et affiche la correction', async () => {
    const { fixture, el, button } = render();
    button(LABELS.learning.moveUp('Un')).click();
    fixture.detectChanges();
    [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Vérifier')!.click();

    const req = http.expectOne('/api/parcours/f/modules/m/activites/etapes/ordre');
    expect(req.request.body).toEqual({ ordre: ['k1', 'k2', 'k3'] });
    req.flush({
      juste: true,
      solution: ['k1', 'k2', 'k3'],
      explication: 'Dans l’ordre.',
      etat: { statut: 'faite', points: 30, score: 1 },
      moduleTermine: false,
    });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.textContent).toContain(LABELS.learning.orderRight);
    expect(el.textContent).toContain(LABELS.learning.earned(30));
  });
});

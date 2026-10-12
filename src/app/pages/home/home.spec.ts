import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LABELS } from '../../labels';
import { HomePage } from './home';

describe('HomePage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  async function render(respond: (http: HttpTestingController) => void): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();
    TestBed.tick();
    respond(http);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it('annonce un service disponible', async () => {
    const el = await render((h) =>
      h.expectOne('/api/health').flush({
        status: 'ok',
        databases: { production: 'ok', demo: 'ok' },
      }),
    );
    expect(el.querySelector('[role=status]')?.textContent).toContain(LABELS.home.healthOk);
  });

  it('annonce un mode dégradé quand une base est injoignable', async () => {
    const el = await render((h) =>
      h
        .expectOne('/api/health')
        .flush(
          { status: 'degraded', databases: { production: 'ok', demo: 'unreachable' } },
          { status: 503, statusText: 'Service Unavailable' },
        ),
    );
    expect(el.querySelector('[role=status]')?.textContent).toContain(LABELS.home.healthDegraded);
  });

  it('annonce un service indisponible quand l’API ne répond pas', async () => {
    const el = await render((h) =>
      h.expectOne('/api/health').error(new ProgressEvent('error'), { status: 0 }),
    );
    expect(el.querySelector('[role=status]')?.textContent).toContain(LABELS.home.healthDown);
  });
});

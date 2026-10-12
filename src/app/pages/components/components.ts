import { NgTemplateOutlet } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import type { BadgeId } from '@shared/gamification';
import type { Reference } from '@shared/learning';
import { LABELS } from '../../labels';
import { AdminNav } from '../../layout/admin-nav';
import { References } from '../../learning/references';
import { Badge } from '../../ui/badge';
import { Callout } from '../../ui/callout';
import { CodeBlock } from '../../ui/code-block';
import { ConfirmService } from '../../ui/confirm';
import { CourseCard } from '../../ui/course-card';
import { Deepen } from '../../ui/deepen';
import { Dialog } from '../../ui/dialog';
import { EmptyState } from '../../ui/empty';
import { FilterChips } from '../../ui/filter-chips';
import { DropZone, ImportReport } from '../../ui/import';
import { ModuleTile } from '../../ui/module-tile';
import { ProgressBar, ProgressRing } from '../../ui/progress';
import { QuizOption } from '../../ui/quiz-option';
import { SessionRow } from '../../ui/session-row';
import { Stat } from '../../ui/stat';
import { RequestSteps, StatusPill, type RequestStatus } from '../../ui/status';
import { Tag } from '../../ui/tag';
import { ToastService } from '../../ui/toast';
import { TpStep } from '../../ui/tp-step';

/**
 * Bibliothèque de composants (SPEC-UI § 4) : chaque composant et ses états, dans les deux
 * thèmes côte à côte. Page interne, réservée aux administrateurs. Les données sont fictives.
 */
@Component({
  selector: 'app-components-page',
  imports: [
    NgTemplateOutlet,
    AdminNav,
    Badge,
    Callout,
    CodeBlock,
    CourseCard,
    Deepen,
    Dialog,
    DropZone,
    EmptyState,
    FilterChips,
    ImportReport,
    ModuleTile,
    ProgressBar,
    ProgressRing,
    QuizOption,
    References,
    RequestSteps,
    SessionRow,
    Stat,
    StatusPill,
    Tag,
    TpStep,
  ],
  templateUrl: './components.html',
  styles: `
    .themes {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 20px;
    }
    section + section {
      margin-top: 28px;
    }
    .demo-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      margin: 0 0 12px;
    }
    .demo-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 16px;
    }
  `,
})
export class ComponentsPage {
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  protected readonly themes = [
    { id: 'light', label: 'Thème clair' },
    { id: 'dark', label: 'Thème sombre' },
  ] as const;

  protected readonly statuses: RequestStatus[] = [
    'attente_manager',
    'attente_formation',
    'confirmee',
    'refusee',
    'annulee',
  ];
  protected readonly modalities = [
    { value: 'toutes', label: 'Toutes' },
    { value: 'en-ligne', label: 'En ligne' },
    { value: 'distance', label: 'À distance' },
    { value: 'site', label: 'Sur site' },
  ] as const;
  protected readonly modality = signal<'toutes' | 'en-ligne' | 'distance' | 'site'>('toutes');
  protected readonly badges: { id: BadgeId; earned: boolean }[] = [
    { id: 'premier-pas', earned: true },
    { id: 'module-termine', earned: true },
    { id: 'sans-faute', earned: false },
    { id: 'stratege', earned: false },
    { id: 'parcours-termine', earned: false },
  ];
  protected readonly references: Reference[] = [
    {
      id: 'r1',
      titre: 'The TOGAF Standard, 10th Edition',
      source: 'The Open Group',
      url: 'https://www.opengroup.org/togaf',
      type: 'norme',
      acces: 'inscription',
      langue: 'en',
      note: 'Texte de référence',
    },
    {
      id: 'r2',
      titre: 'Guide de la modélisation',
      source: 'Wiki interne',
      type: 'guide',
      acces: 'interne',
      langue: 'fr',
    },
    {
      id: 'r3',
      titre: 'Kubernetes Documentation',
      source: 'CNCF',
      url: 'https://kubernetes.io/docs/',
      type: 'documentation',
      acces: 'libre',
      langue: 'en',
    },
    {
      id: 'r4',
      titre: 'Certification TOGAF',
      source: 'The Open Group',
      url: 'https://www.opengroup.org/certifications',
      type: 'formation',
      acces: 'payant',
      langue: 'en',
    },
  ];
  protected readonly referenceIds = this.references.map((r) => r.id);
  protected readonly code = 'kubectl get pods -n demo\nkubectl describe pod web-0 -n demo';
  protected readonly start = new Date(Date.now() + 14 * 86_400_000).toISOString();
  protected readonly dialogOpen = signal<string | null>(null);
  protected readonly dropped = signal('');

  protected showToast(): void {
    this.toast.show('Demande envoyée pour **Kubernetes : les fondamentaux**.');
  }

  protected async askConfirm(): Promise<void> {
    const ok = await this.confirm.ask({
      eyebrow: 'Démonstration',
      title: 'Annuler cette demande ?',
      text: 'L’équipe formation en sera informée.',
      confirm: 'Annuler la demande',
      cancel: 'Garder',
    });
    this.toast.show(ok ? 'Demande **annulée**.' : 'Demande **gardée**.');
  }

  protected setDialog(theme: string, open: boolean): void {
    this.dialogOpen.set(open ? theme : null);
  }

  protected readonly labels = LABELS.ui;
}

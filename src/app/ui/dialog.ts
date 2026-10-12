import { afterRenderEffect, Component, ElementRef, input, model, viewChild } from '@angular/core';

/**
 * Dialogue modal natif (`dialog` + `.dlg`, SPEC-UI § 4) : focus piégé et Échap fournis par
 * le navigateur. Ouvert tant que `open` est vrai ; la fermeture (Échap compris) le remet à
 * faux.
 */
@Component({
  selector: 'app-dialog',
  template: `
    <dialog #dialog [attr.aria-labelledby]="labelledBy()" (close)="open.set(false)">
      @if (open()) {
        <div class="dlg"><ng-content /></div>
      }
    </dialog>
  `,
})
export class Dialog {
  readonly open = model(false);
  /** Identifiant du titre du dialogue. */
  readonly labelledBy = input.required<string>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    afterRenderEffect(() => {
      const el = this.dialog().nativeElement;
      if (this.open() && !el.open) el.showModal();
      if (!this.open() && el.open) el.close();
    });
  }

  close(): void {
    this.open.set(false);
  }
}

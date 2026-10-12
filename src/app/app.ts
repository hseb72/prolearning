import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LABELS } from './labels';
import { SiteHeader } from './layout/site-header';
import { ConfirmHost } from './ui/confirm';
import { ToastHost } from './ui/toast';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SiteHeader, ConfirmHost, ToastHost],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly labels = LABELS.app;
}

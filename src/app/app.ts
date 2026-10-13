import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LABELS } from './labels';
import { SiteHeader } from './layout/site-header';
import { ThemeSwitch } from './layout/theme-switch';
import { ConfirmHost } from './ui/confirm';
import { ToastHost } from './ui/toast';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SiteHeader, ThemeSwitch, ConfirmHost, ToastHost],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly labels = LABELS.app;
}

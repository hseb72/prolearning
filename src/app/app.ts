import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth';
import { LABELS } from './labels';
import { SiteHeader } from './layout/site-header';
import { ThemeSwitch } from './layout/theme-switch';
import { ConfirmHost } from './ui/confirm';
import { ToastHost } from './ui/toast';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, SiteHeader, ThemeSwitch, ConfirmHost, ToastHost],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly labels = LABELS.app;
  protected readonly privacy = LABELS.privacy;
  protected readonly auth = inject(AuthService);
}

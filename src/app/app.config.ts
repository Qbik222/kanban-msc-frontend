import {
  ApplicationConfig,
  APP_INITIALIZER,
  ErrorHandler,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors, withXsrfConfiguration } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { csrfCookieInterceptor } from './core/interceptors/csrf-cookie.interceptor';
import { httpErrorInterceptor } from './core/interceptors/http-error.interceptor';
import { GlobalErrorHandler } from './core/errors/global-error-handler';
import { AuthService } from './core/auth/auth.service';
import { environment } from '../environments/environment';

function authBootstrapFactory(auth: AuthService): () => Promise<void> {
  return () => auth.bootstrapSession();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([csrfCookieInterceptor, authInterceptor, httpErrorInterceptor]),
      withXsrfConfiguration({
        cookieName: environment.csrfCookieName,
        headerName: 'X-XSRF-TOKEN',
      }),
    ),
    {
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: authBootstrapFactory,
      deps: [AuthService],
    },
    provideAnimationsAsync(),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
  ],
};

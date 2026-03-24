import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

export const AuthInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const token = authService.getToken();

  let authReq = req;
  if (token) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        // 🔹 Token inválido o expirado
        authService.logout();
        router.navigate(['/login']);
      } else if (error.status === 403) {
        // 🔹 Usuario autenticado pero sin permisos suficientes
        router.navigate(['/acceso-denegado']); // 👈 creamos un componente de error
      }

      return throwError(() => error);
    })
  );
};

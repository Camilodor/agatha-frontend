import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const AuthGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const isAuth = authService.isAuthenticated();
  const userRole = authService.getRole();
  const allowedRoles = route.data?.['roles'] as Array<string>;

  if (isAuth && (!allowedRoles || allowedRoles.includes(userRole!))) {
    return true; // ✅ Usuario autenticado y con rol permitido
  }

  router.navigate(['/login']);
  return false;
};

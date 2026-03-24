// src/app/services/auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://127.0.0.1:8000/api';

  constructor(private http: HttpClient, private router: Router) {}

  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  }

  login(credentials: { login: string; contrasena: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, credentials).pipe(
      tap((res: any) => {
        if (this.isBrowser() && (res.token || res.access_token)) {
          localStorage.setItem('access_token', res.token ?? res.access_token);
          localStorage.setItem('user', JSON.stringify(res.user));
          localStorage.setItem('rol', res.user?.rol ?? res.rol);
          localStorage.setItem('rol_id', res.user?.rol_id ?? '');
          localStorage.setItem('rol_nombre', res.user?.rol_nombre ?? '');
        }
      })
    );
  }

    getUser(): any {
    if (!this.isBrowser()) return null;
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }

  getRole(): string | null {
    if (!this.isBrowser()) return null;
    return localStorage.getItem('rol') || null;
  }

  getToken(): string | null {
    if (!this.isBrowser()) return null;
    return localStorage.getItem('access_token');
  }

  logout(): void {
    if (this.isBrowser()) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      localStorage.removeItem('rol');
      localStorage.removeItem('rol_id');
      localStorage.removeItem('rol_nombre');
    }
    this.router.navigate(['/login']);
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  getRoleName(): string | null {
    if (!this.isBrowser()) return null;
    return localStorage.getItem('rol_nombre');
  }

  getRoleId(): number | null {
    if (!this.isBrowser()) return null;
    const id = localStorage.getItem('rol_id');
    return id ? parseInt(id, 10) : null;
  }
}

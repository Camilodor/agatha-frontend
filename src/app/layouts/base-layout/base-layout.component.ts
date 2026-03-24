import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';


@Component({
  selector: 'app-base-layout',
  standalone: true,
  imports: [CommonModule,RouterModule],
  templateUrl: './base-layout.component.html',
  styleUrls: ['./base-layout.component.css']
})
export class BaseLayoutComponent implements OnInit {
  user: { nombre: string, rol: string, avatar?: string } = { nombre: '', rol: '', avatar: '' };

  activeRoute: string = ''; // <<-- Declarar la propiedad aquí

  constructor(private authService: AuthService, private router: Router) {
    // Detectar ruta activa
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.activeRoute = event.urlAfterRedirects;
      }
    });
  }

  ngOnInit(): void {
    const usuario = this.authService.getUser();
    const rol = this.authService.getRole();

    if (usuario) {
      this.user.nombre = `${usuario.nombre_usuario}`;
      this.user.rol = rol || 'Usuario';
      this.user.avatar = usuario.avatar || 'assets/admin.png';
    }
  }

  logout() {
    this.authService.logout();
  }

  isActive(route: string): boolean {
    return this.activeRoute === route;
  }
}

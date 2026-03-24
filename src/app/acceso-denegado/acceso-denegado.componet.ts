import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-acceso-denegado',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './acceso-denegado.component.html',
  styleUrls: ['./acceso-denegado.component.css']
})
export class AccesoDenegadoComponent {
    isAuth = false;
  userRole: string | null = null;

  constructor(private authService: AuthService, private router: Router) {
    this.isAuth = this.authService.isAuthenticated();
    this.userRole = this.authService.getRole();
  }

  volver() {
    if (!this.isAuth) {
      this.router.navigate(['/login']);
      return;
    }

    switch (this.userRole) {
      case 'Administrador':
        this.router.navigate(['/admin']);
        break;
      case 'Bodeguero':
        this.router.navigate(['/bodega']);
        break;
      case 'Conductor':
        this.router.navigate(['/conductor']);
        break;
      default:
        this.router.navigate(['/']);
        break;
    }
  }
}

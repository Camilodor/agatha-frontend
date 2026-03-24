import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet } from '@angular/router';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet], // <-- agregar RouterModule
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css']
})
export class Admin implements OnInit {

  today = new Date();
  stats = { mercancias: 0, despachos: 0, entregas: 0, devoluciones: 0 };
  
  user: { nombre: string, rol: string, avatar?: string } = { nombre: '', rol: '', avatar: '' };

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit(): void {
    const usuario = this.authService.getUser();
    const rol = this.authService.getRole();

    if (usuario) {
      this.user.nombre = `${usuario.nombre_usuario}`; // Nombre completo
      this.user.rol = rol || 'Usuario'; // Rol desde localStorage
      this.user.avatar = usuario.avatar || 'assets/admin.png';
    }
  }

  logout() {
    this.authService.logout();
  }
}

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, RouterOutlet } from '@angular/router';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-cliente',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, RouterOutlet],
  templateUrl: './cliente.component.html',
  styleUrls: ['./cliente.component.css']
})
export class Cliente implements OnInit {

  today = new Date();

  stats = {
    totalRemesas: 0,
    enBodega:     0,
    enCamino:     0,
    entregadas:   0,
    devoluciones: 0,
  };

  remesaBusqueda = '';

  user: { nombre: string; rol: string; avatar?: string } = {
    nombre: '',
    rol:    '',
    avatar: ''
  };

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit(): void {
    const usuario = this.authService.getUser();
    const rol     = this.authService.getRole();

    if (usuario) {
      this.user.nombre = `${usuario.nombre_usuario}`;
      this.user.rol    = rol || 'Cliente';
      this.user.avatar = usuario.avatar || 'assets/cliente.png';
    }

    // TODO: cargar stats reales desde el servicio de seguimientos
    // this.cargarStats();
  }

  buscarRemesa() {
    if (!this.remesaBusqueda.trim()) return;
    this.router.navigate(['cliente/seguimientos'], {
      queryParams: { remesa: this.remesaBusqueda.trim() }
    });
  }

  logout() {
    this.authService.logout();
  }
}
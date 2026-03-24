import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  loginData = {
    login: '',
    contrasena: ''
  };
  isLoading = false; 
  errorMessage = '';

  constructor(private authService: AuthService, private router: Router) {}
onSubmit() {
  this.isLoading = true;
  this.authService.login(this.loginData).subscribe({
    next: (res) => {
      localStorage.setItem('token', res.token ?? res.access_token);
      localStorage.setItem('user', JSON.stringify(res.user));

      // Manejo de rol (soporta string o {id, nombre})
      let rolNombre: string;
      let rolId: number | null = null;

      if (typeof res.user.rol === 'string') {
        rolNombre = res.user.rol;
      } else {
        rolNombre = res.user.rol.nombre;
        rolId = res.user.rol.id;
      }

      localStorage.setItem('rol_nombre', rolNombre);
      if (rolId !== null) {
        localStorage.setItem('rol_id', rolId.toString());
      }

      // 🔹 Redirección según rol
      if (rolNombre === 'Administrador') {
        this.router.navigate(['/admin']);
      } else if (rolNombre === 'Bodeguero') {
        this.router.navigate(['/bodeguero']);
      } else if (rolNombre === 'Conductor') {
        this.router.navigate(['/conductor']);
        } else if (rolNombre === 'Cliente') {
        this.router.navigate(['/cliente']);
      } else {
        this.router.navigate(['/']);
      }
    },
    error: () => {
      this.errorMessage = 'Credenciales incorrectas';
    }
  });
}
}


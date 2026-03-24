import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { forkJoin, BehaviorSubject, switchMap } from 'rxjs';
import { ApiService } from '../services/api.service';
import { NgxPaginationModule } from 'ngx-pagination';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { Document, Packer, Paragraph, Table, TableRow, TableCell } from 'docx';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [FormsModule, CommonModule, NgxPaginationModule],
  templateUrl: './usuarios.component.html',
  styleUrls: ['./usuarios.component.css']
})
export class UsuariosComponent implements OnInit {

  // ── Dropdown ───────────────────────────────────────
  dropdownOpen = false;

  toggleDropdown(event: MouseEvent) {
    event.stopPropagation();
    this.dropdownOpen = !this.dropdownOpen;
  }

  ngOnInit() {
    document.addEventListener('click', () => { this.dropdownOpen = false; });
  }

  // ── Data stream ────────────────────────────────────
  private refrescar$ = new BehaviorSubject<void>(undefined);

  data$ = this.refrescar$.pipe(
    switchMap(() =>
      forkJoin({
        roles:      this.api.getTiposRol(),
        documentos: this.api.getTiposDocumento(),
        usuarios:   this.api.getUsuarios()
      })
    )
  );

  // ── Estado UI ──────────────────────────────────────
  usuarioForm: any   = this.getEmptyForm();
  editando           = false;
  editId: number | null = null;
  filtroNombre       = '';
  filtroCedula       = '';
  filtroId           = '';
  modalVisible       = false;
  usuarioConsultado: any = null;
  mostrarContrasena  = false;
  mostrarConfirmacion = false;
  fieldErrors: Record<string, string> = {};

  // ── Paginación ─────────────────────────────────────
  page     = 1;
  pageSize = 8;

  // ── Ordenamiento ───────────────────────────────────
  sortColumn    = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  // ── Alertas ────────────────────────────────────────
  alertaVisible  = false;
  alertaMensaje  = '';
  alertaTipo: 'exito' | 'error' = 'exito';

  constructor(private api: ApiService) {}

  // ── Modales ────────────────────────────────────────
  abrirModal(u?: any) {
    if (u) {
      this.editando = true;
      this.editId   = u.id;
      this.usuarioForm = { ...u };
    } else {
      this.resetForm();
    }
    this.modalVisible        = true;
    this.mostrarContrasena   = false;
    this.mostrarConfirmacion = false;
    this.fieldErrors         = {};
  }

  cerrarModal()    { this.modalVisible = false; this.resetForm(); this.fieldErrors = {}; }
  cerrarConsulta() { this.usuarioConsultado = null; }

  /** Limpia el error de un campo cuando el usuario empieza a corregirlo */
  clearError(campo: string) {
    delete this.fieldErrors[campo];
  }

  // ── Guardar ────────────────────────────────────────
  guardarUsuario() {
    this.fieldErrors = {};

    // ── Validaciones frontend completas ────────────────
    if (!this.usuarioForm.nombre_usuario?.trim())
      this.fieldErrors['nombre_usuario'] = 'El nombre de usuario es obligatorio.';

    if (!this.usuarioForm.email?.trim())
      this.fieldErrors['email'] = 'El email es obligatorio.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.usuarioForm.email))
      this.fieldErrors['email'] = 'Ingresa un email válido.';

    if (!this.editando) {
      if (!this.usuarioForm.contrasena)
        this.fieldErrors['contrasena'] = 'La contraseña es obligatoria.';
      else if (this.usuarioForm.contrasena.length < 8)
        this.fieldErrors['contrasena'] = 'La contraseña debe tener mínimo 8 caracteres.';

      if (!this.usuarioForm.contrasena_confirmation)
        this.fieldErrors['contrasena_confirmation'] = 'Debes confirmar la contraseña.';
      else if (this.usuarioForm.contrasena !== this.usuarioForm.contrasena_confirmation)
        this.fieldErrors['contrasena_confirmation'] = 'Las contraseñas no coinciden.';
    }

    if (!this.usuarioForm.tipo_rol_id)
      this.fieldErrors['tipo_rol_id'] = 'Selecciona un rol.';

    if (!this.usuarioForm.nombres?.trim())
      this.fieldErrors['nombres'] = 'Los nombres son obligatorios.';

    if (!this.usuarioForm.apellidos?.trim())
      this.fieldErrors['apellidos'] = 'Los apellidos son obligatorios.';

    if (!this.usuarioForm.tipo_documento_id)
      this.fieldErrors['tipo_documento_id'] = 'Selecciona un tipo de documento.';

    if (!this.usuarioForm.numero_documento?.toString().trim())
      this.fieldErrors['numero_documento'] = 'El número de documento es obligatorio.';

    if (!this.usuarioForm.celular?.toString().trim())
      this.fieldErrors['celular'] = 'El celular es obligatorio.';
    else if (!/^\d{7,15}$/.test(this.usuarioForm.celular.toString().trim()))
      this.fieldErrors['celular'] = 'Ingresa un número de celular válido.';

    if (!this.usuarioForm.direccion?.trim())
      this.fieldErrors['direccion'] = 'La dirección es obligatoria.';

    if (!this.usuarioForm.ciudad?.trim())
      this.fieldErrors['ciudad'] = 'La ciudad es obligatoria.';

    // Si hay cualquier error frontend, detener y no llamar al API
    if (Object.keys(this.fieldErrors).length > 0) return;

    if (!confirm(`¿${this.editando ? 'Editar' : 'Crear'} este usuario?`)) return;

    const payload = { ...this.usuarioForm };
    if (this.editando) delete payload.contrasena_confirmation;

    const request = this.editando && this.editId
      ? this.api.actualizarUsuario(this.editId, payload)
      : this.api.crearUsuario(payload);

    request.subscribe({
      next: () => {
        this.refrescarDatos();
        this.mostrarAlerta(`Usuario ${this.editando ? 'actualizado' : 'creado'} con éxito.`, 'exito');
      },
      error: (error) => {
        if (error.status === 422 && error.error?.errors) {
          // Errores del backend (ej: email duplicado, documento duplicado)
          const errores = error.error.errors as Record<string, string[]>;
          Object.entries(errores).forEach(([campo, mensajes]) => {
            this.fieldErrors[campo] = mensajes[0];
          });
        } else {
          this.mostrarAlerta('Error inesperado. Intente nuevamente.', 'error');
        }
      }
    });
  }

  // ── Eliminar ───────────────────────────────────────
  eliminarUsuario(id: number) {
    if (!confirm('¿Eliminar este usuario? Esta acción no se puede deshacer.')) return;
    this.api.eliminarUsuario(id).subscribe({
      next:  () => { this.refrescarDatos(); this.mostrarAlerta('Usuario eliminado.', 'exito'); },
      error: () => this.mostrarAlerta('Error al eliminar usuario.', 'error')
    });
  }

  // ── Consultar ──────────────────────────────────────
  consultarUsuario(id: number) {
    this.api.getUsuario(id).subscribe({
      next:  res => this.usuarioConsultado = res,
      error: ()  => this.mostrarAlerta('Error al consultar usuario.', 'error')
    });
  }

  // ── Helpers UI ─────────────────────────────────────
  /** Iniciales del avatar */
  getInitials(nombres: string, apellidos: string): string {
    const n = nombres?.charAt(0)?.toUpperCase() ?? '';
    const a = apellidos?.charAt(0)?.toUpperCase() ?? '';
    return `${n}${a}`;
  }

  /** Clase CSS del badge de rol */
  getRolClass(id: number, roles: any[]): string {
    const nombre = this.getNombreRol(id, roles).toLowerCase();
    if (nombre.includes('admin'))     return 'rol-admin';
    if (nombre.includes('bodegu'))    return 'rol-bodeguero';
    if (nombre.includes('conductor')) return 'rol-conductor';
    if (nombre.includes('cliente'))   return 'rol-cliente';
    return 'rol-default';
  }

  getNombreRol(id: number, roles: any[]): string {
    return roles.find(r => r.id === id)?.nombre ?? '—';
  }

  getNombreDocumento(id: number, documentos: any[]): string {
    return documentos.find(d => d.id === id)?.nombre ?? '—';
  }

  usuariosFiltrados(usuarios: any[]): any[] {
    let lista = usuarios.filter(u => {
      const nombres   = (u.nombres   ?? '').toLowerCase();
      const apellidos = (u.apellidos ?? '').toLowerCase();
      const doc       = (u.numero_documento ?? '').toString();
      return (
        (!this.filtroNombre || nombres.includes(this.filtroNombre.toLowerCase()) || apellidos.includes(this.filtroNombre.toLowerCase())) &&
        (!this.filtroCedula || doc.includes(this.filtroCedula))
      );
    });
    if (this.sortColumn) {
      lista = lista.sort((a, b) => {
        const va = (a[this.sortColumn] ?? '').toString().toLowerCase();
        const vb = (b[this.sortColumn] ?? '').toString().toLowerCase();
        if (va < vb) return this.sortDirection === 'asc' ? -1 : 1;
        if (va > vb) return this.sortDirection === 'asc' ?  1 : -1;
        return 0;
      });
    }
    return lista;
  }

  ordenar(columna: string) {
    if (this.sortColumn === columna) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn    = columna;
      this.sortDirection = 'asc';
    }
  }

  // ── Alertas ────────────────────────────────────────
  mostrarAlerta(mensaje: string, tipo: 'exito' | 'error') {
    this.alertaMensaje = mensaje;
    this.alertaTipo    = tipo;
    this.alertaVisible = true;
    setTimeout(() => this.alertaVisible = false, 4000);
  }
  cerrarAlerta() { this.alertaVisible = false; }

  // ── Privados ───────────────────────────────────────
  private resetForm() {
    this.usuarioForm = this.getEmptyForm();
    this.editando = false;
    this.editId   = null;
  }

  private getEmptyForm() {
    return {
      nombre_usuario: '', nombres: '', apellidos: '',
      tipo_documento_id: '', numero_documento: '',
      celular: '', direccion: '', ciudad: '',
      email: '', contrasena: '', tipo_rol_id: '',
      contrasena_confirmation: ''
    };
  }

  private refrescarDatos() { this.refrescar$.next(); this.cerrarModal(); }

  // ── Exportar ───────────────────────────────────────
  exportarExcel(usuarios: any[]) {
    const ws = XLSX.utils.json_to_sheet(usuarios);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Usuarios');
    XLSX.writeFile(wb, 'usuarios.xlsx');
  }

  exportarCSV(usuarios: any[]) {
    const ws  = XLSX.utils.json_to_sheet(usuarios);
    const csv = XLSX.utils.sheet_to_csv(ws);
    saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'usuarios.csv');
  }

  exportarWord(usuarios: any[]) {
    const rows = usuarios.map(u =>
      new TableRow({ children: [
        new TableCell({ children: [new Paragraph(u.id.toString())] }),
        new TableCell({ children: [new Paragraph(u.nombre_usuario)] }),
        new TableCell({ children: [new Paragraph(u.nombres + ' ' + u.apellidos)] }),
        new TableCell({ children: [new Paragraph(u.numero_documento?.toString() ?? '')] }),
      ]})
    );
    const doc = new Document({ sections: [{ children: [
      new Paragraph('Reporte de Usuarios — AGATHA'),
      new Table({ rows: [
        new TableRow({ children: [
          new TableCell({ children: [new Paragraph('ID')] }),
          new TableCell({ children: [new Paragraph('Usuario')] }),
          new TableCell({ children: [new Paragraph('Nombre')] }),
          new TableCell({ children: [new Paragraph('Documento')] }),
        ]}),
        ...rows
      ]})
    ]}]});
    Packer.toBlob(doc).then(blob => saveAs(blob, 'usuarios.docx'));
  }

  async exportarPDF(usuarios: any[]) {
    const pdfMake = await import('pdfmake/build/pdfmake');
    const pdfFonts = await import('pdfmake/build/vfs_fonts');
    (pdfMake as any).vfs = (pdfFonts as any).vfs;
    const body = [
      ['ID', 'Usuario', 'Nombre completo', 'Documento'],
      ...usuarios.map(u => [u.id, u.nombre_usuario, `${u.nombres} ${u.apellidos}`, u.numero_documento])
    ];
    (pdfMake as any).createPdf({
      content: [
        { text: 'Reporte de Usuarios — AGATHA', style: 'header' },
        { table: { body } }
      ],
      styles: { header: { fontSize: 16, bold: true, margin: [0, 0, 0, 12] } }
    }).download('usuarios.pdf');
  }
}
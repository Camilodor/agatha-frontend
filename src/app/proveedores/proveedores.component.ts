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
  selector: 'app-proveedores',
  standalone: true,
  imports: [FormsModule, CommonModule, NgxPaginationModule],
  templateUrl: './proveedores.component.html',
  styleUrls: ['./proveedores.component.css']
})
export class ProveedoresComponent implements OnInit {

  // ── Dropdown ───────────────────────────────────────
  dropdownOpen = false;
  toggleDropdown(event: MouseEvent) { event.stopPropagation(); this.dropdownOpen = !this.dropdownOpen; }
  ngOnInit() { document.addEventListener('click', () => { this.dropdownOpen = false; }); }

  // ── Data stream ────────────────────────────────────
  private refrescar$ = new BehaviorSubject<void>(undefined);
  data$ = this.refrescar$.pipe(
    switchMap(() => forkJoin({ proveedores: this.api.getProveedores() }))
  );

  // ── Estado UI ──────────────────────────────────────
  proveedorForm: any        = this.getEmptyForm();
  editando                  = false;
  editId: number | null     = null;
  filtroNombre              = '';
  filtroDocumento           = '';
  modalVisible              = false;
  proveedorConsultado: any  = null;
  fieldErrors: Record<string, string> = {};

  // ── Paginación / orden ─────────────────────────────
  page          = 1;
  pageSize      = 8;
  sortColumn    = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  // ── Alertas ────────────────────────────────────────
  alertaVisible = false;
  alertaMensaje = '';
  alertaTipo: 'exito' | 'error' = 'exito';

  constructor(private api: ApiService) {}

  // ── Modales ────────────────────────────────────────
  abrirModal(p?: any) {
    if (p) {
      this.editando = true;
      this.editId   = p.id;
      this.proveedorForm = { ...p, numero_documento: p.usuario?.numero_documento ?? '' };
    } else {
      this.resetForm();
    }
    this.modalVisible = true;
    this.fieldErrors  = {};
  }

  cerrarModal()    { this.modalVisible = false; this.resetForm(); this.fieldErrors = {}; }
  cerrarConsulta() { this.proveedorConsultado = null; }

  clearError(campo: string) { delete this.fieldErrors[campo]; }

  // ── Guardar ────────────────────────────────────────
  guardarProveedor() {
    this.fieldErrors = {};

    if (!this.proveedorForm.nombre?.trim())
      this.fieldErrors['nombre'] = 'El nombre del proveedor es obligatorio.';

    if (!this.proveedorForm.numero_documento?.toString().trim())
      this.fieldErrors['numero_documento'] = 'El número de documento del usuario es obligatorio.';
    else if (!/^\d{6,15}$/.test(this.proveedorForm.numero_documento.toString().trim()))
      this.fieldErrors['numero_documento'] = 'Ingresa un número de documento válido (solo dígitos).';

    if (Object.keys(this.fieldErrors).length > 0) return;

    if (!confirm(`¿${this.editando ? 'Editar' : 'Crear'} este proveedor?`)) return;

    const request = this.editando && this.editId
      ? this.api.actualizarProveedor(this.editId, this.proveedorForm)
      : this.api.crearProveedor(this.proveedorForm);

    request.subscribe({
      next: () => {
        this.refrescarDatos();
        this.mostrarAlerta(`Proveedor ${this.editando ? 'actualizado' : 'creado'} con éxito.`, 'exito');
      },
      error: (error) => {
        if (error.status === 422 && error.error?.errors) {
          const errores = error.error.errors as Record<string, string[]>;
          Object.entries(errores).forEach(([campo, mensajes]) => {
            this.fieldErrors[campo] = mensajes[0];
          });
        } else if (error.status === 404 || error.status === 422) {
          this.fieldErrors['numero_documento'] = 'No existe un usuario con ese número de documento.';
        } else {
          this.mostrarAlerta('Error inesperado. Intente nuevamente.', 'error');
        }
      }
    });
  }

  // ── Eliminar ───────────────────────────────────────
  eliminarProveedor(id: number) {
    if (!confirm('¿Eliminar este proveedor? Esta acción no se puede deshacer.')) return;
    this.api.eliminarProveedor(id).subscribe({
      next:  () => { this.refrescarDatos(); this.mostrarAlerta('Proveedor eliminado.', 'exito'); },
      error: () => this.mostrarAlerta('Error al eliminar el proveedor.', 'error')
    });
  }

  // ── Consultar ──────────────────────────────────────
  consultarProveedor(id: number) {
    this.api.getProveedor(id).subscribe({
      next:  res => this.proveedorConsultado = res,
      error: ()  => this.mostrarAlerta('Error al consultar el proveedor.', 'error')
    });
  }

  // ── Helpers UI ─────────────────────────────────────
  getInitials(nombre: string): string {
    return (nombre ?? '').split(' ').slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('');
  }

  proveedoresFiltrados(proveedores: any[]): any[] {
    let lista = proveedores.filter(p => {
      const nombre = (p.nombre ?? '').toLowerCase();
      const doc    = (p.usuario?.numero_documento ?? '').toString();
      return (!this.filtroNombre    || nombre.includes(this.filtroNombre.toLowerCase()))
          && (!this.filtroDocumento || doc.includes(this.filtroDocumento));
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
    this.sortDirection = this.sortColumn === columna && this.sortDirection === 'asc' ? 'desc' : 'asc';
    this.sortColumn = columna;
  }

  // ── Alertas ────────────────────────────────────────
  mostrarAlerta(mensaje: string, tipo: 'exito' | 'error') {
    this.alertaMensaje = mensaje; this.alertaTipo = tipo; this.alertaVisible = true;
    setTimeout(() => this.alertaVisible = false, 4000);
  }
  cerrarAlerta() { this.alertaVisible = false; }

  // ── Privados ───────────────────────────────────────
  private resetForm() { this.proveedorForm = this.getEmptyForm(); this.editando = false; this.editId = null; }
  private getEmptyForm() { return { nombre: '', descripcion: '', numero_documento: '' }; }
  private refrescarDatos() { this.refrescar$.next(); this.cerrarModal(); }

  // ── Exportar ───────────────────────────────────────
  exportarExcel(proveedores: any[]) {
    const ws = XLSX.utils.json_to_sheet(proveedores);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Proveedores');
    XLSX.writeFile(wb, 'proveedores.xlsx');
  }
  exportarCSV(proveedores: any[]) {
    const ws  = XLSX.utils.json_to_sheet(proveedores);
    const csv = XLSX.utils.sheet_to_csv(ws);
    saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'proveedores.csv');
  }
  exportarWord(proveedores: any[]) {
    const rows = proveedores.map(p =>
      new TableRow({ children: [
        new TableCell({ children: [new Paragraph(p.id.toString())] }),
        new TableCell({ children: [new Paragraph(p.nombre)] }),
        new TableCell({ children: [new Paragraph(p.descripcion ?? '')] }),
        new TableCell({ children: [new Paragraph(p.usuario?.numero_documento ?? '')] }),
      ]})
    );
    const doc = new Document({ sections: [{ children: [
      new Paragraph('Reporte de Proveedores — AGATHA'),
      new Table({ rows: [
        new TableRow({ children: [
          new TableCell({ children: [new Paragraph('ID')] }),
          new TableCell({ children: [new Paragraph('Nombre')] }),
          new TableCell({ children: [new Paragraph('Descripción')] }),
          new TableCell({ children: [new Paragraph('Doc. Usuario')] }),
        ]}),
        ...rows
      ]})
    ]}]});
    Packer.toBlob(doc).then(blob => saveAs(blob, 'proveedores.docx'));
  }
  async exportarPDF(proveedores: any[]) {
    const pdfMake  = await import('pdfmake/build/pdfmake');
    const pdfFonts = await import('pdfmake/build/vfs_fonts');
    (pdfMake as any).vfs = (pdfFonts as any).vfs;
    (pdfMake as any).createPdf({
      content: [
        { text: 'Reporte de Proveedores — AGATHA', style: 'header' },
        { table: { body: [
          ['ID', 'Nombre', 'Descripción', 'Doc. Usuario'],
          ...proveedores.map(p => [p.id, p.nombre, p.descripcion ?? '', p.usuario?.numero_documento ?? ''])
        ]}}
      ],
      styles: { header: { fontSize: 16, bold: true, margin: [0, 0, 0, 12] } }
    }).download('proveedores.pdf');
  }
}
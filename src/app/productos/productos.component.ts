import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { forkJoin, BehaviorSubject, switchMap } from 'rxjs';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { NgxPaginationModule } from 'ngx-pagination';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { Document, Packer, Paragraph, Table, TableRow, TableCell } from 'docx';

@Component({
  selector: 'app-productos',
  standalone: true,
  imports: [FormsModule, CommonModule, NgxPaginationModule],
  templateUrl: './productos.component.html',
  styleUrls: ['./productos.component.css']
})
export class ProductosComponent implements OnInit {

  // ── Dropdown ───────────────────────────────────────
  dropdownOpen = false;
  toggleDropdown(e: MouseEvent) { e.stopPropagation(); this.dropdownOpen = !this.dropdownOpen; }
  ngOnInit() { document.addEventListener('click', () => { this.dropdownOpen = false; }); }

  // ── Data stream ────────────────────────────────────
  private refrescar$ = new BehaviorSubject<void>(undefined);
  data$ = this.refrescar$.pipe(
    switchMap(() => forkJoin({
      proveedores: this.api.getProveedores(),
      productos:   this.api.getProductos()
    }))
  );

  // ── Estado UI ──────────────────────────────────────
  productoForm: any       = this.getEmptyForm();
  editando                = false;
  editId: number | null   = null;
  filtroNombre            = '';
  filtroProveedor         = '';
  modalVisible            = false;
  productoConsultado: any = null;
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

  constructor(private api: ApiService, private auth: AuthService) {}

  // ── Modales ────────────────────────────────────────
  abrirModal(p?: any) {
    if (p) {
      this.editando = true;
      this.editId   = p.id;
      this.productoForm = {
        nombre:        p.nombre,
        descripcion:   p.descripcion ?? '',
        proveedores_id: p.proveedores?.id ?? '',
      };
    } else {
      this.resetForm();
    }
    this.modalVisible = true;
    this.fieldErrors  = {};
  }

  cerrarModal()    { this.modalVisible = false; this.resetForm(); this.fieldErrors = {}; }
  cerrarConsulta() { this.productoConsultado = null; }
  clearError(campo: string) { delete this.fieldErrors[campo]; }

  // ── Guardar ────────────────────────────────────────
  guardarProducto() {
    this.fieldErrors = {};

    if (!this.productoForm.nombre?.trim())
      this.fieldErrors['nombre'] = 'El nombre del producto es obligatorio.';

    if (!this.productoForm.proveedores_id)
      this.fieldErrors['proveedores_id'] = 'Debes seleccionar un proveedor.';

    if (Object.keys(this.fieldErrors).length > 0) return;

    if (!confirm(`¿${this.editando ? 'Editar' : 'Crear'} este producto?`)) return;

    const request = this.editando && this.editId
      ? this.api.actualizarProducto(this.editId, this.productoForm)
      : this.api.crearProducto(this.productoForm);

    request.subscribe({
      next: () => {
        this.refrescarDatos();
        this.mostrarAlerta(`Producto ${this.editando ? 'actualizado' : 'creado'} con éxito.`, 'exito');
      },
      error: (error) => {
        if (error.status === 422 && error.error?.errors) {
          const errores = error.error.errors as Record<string, string[]>;
          Object.entries(errores).forEach(([campo, msgs]) => {
            this.fieldErrors[campo] = msgs[0];
          });
        } else {
          this.mostrarAlerta('Error inesperado. Intente nuevamente.', 'error');
        }
      }
    });
  }

  // ── Eliminar ───────────────────────────────────────
  eliminarProducto(id: number) {
    if (!confirm('¿Eliminar este producto? Esta acción no se puede deshacer.')) return;
    this.api.eliminarProducto(id).subscribe({
      next:  () => { this.refrescarDatos(); this.mostrarAlerta('Producto eliminado.', 'exito'); },
      error: () => this.mostrarAlerta('Error al eliminar el producto.', 'error')
    });
  }

  // ── Consultar ──────────────────────────────────────
  consultarProducto(id: number) {
    this.api.getProducto(id).subscribe({
      next:  res => this.productoConsultado = res,
      error: ()  => this.mostrarAlerta('Error al consultar el producto.', 'error')
    });
  }

  // ── Helpers UI ─────────────────────────────────────
  productosFiltrados(productos: any[], proveedores: any[]): any[] {
    let lista = productos.filter(p => {
      const nombre   = (p.nombre ?? '').toLowerCase();
      const provNom  = (p.proveedores?.nombre ?? '').toLowerCase();
      return (!this.filtroNombre    || nombre.includes(this.filtroNombre.toLowerCase()))
          && (!this.filtroProveedor || provNom.includes(this.filtroProveedor.toLowerCase()));
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
  private resetForm() { this.productoForm = this.getEmptyForm(); this.editando = false; this.editId = null; }
  private getEmptyForm() { return { nombre: '', descripcion: '', proveedores_id: '' }; }
  private refrescarDatos() { this.refrescar$.next(); this.cerrarModal(); }

  // ── Exportar ───────────────────────────────────────
  exportarExcel(productos: any[]) {
    const ws = XLSX.utils.json_to_sheet(productos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Productos');
    XLSX.writeFile(wb, 'productos.xlsx');
  }
  exportarCSV(productos: any[]) {
    const ws  = XLSX.utils.json_to_sheet(productos);
    saveAs(new Blob([XLSX.utils.sheet_to_csv(ws)], { type: 'text/csv;charset=utf-8;' }), 'productos.csv');
  }
  exportarWord(productos: any[]) {
    const rows = productos.map(p =>
      new TableRow({ children: [
        new TableCell({ children: [new Paragraph(p.id.toString())] }),
        new TableCell({ children: [new Paragraph(p.nombre)] }),
        new TableCell({ children: [new Paragraph(p.descripcion ?? '')] }),
        new TableCell({ children: [new Paragraph(p.proveedores?.nombre ?? '')] }),
      ]})
    );
    const doc = new Document({ sections: [{ children: [
      new Paragraph('Reporte de Productos — AGATHA'),
      new Table({ rows: [
        new TableRow({ children: [
          new TableCell({ children: [new Paragraph('ID')] }),
          new TableCell({ children: [new Paragraph('Nombre')] }),
          new TableCell({ children: [new Paragraph('Descripción')] }),
          new TableCell({ children: [new Paragraph('Proveedor')] }),
        ]}),
        ...rows
      ]})
    ]}]});
    Packer.toBlob(doc).then(blob => saveAs(blob, 'productos.docx'));
  }
  async exportarPDF(productos: any[]) {
    const pdfMake  = await import('pdfmake/build/pdfmake');
    const pdfFonts = await import('pdfmake/build/vfs_fonts');
    (pdfMake as any).vfs = (pdfFonts as any).vfs;
    (pdfMake as any).createPdf({
      content: [
        { text: 'Reporte de Productos — AGATHA', style: 'header' },
        { table: { body: [
          ['ID', 'Nombre', 'Descripción', 'Proveedor'],
          ...productos.map(p => [p.id, p.nombre, p.descripcion ?? '', p.proveedores?.nombre ?? ''])
        ]}}
      ],
      styles: { header: { fontSize: 16, bold: true, margin: [0, 0, 0, 12] } }
    }).download('productos.pdf');
  }
}
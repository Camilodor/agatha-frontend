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
  selector: 'app-mercancias',
  standalone: true,
  imports: [FormsModule, CommonModule, NgxPaginationModule],
  templateUrl: './mercancias.component.html',
  styleUrls: ['./mercancias.component.css']
})
export class MercanciasComponent implements OnInit {

  // ── Dropdown ───────────────────────────────────────
  dropdownOpen = false;
  toggleDropdown(e: MouseEvent) { e.stopPropagation(); this.dropdownOpen = !this.dropdownOpen; }
  ngOnInit() { document.addEventListener('click', () => { this.dropdownOpen = false; }); }

  // ── Data stream ────────────────────────────────────
  private refrescar$ = new BehaviorSubject<void>(undefined);
  data$ = this.refrescar$.pipe(
    switchMap(() => forkJoin({
      proveedores: this.api.getProveedores(),
      tiposPago:   this.api.getTiposPago(),
      mercancias:  this.api.getMercancias()
    }))
  );

  // ── Estado UI ──────────────────────────────────────
  mercanciaForm: any        = this.getEmptyForm();
  editando                  = false;
  editId: number | null     = null;
  filtroRemesa              = '';
  filtroOrigen              = '';
  filtroDestino             = '';
  modalVisible              = false;
  mercanciaConsultada: any  = null;
  fieldErrors: Record<string, string> = {};

  // ── Productos ──────────────────────────────────────
  productosProveedor:    any[] = [];
  productosSeleccionados: any[] = [];
  productoSeleccionado:  any   = null;

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
  abrirModal(m?: any) {
    if (m) {
      this.editando = true;
      this.editId   = m.id;
      this.mercanciaForm = { ...m };
      // Cargar productos del proveedor si ya tiene uno
      if (m.proveedores_id) this.cargarProductosProveedor(m.proveedores_id);
      // Reconstruir productos seleccionados desde los relacionados
      this.productosSeleccionados = (m.productos ?? []).map((p: any) => ({
        producto_id: p.id,
        nombre:      p.nombre,
        cantidad:    p.pivot?.cantidad ?? 1
      }));
    } else {
      this.resetForm();
    }
    this.modalVisible = true;
    this.fieldErrors  = {};
  }

  cerrarModal()    { this.modalVisible = false; this.resetForm(); this.fieldErrors = {}; }
  cerrarConsulta() { this.mercanciaConsultada = null; }
  clearError(campo: string) { delete this.fieldErrors[campo]; }

  // ── Cambio de proveedor ────────────────────────────
  onProveedorChange(id: any) {
    this.clearError('proveedores_id');
    this.productosSeleccionados = [];
    this.productoSeleccionado   = null;
    this.productosProveedor     = [];
    if (id) this.cargarProductosProveedor(id);
  }

  cargarProductosProveedor(proveedorId: number) {
    this.api.getProductosPorProveedor(proveedorId).subscribe({
      next: (data: any) => { this.productosProveedor = data; },
      error: () => this.mostrarAlerta('Error al cargar productos del proveedor.', 'error')
    });
  }

  // ── Gestión de productos seleccionados ─────────────
  agregarProducto(producto: any) {
    if (!producto) return;
    const existe = this.productosSeleccionados.find(p => p.producto_id === producto.id);
    if (existe) {
      existe.cantidad += 1;
    } else {
      this.productosSeleccionados.push({
        producto_id: producto.id,
        nombre:      producto.nombre,
        cantidad:    1
      });
    }
    this.productoSeleccionado = null;
    // Limpiar error de productos si ya hay al menos uno
    if (this.productosSeleccionados.length > 0) delete this.fieldErrors['productos'];
  }

  eliminarProductoSeleccionado(index: number) {
    this.productosSeleccionados.splice(index, 1);
  }

  get totalUnidades(): number {
    return this.productosSeleccionados.reduce((sum, p) => sum + Number(p.cantidad || 0), 0);
  }

  // ── Guardar ────────────────────────────────────────
  guardarMercancia() {
    this.fieldErrors = {};

    if (!this.mercanciaForm.numero_remesa?.trim())
      this.fieldErrors['numero_remesa'] = 'El número de remesa es obligatorio.';

    if (!this.mercanciaForm.fecha_ingreso)
      this.fieldErrors['fecha_ingreso'] = 'La fecha de ingreso es obligatoria.';

    if (!this.mercanciaForm.origen_mercancia?.trim())
      this.fieldErrors['origen_mercancia'] = 'El origen es obligatorio.';

    if (!this.mercanciaForm.destino_mercancia?.trim())
      this.fieldErrors['destino_mercancia'] = 'El destino es obligatorio.';

    if (!this.mercanciaForm.proveedores_id)
      this.fieldErrors['proveedores_id'] = 'Selecciona un proveedor.';

    if (!this.mercanciaForm.tipo_pago_id)
      this.fieldErrors['tipo_pago_id'] = 'Selecciona el tipo de pago.';

    if (this.productosSeleccionados.length === 0)
      this.fieldErrors['productos'] = 'Debes agregar al menos un producto a la remesa.';

    if (!this.mercanciaForm.peso || Number(this.mercanciaForm.peso) <= 0)
      this.fieldErrors['peso'] = 'El peso es obligatorio y debe ser mayor a 0.';

    if (!this.mercanciaForm.valor_declarado || Number(this.mercanciaForm.valor_declarado) < 0)
      this.fieldErrors['valor_declarado'] = 'El valor declarado es obligatorio.';

    if (!this.mercanciaForm.valor_flete || Number(this.mercanciaForm.valor_flete) < 0)
      this.fieldErrors['valor_flete'] = 'El valor del flete es obligatorio.';

    if (!this.mercanciaForm.valor_total || Number(this.mercanciaForm.valor_total) < 0)
      this.fieldErrors['valor_total'] = 'El valor total es obligatorio.';

    if (!this.mercanciaForm.nombre_remitente?.trim())
      this.fieldErrors['nombre_remitente'] = 'El nombre del remitente es obligatorio.';

    if (!this.mercanciaForm.documento_remitente?.trim())
      this.fieldErrors['documento_remitente'] = 'El documento del remitente es obligatorio.';

    if (!this.mercanciaForm.celular_remitente?.trim())
      this.fieldErrors['celular_remitente'] = 'El celular del remitente es obligatorio.';

    if (!this.mercanciaForm.direccion_remitente?.trim())
      this.fieldErrors['direccion_remitente'] = 'La dirección del remitente es obligatoria.';

    if (!this.mercanciaForm.nombre_destinatario?.trim())
      this.fieldErrors['nombre_destinatario'] = 'El nombre del destinatario es obligatorio.';

    if (!this.mercanciaForm.documento_destinatario?.trim())
      this.fieldErrors['documento_destinatario'] = 'El documento del destinatario es obligatorio.';

    if (!this.mercanciaForm.celular_destinatario?.trim())
      this.fieldErrors['celular_destinatario'] = 'El celular del destinatario es obligatorio.';

    if (!this.mercanciaForm.direccion_destinatario?.trim())
      this.fieldErrors['direccion_destinatario'] = 'La dirección del destinatario es obligatoria.';

    if (Object.keys(this.fieldErrors).length > 0) return;

    if (!confirm(`¿${this.editando ? 'Editar' : 'Registrar'} esta mercancía?`)) return;

    const payload = {
      ...this.mercanciaForm,
      productos: this.productosSeleccionados.map(p => ({
        producto_id: p.producto_id,
        cantidad:    Number(p.cantidad)
      })),
      unidades: this.totalUnidades
    };

    const request = this.editando && this.editId
      ? this.api.actualizarMercancia(this.editId, payload)
      : this.api.crearMercancia(payload);

    request.subscribe({
      next: () => {
        this.refrescarDatos();
        this.mostrarAlerta(`Mercancía ${this.editando ? 'actualizada' : 'registrada'} con éxito.`, 'exito');
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
  eliminarMercancia(id: number) {
    if (!confirm('¿Eliminar esta mercancía? Esta acción no se puede deshacer.')) return;
    this.api.eliminarMercancia(id).subscribe({
      next:  () => { this.refrescarDatos(); this.mostrarAlerta('Mercancía eliminada.', 'exito'); },
      error: () => this.mostrarAlerta('Error al eliminar la mercancía.', 'error')
    });
  }

  // ── Consultar ──────────────────────────────────────
  consultarMercancia(id: number) {
    this.api.getMercancia(id).subscribe({
      next:  res => this.mercanciaConsultada = res,
      error: ()  => this.mostrarAlerta('Error al consultar la mercancía.', 'error')
    });
  }

  // ── Helpers UI ─────────────────────────────────────
  getEstado(m: any): string {
    const seguimientos = m.seguimientos ?? [];
    if (!seguimientos.length) return 'En bodega';
    const ultimo = seguimientos[seguimientos.length - 1]?.estado ?? '';
    return ultimo;
  }

  getEstadoClass(m: any): string {
    const estado = this.getEstado(m).toLowerCase();
    if (estado.includes('bodega'))    return 'bodega';
    if (estado.includes('camino'))    return 'camino';
    if (estado.includes('entrega'))   return 'entregado';
    if (estado.includes('devoluci'))  return 'devuelto';
    return 'bodega';
  }

  getNombreProveedor(id: number, proveedores: any[]): string {
    return proveedores.find(p => p.id === id)?.nombre ?? '—';
  }

  getNombreTipoPago(id: number, tiposPago: any[]): string {
    return tiposPago.find(t => t.id === id)?.nombre ?? '—';
  }

  mercanciasFiltradas(mercancias: any[]): any[] {
    let lista = mercancias.filter(m => {
      const remesa  = (m.numero_remesa ?? '').toLowerCase();
      const origen  = (m.origen_mercancia ?? '').toLowerCase();
      const destino = (m.destino_mercancia ?? '').toLowerCase();
      return (!this.filtroRemesa  || remesa.includes(this.filtroRemesa.toLowerCase()))
          && (!this.filtroOrigen  || origen.includes(this.filtroOrigen.toLowerCase()))
          && (!this.filtroDestino || destino.includes(this.filtroDestino.toLowerCase()));
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
  private resetForm() {
    this.mercanciaForm          = this.getEmptyForm();
    this.editando               = false;
    this.editId                 = null;
    this.productosProveedor     = [];
    this.productosSeleccionados = [];
    this.productoSeleccionado   = null;
  }

  private getEmptyForm() {
    return {
      proveedores_id: '', fecha_ingreso: '', numero_remesa: '',
      origen_mercancia: '', destino_mercancia: '',
      nombre_remitente: '', documento_remitente: '',
      direccion_remitente: '', celular_remitente: '',
      nombre_destinatario: '', documento_destinatario: '',
      direccion_destinatario: '', celular_destinatario: '',
      valor_declarado: '', valor_flete: '', valor_total: '',
      peso: '', unidades: 0, observaciones: '', tipo_pago_id: ''
    };
  }

  private refrescarDatos() { this.refrescar$.next(); this.cerrarModal(); }

  // ── Exportar ───────────────────────────────────────
  exportarExcel(mercancias: any[]) {
    const ws = XLSX.utils.json_to_sheet(mercancias);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mercancías');
    XLSX.writeFile(wb, 'mercancias.xlsx');
  }
  exportarCSV(mercancias: any[]) {
    const ws = XLSX.utils.json_to_sheet(mercancias);
    saveAs(new Blob([XLSX.utils.sheet_to_csv(ws)], { type: 'text/csv;charset=utf-8;' }), 'mercancias.csv');
  }
  exportarWord(mercancias: any[]) {
    const rows = mercancias.map(m =>
      new TableRow({ children: [
        new TableCell({ children: [new Paragraph(m.id.toString())] }),
        new TableCell({ children: [new Paragraph(m.numero_remesa)] }),
        new TableCell({ children: [new Paragraph(m.origen_mercancia)] }),
        new TableCell({ children: [new Paragraph(m.destino_mercancia)] }),
        new TableCell({ children: [new Paragraph(m.peso?.toString() ?? '')] }),
        new TableCell({ children: [new Paragraph(m.unidades?.toString() ?? '')] }),
      ]})
    );
    const doc = new Document({ sections: [{ children: [
      new Paragraph('Reporte de Mercancías — AGATHA'),
      new Table({ rows: [
        new TableRow({ children: [
          new TableCell({ children: [new Paragraph('ID')] }),
          new TableCell({ children: [new Paragraph('Remesa')] }),
          new TableCell({ children: [new Paragraph('Origen')] }),
          new TableCell({ children: [new Paragraph('Destino')] }),
          new TableCell({ children: [new Paragraph('Peso')] }),
          new TableCell({ children: [new Paragraph('Unidades')] }),
        ]}),
        ...rows
      ]})
    ]}]});
    Packer.toBlob(doc).then(blob => saveAs(blob, 'mercancias.docx'));
  }
  async exportarPDF(mercancias: any[]) {
    const pdfMake  = await import('pdfmake/build/pdfmake');
    const pdfFonts = await import('pdfmake/build/vfs_fonts');
    (pdfMake as any).vfs = (pdfFonts as any).vfs;
    (pdfMake as any).createPdf({
      content: [
        { text: 'Reporte de Mercancías — AGATHA', style: 'header' },
        { table: { body: [
          ['ID', 'Remesa', 'Origen', 'Destino', 'Peso', 'Unidades'],
          ...mercancias.map(m => [m.id, m.numero_remesa, m.origen_mercancia, m.destino_mercancia, m.peso, m.unidades])
        ]}}
      ],
      styles: { header: { fontSize: 16, bold: true, margin: [0, 0, 0, 12] } }
    }).download('mercancias.pdf');
  }
}
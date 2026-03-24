import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { BehaviorSubject, switchMap, forkJoin } from 'rxjs';
import { ApiService } from '../services/api.service';
import { NgxPaginationModule } from 'ngx-pagination';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { Document, Packer, Paragraph, Table, TableRow, TableCell } from 'docx';

@Component({
  selector: 'app-seguimientos',
  standalone: true,
  imports: [FormsModule, CommonModule, NgxPaginationModule],
  templateUrl: './seguimientos.component.html',
  styleUrls: ['./seguimientos.component.css']
})
export class SeguimientosComponent implements OnInit {

  // ── Dropdown ───────────────────────────────────────
  dropdownOpen = false;
  toggleDropdown(e: MouseEvent) { e.stopPropagation(); this.dropdownOpen = !this.dropdownOpen; }
  ngOnInit() { document.addEventListener('click', () => { this.dropdownOpen = false; }); }

  // ── Data stream ────────────────────────────────────
  private refrescar$ = new BehaviorSubject<void>(undefined);
  data$ = this.refrescar$.pipe(
    switchMap(() => forkJoin({
      seguimientos: this.api.getSeguimientos(),
      mercancias:   this.api.getMercancias()
    }))
  );

  // ── Estado UI ──────────────────────────────────────
  seguimientoForm: any        = this.getEmptyForm();
  editId: number | null       = null;
  filtroRemesa                = '';
  filtroEstado                = '';
  modalVisible                = false;
  seguimientoConsultado: any  = null;
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
  abrirModal(s: any) {
    this.editId = s.id;
    this.seguimientoForm = {
      mercancias_id: s.mercancias_id ?? s.mercancia?.id ?? '',
      estado:        s.estado_actual ?? s.estado ?? '',
      remesa_label:  s.mercancia?.numero_remesa ?? s.numero_remesa ?? ''
    };
    this.modalVisible = true;
    this.fieldErrors  = {};
  }

  cerrarModal()    { this.modalVisible = false; this.seguimientoForm = this.getEmptyForm(); this.fieldErrors = {}; }
  cerrarConsulta() { this.seguimientoConsultado = null; }

  seleccionarEstado(estado: string) {
    this.seguimientoForm.estado = estado;
    delete this.fieldErrors['estado'];
  }

  // ── Actualizar estado ──────────────────────────────
  guardarSeguimiento() {
    this.fieldErrors = {};

    if (!this.seguimientoForm.estado?.trim())
      this.fieldErrors['estado'] = 'Debes seleccionar un estado.';

    if (Object.keys(this.fieldErrors).length > 0) return;

    if (!this.editId) {
      this.mostrarAlerta('No se puede actualizar: seguimiento sin ID.', 'error');
      return;
    }

    if (!confirm(`¿Actualizar el estado a "${this.seguimientoForm.estado}"?`)) return;

    this.api.actualizarSeguimiento(this.editId, {
      estado: this.seguimientoForm.estado
    }).subscribe({
      next: () => {
        this.refrescar$.next();
        this.cerrarModal();
        this.mostrarAlerta('Estado actualizado con éxito.', 'exito');
      },
      error: (error: any) => {
        if ((error.status === 400 || error.status === 422) && error.error) {
          const errores = error.error as Record<string, string[]>;
          Object.entries(errores).forEach(([campo, msgs]) => {
            this.fieldErrors[campo] = Array.isArray(msgs) ? msgs[0] : msgs as any;
          });
        } else {
          this.mostrarAlerta('Error al actualizar el estado.', 'error');
        }
      }
    });
  }

  // ── Consultar ──────────────────────────────────────
  consultarSeguimiento(id: number) {
    this.api.getSeguimiento(id).subscribe({
      next:  res => this.seguimientoConsultado = res,
      error: ()  => this.mostrarAlerta('Error al consultar el seguimiento.', 'error')
    });
  }

  // ── Lightbox ───────────────────────────────────────
  fotoGrandeUrl: string | null = null;

  // ── Helpers UI ─────────────────────────────────────

  // Clases CSS del badge de estado
  getEstadoClass(estado: string): string {
    const e = (estado ?? '').toLowerCase();
    if (e.includes('bodega'))     return 'estado-bodega';
    if (e.includes('camino'))     return 'estado-camino';
    if (e.includes('entrega'))    return 'estado-entregado';
    if (e.includes('devoluci'))   return 'estado-devuelto';
    return 'estado-bodega';
  }

  // Obtener el estado real — el backend puede devolver estado_actual o estado
  getEstado(s: any): string {
    return s.estado_actual ?? s.estado ?? 'Ingresado a bodega';
  }

  // Clase de cada paso de la barra de progreso
  getProgressClass(estado: string, step: number): string {
    const e    = (estado ?? '').toLowerCase();
    const nivel = e.includes('bodega')   ? 0
                : e.includes('camino')   ? 1
                : e.includes('entrega')  ? 2
                : e.includes('devoluci') ? 3
                : 0;
    if (step <  nivel) return 'done';
    if (step === nivel) return nivel === 3 ? 'error' : 'active';
    return '';
  }

  // Timeline para el modal de detalle
  getTimeline(estado: string): any[] {
    const e     = (estado ?? '').toLowerCase();
    const nivel = e.includes('bodega')   ? 0
                : e.includes('camino')   ? 1
                : e.includes('entrega')  ? 2
                : e.includes('devoluci') ? 3
                : 0;

    const pasos = [
      { titulo: 'Ingresado a bodega',     descripcion: 'Mercancía recibida y registrada en el sistema' },
      { titulo: 'En camino al destino',   descripcion: 'Despachada, en tránsito hacia el destinatario' },
      { titulo: 'Entrega exitosa',        descripcion: 'Mercancía entregada al destinatario' },
      { titulo: 'Devolución exitosa',     descripcion: 'Mercancía devuelta por el destinatario' },
    ];

    return pasos.map((p, i) => {
      let clase = 'pending';
      let lineaClase = '';
      if (i < nivel)  { clase = 'done';   lineaClase = 'done'; }
      if (i === nivel) { clase = nivel === 3 ? 'error' : 'active'; }
      return { ...p, clase, lineaClase };
    });
  }

  seguimientosFiltrados(seguimientos: any[]): any[] {
    let lista = seguimientos.filter(s => {
      const remesa = (s.mercancia?.numero_remesa ?? s.numero_remesa ?? '').toLowerCase();
      const estado = (s.estado_actual ?? s.estado ?? '').toLowerCase();
      return (!this.filtroRemesa || remesa.includes(this.filtroRemesa.toLowerCase()))
          && (!this.filtroEstado || estado.includes(this.filtroEstado.toLowerCase()));
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
  private getEmptyForm() {
    return { mercancias_id: '', estado: '', remesa_label: '' };
  }

  // ── Exportar ───────────────────────────────────────
  exportarExcel(seguimientos: any[]) {
    const ws = XLSX.utils.json_to_sheet(seguimientos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Seguimientos');
    XLSX.writeFile(wb, 'seguimientos.xlsx');
  }
  exportarCSV(seguimientos: any[]) {
    const ws = XLSX.utils.json_to_sheet(seguimientos);
    saveAs(new Blob([XLSX.utils.sheet_to_csv(ws)], { type: 'text/csv;charset=utf-8;' }), 'seguimientos.csv');
  }
  exportarWord(seguimientos: any[]) {
    const rows = seguimientos.map(s =>
      new TableRow({ children: [
        new TableCell({ children: [new Paragraph(s.id.toString())] }),
        new TableCell({ children: [new Paragraph(s.mercancia?.numero_remesa ?? '')] }),
        new TableCell({ children: [new Paragraph(s.estado ?? '')] }),
      ]})
    );
    const doc = new Document({ sections: [{ children: [
      new Paragraph('Reporte de Seguimientos — AGATHA'),
      new Table({ rows: [
        new TableRow({ children: [
          new TableCell({ children: [new Paragraph('ID')] }),
          new TableCell({ children: [new Paragraph('Remesa')] }),
          new TableCell({ children: [new Paragraph('Estado')] }),
        ]}),
        ...rows
      ]})
    ]}]});
    Packer.toBlob(doc).then(blob => saveAs(blob, 'seguimientos.docx'));
  }
  async exportarPDF(seguimientos: any[]) {
    const pdfMake  = await import('pdfmake/build/pdfmake');
    const pdfFonts = await import('pdfmake/build/vfs_fonts');
    (pdfMake as any).vfs = (pdfFonts as any).vfs;
    (pdfMake as any).createPdf({
      content: [
        { text: 'Reporte de Seguimientos — AGATHA', style: 'header' },
        { table: { body: [
          ['ID', 'Remesa', 'Origen', 'Destino', 'Estado'],
          ...seguimientos.map(s => [
            s.id,
            s.mercancia?.numero_remesa ?? '',
            s.mercancia?.origen_mercancia ?? s.mercancia?.origen ?? '',
            s.mercancia?.destino_mercancia ?? s.mercancia?.destino ?? '',
            s.estado ?? ''
          ])
        ]}}
      ],
      styles: { header: { fontSize: 16, bold: true, margin: [0, 0, 0, 12] } }
    }).download('seguimientos.pdf');
  }
}
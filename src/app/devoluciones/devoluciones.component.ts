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
  selector: 'app-devoluciones',
  standalone: true,
  imports: [FormsModule, CommonModule, NgxPaginationModule],
  templateUrl: './devoluciones.component.html',
  styleUrls: ['./devoluciones.component.css']
})
export class DevolucionesComponent implements OnInit {

  // ── Dropdown ───────────────────────────────────────
  dropdownOpen = false;
  toggleDropdown(e: MouseEvent) { e.stopPropagation(); this.dropdownOpen = !this.dropdownOpen; }
  ngOnInit() { document.addEventListener('click', () => { this.dropdownOpen = false; }); }

  // ── Data stream ────────────────────────────────────
  private refrescar$ = new BehaviorSubject<void>(undefined);
  data$ = this.refrescar$.pipe(
    switchMap(() => forkJoin({
      devoluciones: this.api.getDevoluciones(),
      despachos:    this.api.getDespachos(),
    }))
  );

  // ── Estado UI ──────────────────────────────────────
  devolucionForm: any         = this.getEmptyForm();
  editando                    = false;
  editId: number | null       = null;
  filtroRemesa                = '';
  filtroEstado                = '';
  modalVisible                = false;
  devolucionConsultada: any   = null;
  fieldErrors: Record<string, string> = {};

  // ── Foto ───────────────────────────────────────────
  modalFotoVisible              = false;
  devolucionFotoActual: any     = null;
  fotoSeleccionada: File | null = null;
  fotoPreviewLocal: string | null = null;
  subiendoFoto                  = false;
  fotoGrandeUrl: string | null  = null;

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

  // ── Modales CRUD ───────────────────────────────────
  abrirModal(d?: any) {
    if (d) {
      this.editando = true;
      this.editId   = d.id;
      this.devolucionForm = {
        numero_remesa:     d.mercancia?.numero_remesa ?? d.mercancias?.numero_remesa ?? d.numero_remesa ?? '',
        despachos_id:      d.despachos_id ?? '',
        fecha_devolucion:  d.fecha_devolucion ?? '',
        motivo_devolucion: d.motivo_devolucion ?? '',
        estado_devolucion: d.estado_devolucion ?? 'Pendiente',
        observaciones:     d.observaciones ?? ''
      };
    } else {
      this.resetForm();
    }
    this.modalVisible = true;
    this.fieldErrors  = {};
  }

  cerrarModal()    { this.modalVisible = false; this.resetForm(); this.fieldErrors = {}; }
  cerrarConsulta() { this.devolucionConsultada = null; }
  clearError(campo: string) { delete this.fieldErrors[campo]; }

  // ── Guardar ────────────────────────────────────────
  guardarDevolucion() {
    this.fieldErrors = {};

    if (!this.devolucionForm.numero_remesa?.trim())
      this.fieldErrors['numero_remesa'] = 'El número de remesa es obligatorio.';

    if (!this.devolucionForm.despachos_id || this.devolucionForm.despachos_id === '')
      this.fieldErrors['despachos_id'] = 'Debes seleccionar un despacho.';

    if (!this.devolucionForm.fecha_devolucion)
      this.fieldErrors['fecha_devolucion'] = 'La fecha de devolución es obligatoria.';

    if (!this.devolucionForm.motivo_devolucion?.trim())
      this.fieldErrors['motivo_devolucion'] = 'El motivo de devolución es obligatorio.';

    if (Object.keys(this.fieldErrors).length > 0) return;

    if (!confirm(`¿${this.editando ? 'Editar' : 'Registrar'} esta devolución?`)) return;

    const payload = {
      numero_remesa:     this.devolucionForm.numero_remesa?.trim(),
      despachos_id:      Number(this.devolucionForm.despachos_id),
      fecha_devolucion:  this.devolucionForm.fecha_devolucion,
      motivo_devolucion: this.devolucionForm.motivo_devolucion?.trim(),
      estado_devolucion: this.devolucionForm.estado_devolucion,
      observaciones:     this.devolucionForm.observaciones ?? ''
    };

    const request = this.editando && this.editId
      ? this.api.actualizarDevolucion(this.editId, payload)
      : this.api.crearDevolucion(payload);

    request.subscribe({
      next: () => {
        this.refrescarDatos();
        this.mostrarAlerta(`Devolución ${this.editando ? 'actualizada' : 'registrada'} con éxito.`, 'exito');
      },
      error: (error: any) => {
        if ((error.status === 400 || error.status === 422) && error.error) {
          const errores = error.error as Record<string, string[]>;
          Object.entries(errores).forEach(([campo, msgs]) => {
            this.fieldErrors[campo] = Array.isArray(msgs) ? msgs[0] : msgs as any;
          });
          if (this.fieldErrors['numero_remesa'])
            this.fieldErrors['numero_remesa'] = 'La remesa no existe en el sistema.';
          if (this.fieldErrors['despachos_id'])
            this.fieldErrors['despachos_id'] = 'El despacho seleccionado no es válido.';
        } else {
          this.mostrarAlerta('Error inesperado. Intente nuevamente.', 'error');
        }
      }
    });
  }

  // ── Eliminar ───────────────────────────────────────
  eliminarDevolucion(id: number) {
    if (!confirm('¿Eliminar esta devolución? Esta acción no se puede deshacer.')) return;
    this.api.eliminarDevolucion(id).subscribe({
      next:  () => { this.refrescarDatos(); this.mostrarAlerta('Devolución eliminada.', 'exito'); },
      error: () => this.mostrarAlerta('Error al eliminar la devolución.', 'error')
    });
  }

  // ── Consultar ──────────────────────────────────────
  consultarDevolucion(id: number) {
    this.api.getDevolucion(id).subscribe({
      next:  res => this.devolucionConsultada = res,
      error: ()  => this.mostrarAlerta('Error al consultar la devolución.', 'error')
    });
  }

  // ══ GESTIÓN DE FOTOS ═══════════════════════════════

  abrirModalFoto(d: any) {
    this.devolucionFotoActual = { ...d };
    this.fotoSeleccionada     = null;
    this.fotoPreviewLocal     = null;
    this.subiendoFoto         = false;
    this.modalFotoVisible     = true;
  }

  cerrarModalFoto() {
    this.modalFotoVisible     = false;
    this.devolucionFotoActual = null;
    this.fotoSeleccionada     = null;
    this.fotoPreviewLocal     = null;
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) this.procesarArchivo(input.files[0]);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (file && file.type.startsWith('image/')) this.procesarArchivo(file);
  }

  private procesarArchivo(file: File) {
    if (file.size > 5 * 1024 * 1024) { this.mostrarAlerta('La imagen no puede superar 5MB.', 'error'); return; }
    this.fotoSeleccionada = file;
    const reader = new FileReader();
    reader.onload = (e: any) => { this.fotoPreviewLocal = e.target.result; };
    reader.readAsDataURL(file);
  }

  cancelarFoto() { this.fotoSeleccionada = null; this.fotoPreviewLocal = null; }

  subirFoto() {
    if (!this.fotoSeleccionada || !this.devolucionFotoActual?.id) return;
    this.subiendoFoto = true;
    this.api.subirFoto('devoluciones', this.devolucionFotoActual.id, this.fotoSeleccionada).subscribe({
      next: (res: any) => {
        this.subiendoFoto = false;
        this.devolucionFotoActual.foto_url = res.foto_url ?? res.url ?? this.fotoPreviewLocal;
        this.fotoPreviewLocal  = null;
        this.fotoSeleccionada  = null;
        this.refrescar$.next();
        this.mostrarAlerta('Evidencia guardada con éxito.', 'exito');
      },
      error: () => { this.subiendoFoto = false; this.mostrarAlerta('Error al subir la foto.', 'error'); }
    });
  }

  eliminarFoto() {
    if (!this.devolucionFotoActual?.id) return;
    if (!confirm('¿Eliminar la evidencia fotográfica de esta devolución?')) return;
    this.api.eliminarFoto('devoluciones', this.devolucionFotoActual.id).subscribe({
      next: () => { this.devolucionFotoActual.foto_url = null; this.refrescar$.next(); this.mostrarAlerta('Evidencia eliminada.', 'exito'); },
      error: () => this.mostrarAlerta('Error al eliminar la foto.', 'error')
    });
  }

  verFotoGrande(url: string) { this.fotoGrandeUrl = url; }
  cerrarFotoGrande()          { this.fotoGrandeUrl = null; }

  // ── Helpers UI ─────────────────────────────────────
  getEstadoClass(estado: string): string {
    const e = (estado ?? '').toLowerCase();
    if (e.includes('exitosa') || e.includes('aprobada')) return 'estado-aprobada';
    if (e.includes('rechazada'))  return 'estado-rechazada';
    if (e.includes('proceso'))    return 'estado-proceso';
    return 'estado-pendiente';
  }

  devolucionesFiltradas(devoluciones: any[]): any[] {
    let lista = devoluciones.filter(d => {
      const remesa = (d.mercancia?.numero_remesa ?? d.mercancias?.numero_remesa ?? d.numero_remesa ?? '').toLowerCase();
      const estado = (d.estado_devolucion ?? '').toLowerCase();
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
  private resetForm() { this.devolucionForm = this.getEmptyForm(); this.editando = false; this.editId = null; }
  private getEmptyForm() {
    return { numero_remesa: '', despachos_id: '', fecha_devolucion: '', motivo_devolucion: '', estado_devolucion: 'Pendiente', observaciones: '' };
  }
  private refrescarDatos() { this.refrescar$.next(); this.cerrarModal(); }

  // ── Exportar ───────────────────────────────────────
  exportarExcel(devoluciones: any[]) {
    const ws = XLSX.utils.json_to_sheet(devoluciones);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Devoluciones');
    XLSX.writeFile(wb, 'devoluciones.xlsx');
  }
  exportarCSV(devoluciones: any[]) {
    const ws = XLSX.utils.json_to_sheet(devoluciones);
    saveAs(new Blob([XLSX.utils.sheet_to_csv(ws)], { type: 'text/csv;charset=utf-8;' }), 'devoluciones.csv');
  }
  exportarWord(devoluciones: any[]) {
    const rows = devoluciones.map(d =>
      new TableRow({ children: [
        new TableCell({ children: [new Paragraph(d.id.toString())] }),
        new TableCell({ children: [new Paragraph(d.mercancia?.numero_remesa ?? d.numero_remesa ?? '')] }),
        new TableCell({ children: [new Paragraph(d.motivo_devolucion ?? '')] }),
        new TableCell({ children: [new Paragraph(d.estado_devolucion ?? '')] }),
      ]})
    );
    const doc = new Document({ sections: [{ children: [
      new Paragraph('Reporte de Devoluciones — AGATHA'),
      new Table({ rows: [
        new TableRow({ children: [
          new TableCell({ children: [new Paragraph('ID')] }),
          new TableCell({ children: [new Paragraph('Remesa')] }),
          new TableCell({ children: [new Paragraph('Motivo')] }),
          new TableCell({ children: [new Paragraph('Estado')] }),
        ]}),
        ...rows
      ]})
    ]}]});
    Packer.toBlob(doc).then(blob => saveAs(blob, 'devoluciones.docx'));
  }
  async exportarPDF(devoluciones: any[]) {
    const pdfMake  = await import('pdfmake/build/pdfmake');
    const pdfFonts = await import('pdfmake/build/vfs_fonts');
    (pdfMake as any).vfs = (pdfFonts as any).vfs;
    (pdfMake as any).createPdf({
      content: [
        { text: 'Reporte de Devoluciones — AGATHA', style: 'header' },
        { table: { body: [
          ['ID', 'Remesa', 'Motivo', 'Estado', 'Fecha'],
          ...devoluciones.map(d => [
            d.id,
            d.mercancia?.numero_remesa ?? d.numero_remesa ?? '',
            d.motivo_devolucion ?? '',
            d.estado_devolucion ?? '',
            d.fecha_devolucion ?? ''
          ])
        ]}}
      ],
      styles: { header: { fontSize: 16, bold: true, margin: [0, 0, 0, 12] } }
    }).download('devoluciones.pdf');
  }
}
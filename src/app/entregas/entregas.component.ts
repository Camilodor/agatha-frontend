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
  selector: 'app-entregas',
  standalone: true,
  imports: [FormsModule, CommonModule, NgxPaginationModule],
  templateUrl: './entregas.component.html',
  styleUrls: ['./entregas.component.css']
})
export class EntregasComponent implements OnInit {

  // ── Dropdown ───────────────────────────────────────
  dropdownOpen = false;
  toggleDropdown(e: MouseEvent) { e.stopPropagation(); this.dropdownOpen = !this.dropdownOpen; }
  ngOnInit() { document.addEventListener('click', () => { this.dropdownOpen = false; }); }

  // ── Data stream ────────────────────────────────────
  private refrescar$ = new BehaviorSubject<void>(undefined);
  data$ = this.refrescar$.pipe(
    switchMap(() => forkJoin({
      entregas:   this.api.getEntregas(),
      despachos:  this.api.getDespachos(),
    }))
  );

  // ── Estado UI ──────────────────────────────────────
  entregaForm: any        = this.getEmptyForm();
  editando                = false;
  editId: number | null   = null;
  filtroRemesa            = '';
  filtroEstado            = '';
  modalVisible            = false;
  entregaConsultada: any  = null;
  fieldErrors: Record<string, string> = {};

  // ── Foto ───────────────────────────────────────────
  modalFotoVisible          = false;
  entregaFotoActual: any    = null;
  fotoSeleccionada: File | null = null;
  fotoPreviewLocal: string | null = null;
  subiendoFoto              = false;
  fotoGrandeUrl: string | null = null;

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
  abrirModal(e?: any) {
    if (e) {
      this.editando = true;
      this.editId   = e.id;
      this.entregaForm = {
        numero_remesa:        e.mercancia?.numero_remesa ?? e.mercancias?.numero_remesa ?? e.numero_remesa ?? '',
        despachos_id:         e.despachos_id ?? '',
        nombre_recibe:        e.nombre_recibe ?? '',
        numero_celular_recibe: e.numero_celular_recibe ?? '',
        fecha_entrega:        e.fecha_entrega ?? '',
        estado_entrega:       e.estado_entrega ?? 'Entrega exitosa',
        observaciones:        e.observaciones ?? ''
      };
    } else {
      this.resetForm();
    }
    this.modalVisible = true;
    this.fieldErrors  = {};
  }

  cerrarModal()    { this.modalVisible = false; this.resetForm(); this.fieldErrors = {}; }
  cerrarConsulta() { this.entregaConsultada = null; }
  clearError(campo: string) { delete this.fieldErrors[campo]; }

  // ── Guardar ────────────────────────────────────────
  guardarEntrega() {
    this.fieldErrors = {};

    if (!this.entregaForm.numero_remesa?.trim())
      this.fieldErrors['numero_remesa'] = 'El número de remesa es obligatorio.';

    if (!this.entregaForm.despachos_id || this.entregaForm.despachos_id === '')
      this.fieldErrors['despachos_id'] = 'Debes seleccionar un despacho.';

    if (!this.entregaForm.nombre_recibe?.trim())
      this.fieldErrors['nombre_recibe'] = 'El nombre de quien recibe es obligatorio.';

    if (!this.entregaForm.numero_celular_recibe?.trim())
      this.fieldErrors['numero_celular_recibe'] = 'El celular es obligatorio.';

    if (!this.entregaForm.fecha_entrega)
      this.fieldErrors['fecha_entrega'] = 'La fecha de entrega es obligatoria.';

    if (Object.keys(this.fieldErrors).length > 0) return;

    if (!confirm(`¿${this.editando ? 'Editar' : 'Registrar'} esta entrega?`)) return;

    const payload = {
      numero_remesa:          this.entregaForm.numero_remesa?.trim(),
      despachos_id:           Number(this.entregaForm.despachos_id),
      nombre_recibe:          this.entregaForm.nombre_recibe?.trim(),
      numero_celular_recibe:  this.entregaForm.numero_celular_recibe?.trim(),
      fecha_entrega:          this.entregaForm.fecha_entrega,
      estado_entrega:         this.entregaForm.estado_entrega,
      observaciones:          this.entregaForm.observaciones ?? ''
    };

    const request = this.editando && this.editId
      ? this.api.actualizarEntrega(this.editId, payload)
      : this.api.crearEntrega(payload);

    request.subscribe({
      next: () => {
        this.refrescarDatos();
        this.mostrarAlerta(`Entrega ${this.editando ? 'actualizada' : 'registrada'} con éxito.`, 'exito');
      },
      error: (error: any) => {
        // El backend devuelve 400 con los errores de validación (no 422)
        if ((error.status === 400 || error.status === 422) && error.error) {
          const errores = error.error as Record<string, string[]>;
          Object.entries(errores).forEach(([campo, msgs]) => {
            this.fieldErrors[campo] = Array.isArray(msgs) ? msgs[0] : msgs as any;
          });
          // Mensajes amigables por campo
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
  eliminarEntrega(id: number) {
    if (!confirm('¿Eliminar esta entrega? Esta acción no se puede deshacer.')) return;
    this.api.eliminarEntrega(id).subscribe({
      next:  () => { this.refrescarDatos(); this.mostrarAlerta('Entrega eliminada.', 'exito'); },
      error: () => this.mostrarAlerta('Error al eliminar la entrega.', 'error')
    });
  }

  // ── Consultar ──────────────────────────────────────
  consultarEntrega(id: number) {
    this.api.getEntrega(id).subscribe({
      next:  res => this.entregaConsultada = res,
      error: ()  => this.mostrarAlerta('Error al consultar la entrega.', 'error')
    });
  }

  // ══ GESTIÓN DE FOTOS ═══════════════════════════════

  abrirModalFoto(e: any) {
    this.entregaFotoActual = { ...e };
    this.fotoSeleccionada  = null;
    this.fotoPreviewLocal  = null;
    this.subiendoFoto      = false;
    this.modalFotoVisible  = true;
  }

  cerrarModalFoto() {
    this.modalFotoVisible  = false;
    this.entregaFotoActual = null;
    this.fotoSeleccionada  = null;
    this.fotoPreviewLocal  = null;
  }

  // Selección de archivo desde input
  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.procesarArchivo(input.files[0]);
    }
  }

  // Drag & drop
  onDrop(event: DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (file && file.type.startsWith('image/')) {
      this.procesarArchivo(file);
    }
  }

  private procesarArchivo(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      this.mostrarAlerta('La imagen no puede superar 5MB.', 'error');
      return;
    }
    this.fotoSeleccionada = file;
    const reader = new FileReader();
    reader.onload = (e: any) => { this.fotoPreviewLocal = e.target.result; };
    reader.readAsDataURL(file);
  }

  cancelarFoto() {
    this.fotoSeleccionada = null;
    this.fotoPreviewLocal = null;
  }

  // Subir foto al backend
  subirFoto() {
    if (!this.fotoSeleccionada || !this.entregaFotoActual?.id) return;
    this.subiendoFoto = true;

    this.api.subirFoto('entregas', this.entregaFotoActual.id, this.fotoSeleccionada).subscribe({
      next: (res: any) => {
        this.subiendoFoto = false;
        // Actualizar la URL en el objeto actual y en la lista
        this.entregaFotoActual.foto_url = res.foto_url ?? res.url ?? this.fotoPreviewLocal;
        this.fotoPreviewLocal  = null;
        this.fotoSeleccionada  = null;
        this.refrescar$.next(); // refrescar lista sin cerrar modal
        this.mostrarAlerta('Evidencia guardada con éxito.', 'exito');
      },
      error: () => {
        this.subiendoFoto = false;
        this.mostrarAlerta('Error al subir la foto. Intente nuevamente.', 'error');
      }
    });
  }

  // Eliminar foto
  eliminarFoto() {
    if (!this.entregaFotoActual?.id) return;
    if (!confirm('¿Eliminar la evidencia fotográfica de esta entrega?')) return;

    this.api.eliminarFoto('entregas', this.entregaFotoActual.id).subscribe({
      next: () => {
        this.entregaFotoActual.foto_url = null;
        this.refrescar$.next();
        this.mostrarAlerta('Evidencia eliminada.', 'exito');
      },
      error: () => this.mostrarAlerta('Error al eliminar la foto.', 'error')
    });
  }

  // Ver foto grande (lightbox)
  verFotoGrande(url: string) { this.fotoGrandeUrl = url; }
  cerrarFotoGrande()         { this.fotoGrandeUrl = null; }

  // ── Helpers UI ─────────────────────────────────────
  getEstadoClass(estado: string): string {
    const e = (estado ?? '').toLowerCase();
    if (e.includes('exitosa'))  return 'estado-exitosa';
    if (e.includes('parcial'))  return 'estado-parcial';
    if (e.includes('devuelta') || e.includes('devolucion')) return 'estado-devuelta';
    return 'estado-pendiente';
  }

  entregasFiltradas(entregas: any[]): any[] {
    let lista = entregas.filter(e => {
      const remesa = (e.mercancia?.numero_remesa ?? e.mercancias?.numero_remesa ?? e.numero_remesa ?? '').toLowerCase();
      const estado = (e.estado_entrega ?? '').toLowerCase();
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
  private resetForm() { this.entregaForm = this.getEmptyForm(); this.editando = false; this.editId = null; }
  private getEmptyForm() {
    return { numero_remesa: '', despachos_id: '', nombre_recibe: '', numero_celular_recibe: '', fecha_entrega: '', estado_entrega: 'Entrega exitosa', observaciones: '' };
  }
  private refrescarDatos() { this.refrescar$.next(); this.cerrarModal(); }

  // ── Exportar ───────────────────────────────────────
  exportarExcel(entregas: any[]) {
    const ws = XLSX.utils.json_to_sheet(entregas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Entregas');
    XLSX.writeFile(wb, 'entregas.xlsx');
  }
  exportarCSV(entregas: any[]) {
    const ws = XLSX.utils.json_to_sheet(entregas);
    saveAs(new Blob([XLSX.utils.sheet_to_csv(ws)], { type: 'text/csv;charset=utf-8;' }), 'entregas.csv');
  }
  exportarWord(entregas: any[]) {
    const rows = entregas.map(e =>
      new TableRow({ children: [
        new TableCell({ children: [new Paragraph(e.id.toString())] }),
        new TableCell({ children: [new Paragraph(e.mercancia?.numero_remesa ?? e.numero_remesa ?? '')] }),
        new TableCell({ children: [new Paragraph(e.nombre_recibe ?? '')] }),
        new TableCell({ children: [new Paragraph(e.estado_entrega ?? '')] }),
      ]})
    );
    const doc = new Document({ sections: [{ children: [
      new Paragraph('Reporte de Entregas — AGATHA'),
      new Table({ rows: [
        new TableRow({ children: [
          new TableCell({ children: [new Paragraph('ID')] }),
          new TableCell({ children: [new Paragraph('Remesa')] }),
          new TableCell({ children: [new Paragraph('Recibe')] }),
          new TableCell({ children: [new Paragraph('Estado')] }),
        ]}),
        ...rows
      ]})
    ]}]});
    Packer.toBlob(doc).then(blob => saveAs(blob, 'entregas.docx'));
  }
  async exportarPDF(entregas: any[]) {
    const pdfMake  = await import('pdfmake/build/pdfmake');
    const pdfFonts = await import('pdfmake/build/vfs_fonts');
    (pdfMake as any).vfs = (pdfFonts as any).vfs;
    (pdfMake as any).createPdf({
      content: [
        { text: 'Reporte de Entregas — AGATHA', style: 'header' },
        { table: { body: [
          ['ID', 'Remesa', 'Recibe', 'Celular', 'Estado', 'Fecha'],
          ...entregas.map(e => [
            e.id,
            e.mercancia?.numero_remesa ?? e.numero_remesa ?? '',
            e.nombre_recibe ?? '',
            e.numero_celular_recibe ?? '',
            e.estado_entrega ?? '',
            e.fecha_entrega ?? ''
          ])
        ]}}
      ],
      styles: { header: { fontSize: 16, bold: true, margin: [0, 0, 0, 12] } }
    }).download('entregas.pdf');
  }
}
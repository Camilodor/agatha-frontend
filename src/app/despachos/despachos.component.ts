import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { forkJoin, BehaviorSubject, switchMap } from 'rxjs';
import { ApiService } from '../services/api.service';
import { NgxPaginationModule } from 'ngx-pagination';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel, BorderStyle } from 'docx';

@Component({
  selector: 'app-despachos',
  standalone: true,
  imports: [FormsModule, CommonModule, NgxPaginationModule],
  templateUrl: './despachos.component.html',
  styleUrls: ['./despachos.component.css']
})
export class DespachosComponent implements OnInit {

  // ── Dropdown ───────────────────────────────────────
  dropdownOpen = false;
  toggleDropdown(e: MouseEvent) { e.stopPropagation(); this.dropdownOpen = !this.dropdownOpen; }
  ngOnInit() { document.addEventListener('click', () => { this.dropdownOpen = false; }); }

  // ── Data stream ────────────────────────────────────
  private refrescar$ = new BehaviorSubject<void>(undefined);
  data$ = this.refrescar$.pipe(
    switchMap(() => forkJoin({
      pagos:      this.api.getTiposPago(),
      despachos:  this.api.getDespachos(),
      mercancias: this.api.getMercancias()
    }))
  );

  // ── Estado UI ──────────────────────────────────────
  despachoForm: any         = this.getEmptyForm();
  editando                  = false;
  editId: number | null     = null;
  filtroRemesa              = '';
  filtroPlaca               = '';
  filtroRemesaModal         = '';
  modalVisible              = false;
  despachoConsultado: any   = null;
  despachoQR: any           = null;
  mercanciasSeleccionadas: any[] = [];
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

  // ── Saldo calculado en tiempo real ─────────────────
  get saldoCalculado(): number {
    const neg = Number(this.despachoForm.negociacion) || 0;
    const ant = Number(this.despachoForm.anticipo)    || 0;
    return neg - ant;
  }

  // ── Total flete de mercancías seleccionadas ────────
  get totalFlete(): number {
    return this.mercanciasSeleccionadas.reduce((sum, m) => sum + Number(m.valor_flete || 0), 0);
  }

  // ── Modales ────────────────────────────────────────
  abrirModal(d?: any) {
    if (d) {
      this.editando = true;
      this.editId   = d.id;
      this.despachoForm = {
        numero_placas:    d.vehiculo?.numero_placas ?? d.vehiculos?.numero_placas ?? '',
        tipo_pago_id:     d.tipopago?.id ?? '',
        fecha_despacho:   d.fecha_despacho ?? '',
        negociacion:      d.pago?.negociacion ?? d.negociacion ?? '',
        anticipo:         d.pago?.anticipo    ?? d.anticipo    ?? '',
        observaciones_mer: d.observaciones    ?? d.observaciones_mer ?? ''
      };
      // Reconstruir mercancías seleccionadas
      this.mercanciasSeleccionadas = (d.mercancias ?? []).map((m: any) => ({ ...m }));
    } else {
      this.resetForm();
    }
    this.modalVisible     = true;
    this.filtroRemesaModal = '';
    this.fieldErrors       = {};
  }

  cerrarModal()    { this.modalVisible = false; this.resetForm(); this.fieldErrors = {}; }
  cerrarConsulta() { this.despachoConsultado = null; }
  cerrarQR()       { this.despachoQR = null; }
  clearError(campo: string) { delete this.fieldErrors[campo]; }

  // ── Ver QR ─────────────────────────────────────────
  verQR(d: any) { this.despachoQR = d; }

  // ── Mercancías disponibles filtradas ───────────────
  getMercanciasDisponibles(mercancias: any[]): any[] {
    const filtro = this.filtroRemesaModal.toLowerCase();
    return mercancias.filter(m => {
      const remesa  = (m.numero_remesa ?? '').toLowerCase();
      const origen  = (m.origen_mercancia ?? '').toLowerCase();
      const destino = (m.destino_mercancia ?? '').toLowerCase();
      return !filtro || remesa.includes(filtro) || origen.includes(filtro) || destino.includes(filtro);
    });
  }

  estaAgregada(id: number): boolean {
    return this.mercanciasSeleccionadas.some(m => m.id === id);
  }

  agregarMercancia(m: any) {
    if (!this.estaAgregada(m.id)) {
      this.mercanciasSeleccionadas.push({ ...m });
      delete this.fieldErrors['mercancias'];
    }
  }

  quitarMercancia(id: number) {
    this.mercanciasSeleccionadas = this.mercanciasSeleccionadas.filter(m => m.id !== id);
  }

  // ── Guardar ────────────────────────────────────────
  guardarDespacho() {
    this.fieldErrors = {};

    if (!this.despachoForm.numero_placas?.trim())
      this.fieldErrors['numero_placas'] = 'La placa del vehículo es obligatoria.';

    if (!this.despachoForm.fecha_despacho)
      this.fieldErrors['fecha_despacho'] = 'La fecha de despacho es obligatoria.';

    if (!this.despachoForm.tipo_pago_id)
      this.fieldErrors['tipo_pago_id'] = 'Selecciona el tipo de pago.';

    if (this.mercanciasSeleccionadas.length === 0)
      this.fieldErrors['mercancias'] = 'Debes agregar al menos una mercancía a la planilla.';

    if (!this.despachoForm.negociacion || Number(this.despachoForm.negociacion) <= 0)
      this.fieldErrors['negociacion'] = 'La negociación es obligatoria y debe ser mayor a 0.';

    if (this.despachoForm.anticipo === '' || this.despachoForm.anticipo === null || this.despachoForm.anticipo === undefined)
      this.fieldErrors['anticipo'] = 'El anticipo es obligatorio (puede ser 0).';

    if (Number(this.despachoForm.anticipo) > Number(this.despachoForm.negociacion))
      this.fieldErrors['anticipo'] = 'El anticipo no puede ser mayor que la negociación.';

    if (Object.keys(this.fieldErrors).length > 0) return;

    if (!confirm(`¿${this.editando ? 'Editar' : 'Crear'} esta planilla de despacho?`)) return;

    const payload = {
      numero_placas:    this.despachoForm.numero_placas,
      tipo_pago_id:     this.despachoForm.tipo_pago_id,
      fecha_despacho:   this.despachoForm.fecha_despacho,
      negociacion:      Number(this.despachoForm.negociacion),
      anticipo:         Number(this.despachoForm.anticipo),
      observaciones_mer: this.despachoForm.observaciones_mer,
      // El backend espera array de números de remesa
      remesas: this.mercanciasSeleccionadas.map(m => m.numero_remesa)
    };

    const request = this.editando && this.editId
      ? this.api.actualizarDespacho(this.editId, payload)
      : this.api.crearDespacho(payload);

    request.subscribe({
      next: (res: any) => {
        this.refrescarDatos();
        const msg = this.editando ? 'Planilla actualizada' : 'Planilla creada';
        this.mostrarAlerta(`${msg} con éxito. QR generado automáticamente.`, 'exito');
      },
      error: (error: any) => {
        if (error.status === 422 && error.error?.errors) {
          const errores = error.error.errors as Record<string, string[]>;
          Object.entries(errores).forEach(([campo, msgs]) => {
            this.fieldErrors[campo] = msgs[0];
          });
        } else if (error.status === 422) {
          this.fieldErrors['numero_placas'] = 'No existe un vehículo con esa placa.';
        } else {
          this.mostrarAlerta('Error inesperado. Intente nuevamente.', 'error');
        }
      }
    });
  }

  // ── Eliminar ───────────────────────────────────────
  eliminarDespacho(id: number) {
    if (!confirm('¿Eliminar esta planilla? Esta acción no se puede deshacer.')) return;
    this.api.eliminarDespacho(id).subscribe({
      next:  () => { this.refrescarDatos(); this.mostrarAlerta('Planilla eliminada.', 'exito'); },
      error: () => this.mostrarAlerta('Error al eliminar la planilla.', 'error')
    });
  }

  // ── Consultar ──────────────────────────────────────
  consultarDespacho(id: number) {
    this.api.getDespacho(id).subscribe({
      next:  res => this.despachoConsultado = res,
      error: ()  => this.mostrarAlerta('Error al consultar la planilla.', 'error')
    });
  }

  // ── Imprimir planilla PDF ──────────────────────────
  async imprimirPlanilla(dInput: any) {
    // Siempre consultar el despacho completo — trae qr_base64 y todas las relaciones
    const d = await this.api.getDespacho(dInput.id ?? dInput.numero_planilla).toPromise();

    const pdfMake  = await import('pdfmake/build/pdfmake');
    const pdfFonts = await import('pdfmake/build/vfs_fonts');
    (pdfMake as any).vfs = (pdfFonts as any).vfs;

    const conductor  = d.conductor ?? {};
    const vehiculo   = d.vehiculo  ?? d.vehiculos ?? {};
    const mercancias = d.mercancias ?? [];
    const pago       = d.pago       ?? {};
    const neg  = pago.negociacion ?? d.negociacion ?? 0;
    const ant  = pago.anticipo    ?? d.anticipo    ?? 0;
    const sal  = pago.saldo       ?? d.saldo       ?? (neg - ant);
    const fmt  = (v: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);

    // QR llega como base64 desde el backend — sin CORS
    let qrBase64: string | null = d.qr_base64 ?? null;

    // Si el backend devolvió SVG base64, convertir a PNG para pdfmake
    if (qrBase64 && qrBase64.startsWith('data:image/svg+xml')) {
      try {
        qrBase64 = await this.svgBase64ToPngBase64(qrBase64, 200);
      } catch (e) {
        qrBase64 = null;
      }
    }

    // Filas de mercancías — el backend devuelve origen/destino flat y destinatario anidado
    const filasMercancias = mercancias.length > 0
      ? mercancias.map((m: any) => [
          { text: m.numero_remesa                          ?? '—', style: 'tableCell' },
          { text: m.origen   ?? m.origen_mercancia         ?? '—', style: 'tableCell' },
          { text: m.destino  ?? m.destino_mercancia        ?? '—', style: 'tableCell' },
          { text: m.destinatario?.nombre ?? m.nombre_destinatario  ?? '—', style: 'tableCell' },
          { text: m.destinatario?.celular ?? m.celular_destinatario ?? '—', style: 'tableCell' },
          { text: `${m.unidades ?? 0} uds`,  style: 'tableCell', alignment: 'center' },
          { text: fmt(Number(m.valor_flete ?? 0)), style: 'tableCell', alignment: 'right' },
        ])
      : [[{ text: 'Sin mercancías registradas', colSpan: 7, style: 'tableCell', alignment: 'center' }]];

    const docDefinition: any = {
      pageMargins: [40, 60, 40, 60],
      content: [

        // ── Encabezado ──
        {
          columns: [
            {
              stack: [
                { text: 'AGATHA', style: 'company' },
                { text: 'LOGISTICS & TRANSPORT', style: 'companyTag' },
                { text: 'NIT: 900.000.000-0', style: 'companyInfo' },
              ],
              width: '*'
            },
            {
              stack: [
                { text: 'PLANILLA DE DESPACHO', style: 'docTitle' },
                { text: `N° ${d.numero_planilla ?? d.id}`, style: 'docNum' },
                { text: `Fecha: ${d.fecha_despacho}`, style: 'docInfo' },
              ],
              width: 'auto',
              alignment: 'right'
            }
          ],
          margin: [0, 0, 0, 16]
        },

        // Línea separadora
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: '#1a2b4a' }], margin: [0, 0, 0, 16] },

        // ── Vehículo y conductor ──
        {
          columns: [
            {
              stack: [
                { text: 'VEHÍCULO', style: 'sectionLabel' },
                { text: vehiculo.numero_placas ?? '—',  style: 'bigValue' },
                { text: `${vehiculo.nombre_marca_vehiculo ?? ''} ${vehiculo.numero_modelo_anio ?? ''}`, style: 'subValue' },
                { text: `Color: ${vehiculo.color_vehiculo ?? '—'}`, style: 'subValue' },
              ],
              width: '33%'
            },
            {
              stack: [
                { text: 'CONDUCTOR', style: 'sectionLabel' },
                { text: conductor.nombre_completo ?? '—', style: 'bigValue' },
                { text: `CC: ${conductor.numero_documento ?? '—'}`, style: 'subValue' },
                { text: `Cel: ${conductor.celular ?? '—'}`,         style: 'subValue' },
              ],
              width: '34%'
            },
            {
              stack: [
                { text: 'PAGO AL CONDUCTOR', style: 'sectionLabel' },
                {
                  table: {
                    widths: ['*', 'auto'],
                    body: [
                      [{ text: 'Negociación', style: 'payLabel' }, { text: fmt(neg), style: 'payVal' }],
                      [{ text: 'Anticipo',    style: 'payLabel' }, { text: fmt(ant), style: 'payVal' }],
                      [
                        { text: 'Saldo',     style: 'payLabelBold' },
                        { text: fmt(sal),    style: 'payValBold' }
                      ],
                    ]
                  },
                  layout: 'noBorders'
                }
              ],
              width: '33%'
            }
          ],
          margin: [0, 0, 0, 16]
        },

        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#e2e6ed' }], margin: [0, 0, 0, 12] },

        // ── Tabla de mercancías ──
        { text: 'MERCANCÍAS DESPACHADAS', style: 'sectionLabel', margin: [0, 0, 0, 6] },
        {
          table: {
            headerRows: 1,
            widths: ['auto', '*', '*', '*', 'auto', 'auto', 'auto'],
            body: [
              [
                { text: 'REMESA',       style: 'tableHeader' },
                { text: 'ORIGEN',       style: 'tableHeader' },
                { text: 'DESTINO',      style: 'tableHeader' },
                { text: 'DESTINATARIO', style: 'tableHeader' },
                { text: 'CELULAR',      style: 'tableHeader' },
                { text: 'UUDS',         style: 'tableHeader', alignment: 'center' },
                { text: 'FLETE',        style: 'tableHeader', alignment: 'right' },
              ],
              ...filasMercancias
            ]
          },
          layout: {
            hLineWidth: (i: number) => i === 0 || i === 1 ? 1 : 0.5,
            vLineWidth: () => 0,
            hLineColor: (i: number) => i === 0 || i === 1 ? '#1a2b4a' : '#e2e6ed',
            fillColor: (rowIndex: number) => rowIndex === 0 ? '#1a2b4a' : (rowIndex % 2 === 0 ? '#f8f9fb' : null),
          },
          margin: [0, 0, 0, 16]
        },

        // ── QR + observaciones ──
        {
          columns: [
            {
              stack: [
                { text: 'OBSERVACIONES', style: 'sectionLabel' },
                { text: d.observaciones ?? d.observaciones_mer ?? 'Sin observaciones.', style: 'subValue' }
              ],
              width: '*'
            },
            qrBase64 ? {
              stack: [
                { text: 'QR DE ENTREGA', style: 'sectionLabel', alignment: 'center' },
                { image: qrBase64, width: 90, alignment: 'center' },
                { text: 'Escanea para datos de entrega', style: 'qrHint', alignment: 'center' }
              ],
              width: 'auto'
            } : {
              stack: [
                { text: 'QR DE ENTREGA', style: 'sectionLabel', alignment: 'center' },
                { text: 'QR no disponible', style: 'qrHint', alignment: 'center' }
              ],
              width: 'auto'
            }
          ],
          margin: [0, 0, 0, 24]
        },

        // ── Firma ──
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#e2e6ed' }], margin: [0, 0, 0, 16] },
        {
          columns: [
            { stack: [{ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 150, y2: 0, lineWidth: 1, lineColor: '#1a2b4a' }] }, { text: 'Firma conductor', style: 'firmLabel' }], alignment: 'center' },
            { stack: [{ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 150, y2: 0, lineWidth: 1, lineColor: '#1a2b4a' }] }, { text: 'Firma despachador', style: 'firmLabel' }], alignment: 'center' },
            { stack: [{ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 150, y2: 0, lineWidth: 1, lineColor: '#1a2b4a' }] }, { text: 'Sello empresa', style: 'firmLabel' }], alignment: 'center' },
          ]
        }

      ],

      styles: {
        company:       { fontSize: 18, bold: true, color: '#1a2b4a', letterSpacing: 3 },
        companyTag:    { fontSize: 7,  color: '#c9a84c', letterSpacing: 2, margin: [0, 1, 0, 1] },
        companyInfo:   { fontSize: 8,  color: '#8a95a3' },
        docTitle:      { fontSize: 13, bold: true, color: '#1a2b4a', letterSpacing: 1 },
        docNum:        { fontSize: 18, bold: true, color: '#c9a84c', fontFamily: 'Courier' },
        docInfo:       { fontSize: 8,  color: '#8a95a3' },
        sectionLabel:  { fontSize: 7,  bold: true, color: '#8a95a3', letterSpacing: 1.5, margin: [0, 0, 0, 3] },
        bigValue:      { fontSize: 11, bold: true, color: '#1a2b4a' },
        subValue:      { fontSize: 8,  color: '#8a95a3', margin: [0, 1, 0, 0] },
        payLabel:      { fontSize: 8,  color: '#8a95a3' },
        payVal:        { fontSize: 8,  color: '#1a2b4a', bold: true, alignment: 'right' },
        payLabelBold:  { fontSize: 9,  color: '#1a2b4a', bold: true },
        payValBold:    { fontSize: 9,  color: '#c9a84c', bold: true, alignment: 'right' },
        tableHeader:   { fontSize: 7,  bold: true, color: '#ffffff', margin: [3, 4, 3, 4] },
        tableCell:     { fontSize: 8,  color: '#1a2b4a', margin: [3, 3, 3, 3] },
        qrHint:        { fontSize: 7,  color: '#8a95a3', margin: [0, 2, 0, 0] },
        firmLabel:     { fontSize: 7,  color: '#8a95a3', margin: [0, 3, 0, 0], alignment: 'center' },
      },

      defaultStyle: { font: 'Roboto', fontSize: 8 }
    };

    (pdfMake as any).createPdf(docDefinition).download(`planilla_${d.numero_planilla ?? d.id}.pdf`);
  }

  // ── Helpers UI ─────────────────────────────────────
  despachosFiltrados(despachos: any[]): any[] {
    let lista = despachos.filter(d => {
      const remesas = (d.mercancias ?? []).map((m: any) => (m.numero_remesa ?? '').toLowerCase()).join(' ');
      const placa   = (d.vehiculo?.numero_placas ?? d.vehiculos?.numero_placas ?? '').toLowerCase();
      return (!this.filtroRemesa || remesas.includes(this.filtroRemesa.toLowerCase()))
          && (!this.filtroPlaca  || placa.includes(this.filtroPlaca.toLowerCase()));
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
    setTimeout(() => this.alertaVisible = false, 5000);
  }
  cerrarAlerta() { this.alertaVisible = false; }

  // ── Privados ───────────────────────────────────────
  private resetForm() {
    this.despachoForm          = this.getEmptyForm();
    this.editando              = false;
    this.editId                = null;
    this.mercanciasSeleccionadas = [];
    this.filtroRemesaModal     = '';
  }
  private getEmptyForm() {
    return { numero_placas: '', tipo_pago_id: '', fecha_despacho: '', negociacion: '', anticipo: '', observaciones_mer: '' };
  }
  private refrescarDatos() { this.refrescar$.next(); this.cerrarModal(); }

  // ── Convierte SVG base64 a PNG base64 usando canvas (sin fetch, sin CORS) ──
  private svgBase64ToPngBase64(svgBase64: string, size: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width  = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      // Usar el data URI directamente — no hay CORS porque no es una URL externa
      img.src = svgBase64;
    });
  }

  // ── Exportar ───────────────────────────────────────
  exportarExcel(despachos: any[]) {
    const ws = XLSX.utils.json_to_sheet(despachos.map(d => ({
      Planilla: d.numero_planilla ?? d.id,
      Placa: d.vehiculo?.numero_placas ?? '',
      Fecha: d.fecha_despacho,
      Negociacion: d.pago?.negociacion ?? d.negociacion,
      Anticipo:    d.pago?.anticipo    ?? d.anticipo,
      Saldo:       d.pago?.saldo       ?? d.saldo,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Despachos');
    XLSX.writeFile(wb, 'despachos.xlsx');
  }
  exportarCSV(despachos: any[]) {
    const ws = XLSX.utils.json_to_sheet(despachos);
    saveAs(new Blob([XLSX.utils.sheet_to_csv(ws)], { type: 'text/csv;charset=utf-8;' }), 'despachos.csv');
  }
  exportarWord(despachos: any[]) {
    const rows = despachos.map(d =>
      new TableRow({ children: [
        new TableCell({ children: [new Paragraph((d.numero_planilla ?? d.id).toString())] }),
        new TableCell({ children: [new Paragraph(d.vehiculo?.numero_placas ?? '')] }),
        new TableCell({ children: [new Paragraph(d.fecha_despacho ?? '')] }),
        new TableCell({ children: [new Paragraph((d.pago?.negociacion ?? d.negociacion ?? '').toString())] }),
      ]})
    );
    const doc = new Document({ sections: [{ children: [
      new Paragraph('Reporte de Despachos — AGATHA'),
      new Table({ rows: [
        new TableRow({ children: [
          new TableCell({ children: [new Paragraph('Planilla')] }),
          new TableCell({ children: [new Paragraph('Placa')] }),
          new TableCell({ children: [new Paragraph('Fecha')] }),
          new TableCell({ children: [new Paragraph('Negociación')] }),
        ]}),
        ...rows
      ]})
    ]}]});
    Packer.toBlob(doc).then(blob => saveAs(blob, 'despachos.docx'));
  }
}
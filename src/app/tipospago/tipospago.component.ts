import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { BehaviorSubject, switchMap } from 'rxjs';
import { ApiService } from '../services/api.service';
import { NgxPaginationModule } from 'ngx-pagination';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { Document, Packer, Paragraph, Table, TableRow, TableCell } from 'docx';

@Component({
  selector: 'app-tipospago',
  standalone: true,
  imports: [FormsModule, CommonModule, NgxPaginationModule],
  templateUrl: './tipospago.component.html',
  styleUrls: ['./tipospago.component.css']
})
export class TipospagoComponent implements OnInit {
  dropdownOpen = false;
  toggleDropdown(event: MouseEvent) {
    event.stopPropagation();
    this.dropdownOpen = !this.dropdownOpen;
  }
  ngOnInit() {
    document.addEventListener('click', () => this.dropdownOpen = false);
  }

  private refrescar$ = new BehaviorSubject<void>(undefined);

  data$ = this.refrescar$.pipe(
    switchMap(() => this.api.getTiposPago())
  );

  pagoForm: any = this.getEmptyForm();
  editando = false;
  editId: number | null = null;
  modalVisible = false;
  pagoConsultado: any = null;

  filtroNombre = '';
  page = 1;
  pageSize = 8;

  alertaVisible = false;
  alertaMensaje = '';
  alertaTipo: 'exito' | 'error' = 'exito';

  constructor(private api: ApiService) {}

  abrirModal(p?: any) {
    if (p) {
      this.editando = true;
      this.editId = p.id;
      this.pagoForm = { ...p };
    } else {
      this.resetForm();
    }
    this.modalVisible = true;
  }

  cerrarModal() {
    this.modalVisible = false;
    this.resetForm();
  }

  guardarPago() {
    if (!this.pagoForm.nombre) {
      return this.mostrarAlerta('⚠️ El nombre es obligatorio.', 'error');
    }

    const request = this.editando && this.editId
      ? this.api.actualizarTipoPago(this.editId, this.pagoForm)
      : this.api.crearTipoPago(this.pagoForm);

    request.subscribe({
      next: () => {
        this.refrescarDatos();
        this.mostrarAlerta(`✅ Tipo de pago ${this.editando ? 'actualizado' : 'creado'} con éxito.`, 'exito');
      },
      error: () => this.mostrarAlerta('❌ Error al guardar tipo de pago.', 'error')
    });
  }

  eliminarPago(id: number) {
    if (!confirm('¿Seguro que quieres eliminar este tipo de pago?')) return;
    this.api.eliminarTipoPago(id).subscribe({
      next: () => {
        this.refrescarDatos();
        this.mostrarAlerta('🗑️ Tipo de pago eliminado con éxito.', 'exito');
      },
      error: () => this.mostrarAlerta('❌ Error al eliminar tipo de pago.', 'error')
    });
  }

  consultarPago(id: number) {
    this.api.getTipoPago(id).subscribe({
      next: res => this.pagoConsultado = res,
      error: () => this.mostrarAlerta('❌ Error al consultar tipo de pago.', 'error')
    });
  }

  cerrarConsulta() {
    this.pagoConsultado = null;
  }

  private resetForm() {
    this.pagoForm = this.getEmptyForm();
    this.editando = false;
    this.editId = null;
  }

  private getEmptyForm() {
    return { nombre: '' };
  }

  private refrescarDatos() {
    this.refrescar$.next();
    this.cerrarModal();
  }

  mostrarAlerta(mensaje: string, tipo: 'exito' | 'error') {
    this.alertaMensaje = mensaje;
    this.alertaTipo = tipo;
    this.alertaVisible = true;
    setTimeout(() => this.alertaVisible = false, 4000);
  }
  cerrarAlerta() {
    this.alertaVisible = false;
  }

  pagosFiltrados(pagos: any[]) {
    return pagos.filter(p =>
      !this.filtroNombre || p.nombre.toLowerCase().includes(this.filtroNombre.toLowerCase())
    );
  }

  // EXPORTACIONES
  exportarExcel(pagos: any[]) {
    const worksheet = XLSX.utils.json_to_sheet(pagos);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'TiposPago');
    XLSX.writeFile(workbook, 'tipospago.xlsx');
  }

  exportarCSV(pagos: any[]) {
    const worksheet = XLSX.utils.json_to_sheet(pagos);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'tipospago.csv');
  }

  exportarWord(pagos: any[]) {
    const rows = pagos.map(p =>
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(p.id.toString())] }),
          new TableCell({ children: [new Paragraph(p.nombre)] }),
        ],
      })
    );

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph("📑 Reporte de Tipos de Pago"),
            new Table({
              rows: [
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph("ID")] }),
                    new TableCell({ children: [new Paragraph("Nombre")] }),
                  ],
                }),
                ...rows,
              ],
            }),
          ],
        },
      ],
    });

    Packer.toBlob(doc).then(blob => saveAs(blob, 'tipospago.docx'));
  }

  async exportarPDF(pagos: any[]) {
    const pdfMakeModule = await import('pdfmake/build/pdfmake');
    const pdfFonts = await import('pdfmake/build/vfs_fonts');
    (pdfMakeModule as any).vfs = (pdfFonts as any).vfs;

    const body = [
      ["ID", "Nombre"],
      ...pagos.map(p => [p.id, p.nombre]),
    ];

    const docDefinition = {
      content: [
        { text: "📑 Reporte de Tipos de Pago", style: "header" },
        { table: { body } },
      ],
      styles: { header: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] } },
    };

    (pdfMakeModule as any).createPdf(docDefinition).download("tipospago.pdf");
  }
}

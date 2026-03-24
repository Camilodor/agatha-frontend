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
  selector: 'app-tiposdocumento',
  standalone: true,
  imports: [FormsModule, CommonModule, NgxPaginationModule],
  templateUrl: './tiposdocumento.component.html',
  styleUrls: ['./tiposdocumento.component.css']
})
export class TiposdocumentoComponent implements OnInit {
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
    switchMap(() => this.api.getTiposDocumento())
  );

  docForm: any = this.getEmptyForm();
  editando = false;
  editId: number | null = null;
  modalVisible = false;
  docConsultado: any = null;

  filtroNombre = '';
  page = 1;
  pageSize = 8;

  alertaVisible = false;
  alertaMensaje = '';
  alertaTipo: 'exito' | 'error' = 'exito';

  constructor(private api: ApiService) {}

  abrirModal(d?: any) {
    if (d) {
      this.editando = true;
      this.editId = d.id;
      this.docForm = { ...d };
    } else {
      this.resetForm();
    }
    this.modalVisible = true;
  }

  cerrarModal() {
    this.modalVisible = false;
    this.resetForm();
  }

  guardarDocumento() {
    if (!this.docForm.nombre) {
      return this.mostrarAlerta('⚠️ El nombre es obligatorio.', 'error');
    }

    const request = this.editando && this.editId
      ? this.api.actualizarTipoDocumento(this.editId, this.docForm)
      : this.api.crearTipoDocumento(this.docForm);

    request.subscribe({
      next: () => {
        this.refrescarDatos();
        this.mostrarAlerta(`✅ Tipo de documento ${this.editando ? 'actualizado' : 'creado'} con éxito.`, 'exito');
      },
      error: () => this.mostrarAlerta('❌ Error al guardar tipo de documento.', 'error')
    });
  }

  eliminarDocumento(id: number) {
    if (!confirm('¿Seguro que quieres eliminar este tipo de documento?')) return;
    this.api.eliminarTipoDocumento(id).subscribe({
      next: () => {
        this.refrescarDatos();
        this.mostrarAlerta('🗑️ Tipo de documento eliminado con éxito.', 'exito');
      },
      error: () => this.mostrarAlerta('❌ Error al eliminar tipo de documento.', 'error')
    });
  }

  consultarDocumento(id: number) {
    this.api.getTipoDocumento(id).subscribe({
      next: res => this.docConsultado = res,
      error: () => this.mostrarAlerta('❌ Error al consultar tipo de documento.', 'error')
    });
  }

  cerrarConsulta() {
    this.docConsultado = null;
  }

  private resetForm() {
    this.docForm = this.getEmptyForm();
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

  documentosFiltrados(docs: any[]) {
    return docs.filter(d =>
      !this.filtroNombre || d.nombre.toLowerCase().includes(this.filtroNombre.toLowerCase())
    );
  }

  // EXPORTACIONES
  exportarExcel(docs: any[]) {
    const worksheet = XLSX.utils.json_to_sheet(docs);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'TiposDocumento');
    XLSX.writeFile(workbook, 'tiposdocumento.xlsx');
  }

  exportarCSV(docs: any[]) {
    const worksheet = XLSX.utils.json_to_sheet(docs);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'tiposdocumento.csv');
  }

  exportarWord(docs: any[]) {
    const rows = docs.map(d =>
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(d.id.toString())] }),
          new TableCell({ children: [new Paragraph(d.nombre)] }),
        ],
      })
    );

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph("📑 Reporte de Tipos de Documento"),
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

    Packer.toBlob(doc).then(blob => saveAs(blob, 'tiposdocumento.docx'));
  }

  async exportarPDF(docs: any[]) {
    const pdfMakeModule = await import('pdfmake/build/pdfmake');
    const pdfFonts = await import('pdfmake/build/vfs_fonts');
    (pdfMakeModule as any).vfs = (pdfFonts as any).vfs;

    const body = [
      ["ID", "Nombre"],
      ...docs.map(d => [d.id, d.nombre]),
    ];

    const docDefinition = {
      content: [
        { text: "📑 Reporte de Tipos de Documento", style: "header" },
        { table: { body } },
      ],
      styles: { header: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] } },
    };

    (pdfMakeModule as any).createPdf(docDefinition).download("tiposdocumento.pdf");
  }
}

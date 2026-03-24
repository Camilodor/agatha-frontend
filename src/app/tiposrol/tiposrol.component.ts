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
  selector: 'app-tiposrol',
  standalone: true,
  imports: [FormsModule, CommonModule, NgxPaginationModule],
  templateUrl: './tiposrol.component.html',
  styleUrls: ['./tiposrol.component.css']
})
export class TiposrolComponent implements OnInit {
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
    switchMap(() => this.api.getTiposRol())
  );

  rolForm: any = this.getEmptyForm();
  editando = false;
  editId: number | null = null;
  modalVisible = false;
  rolConsultado: any = null;

  filtroNombre = '';
  page = 1;
  pageSize = 8;

  alertaVisible = false;
  alertaMensaje = '';
  alertaTipo: 'exito' | 'error' = 'exito';

  constructor(private api: ApiService) {}

  abrirModal(r?: any) {
    if (r) {
      this.editando = true;
      this.editId = r.id;
      this.rolForm = { ...r };
    } else {
      this.resetForm();
    }
    this.modalVisible = true;
  }

  cerrarModal() {
    this.modalVisible = false;
    this.resetForm();
  }

  guardarRol() {
    if (!this.rolForm.nombre) {
      return this.mostrarAlerta('⚠️ El nombre es obligatorio.', 'error');
    }

    const request = this.editando && this.editId
      ? this.api.actualizarTipoRol(this.editId, this.rolForm)
      : this.api.crearTipoRol(this.rolForm);

    request.subscribe({
      next: () => {
        this.refrescarDatos();
        this.mostrarAlerta(`✅ Rol ${this.editando ? 'actualizado' : 'creado'} con éxito.`, 'exito');
      },
      error: () => this.mostrarAlerta('❌ Error al guardar rol.', 'error')
    });
  }

  eliminarRol(id: number) {
    if (!confirm('¿Seguro que quieres eliminar este rol?')) return;
    this.api.eliminarTipoRol(id).subscribe({
      next: () => {
        this.refrescarDatos();
        this.mostrarAlerta('🗑️ Rol eliminado con éxito.', 'exito');
      },
      error: () => this.mostrarAlerta('❌ Error al eliminar rol.', 'error')
    });
  }

  consultarRol(id: number) {
    this.api.getTipoRol(id).subscribe({
      next: res => this.rolConsultado = res,
      error: () => this.mostrarAlerta('❌ Error al consultar rol.', 'error')
    });
  }

  cerrarConsulta() {
    this.rolConsultado = null;
  }

  private resetForm() {
    this.rolForm = this.getEmptyForm();
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

  rolesFiltrados(roles: any[]) {
    return roles.filter(r =>
      !this.filtroNombre || r.nombre.toLowerCase().includes(this.filtroNombre.toLowerCase())
    );
  }

  // ------------------------------- EXPORTAR
  exportarExcel(roles: any[]) {
    const worksheet = XLSX.utils.json_to_sheet(roles);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'TiposRol');
    XLSX.writeFile(workbook, 'tiposrol.xlsx');
  }

  exportarCSV(roles: any[]) {
    const worksheet = XLSX.utils.json_to_sheet(roles);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'tiposrol.csv');
  }

  exportarWord(roles: any[]) {
    const rows = roles.map(r =>
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(r.id.toString())] }),
          new TableCell({ children: [new Paragraph(r.nombre)] }),
        ],
      })
    );

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph("📑 Reporte de Tipos de Rol"),
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

    Packer.toBlob(doc).then(blob => saveAs(blob, 'tiposrol.docx'));
  }

  async exportarPDF(roles: any[]) {
    const pdfMakeModule = await import('pdfmake/build/pdfmake');
    const pdfFonts = await import('pdfmake/build/vfs_fonts');
    (pdfMakeModule as any).vfs = (pdfFonts as any).vfs;

    const body = [
      ["ID", "Nombre"],
      ...roles.map(r => [r.id, r.nombre]),
    ];

    const docDefinition = {
      content: [
        { text: "📑 Reporte de Tipos de Rol", style: "header" },
        { table: { body } },
      ],
      styles: { header: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] } },
    };

    (pdfMakeModule as any).createPdf(docDefinition).download("tiposrol.pdf");
  }
}

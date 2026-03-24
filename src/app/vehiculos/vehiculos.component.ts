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
  selector: 'app-vehiculos',
  standalone: true,
  imports: [FormsModule, CommonModule, NgxPaginationModule],
  templateUrl: './vehiculos.component.html',
  styleUrls: ['./vehiculos.component.css']
})
export class VehiculosComponent implements OnInit {

  // ── Dropdown ───────────────────────────────────────
  dropdownOpen = false;
  toggleDropdown(e: MouseEvent) { e.stopPropagation(); this.dropdownOpen = !this.dropdownOpen; }
  ngOnInit() { document.addEventListener('click', () => { this.dropdownOpen = false; }); }

  // ── Data stream ────────────────────────────────────
  private refrescar$ = new BehaviorSubject<void>(undefined);
  data$ = this.refrescar$.pipe(
    switchMap(() => forkJoin({
      vehiculos: this.api.getVehiculos(),
      usuarios:  this.api.getUsuarios()
    }))
  );

  // ── Estado UI ──────────────────────────────────────
  vehiculoForm: any       = this.getEmptyForm();
  editando                = false;
  editId: number | null   = null;
  filtroPlaca             = '';
  filtroConductor         = '';
  modalVisible            = false;
  vehiculoConsultado: any = null;
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
  abrirModal(v?: any) {
    if (v) {
      this.editando = true;
      this.editId   = v.id;
      this.vehiculoForm = {
        numero_placas:                  v.numero_placas ?? '',
        nombre_marca_vehiculo:          v.nombre_marca_vehiculo ?? '',
        nombre_propietario_vehiculo:    v.nombre_propietario_vehiculo ?? '',
        documento_propietario_vehiculo: v.documento_propietario_vehiculo ?? '',
        numero_celular_propietario:     v.numero_celular_propietario ?? '',
        direccion_propietario:          v.direccion_propietario ?? '',
        ciudad_propietario:             v.ciudad_propietario ?? '',
        numero_modelo_anio:             v.numero_modelo_anio ?? '',
        color_vehiculo:                 v.color_vehiculo ?? '',
        fecha_vencimiento_soat:         v.fecha_vencimiento_soat ?? '',
        fecha_vencimiento_tecno:        v.fecha_vencimiento_tecno ?? '',
        nombre_satelital:               v.nombre_satelital ?? '',
        usuario_satelital:              v.usuario_satelital ?? '',
        contrasena_satelital:           v.contrasena_satelital ?? '',
        capacidad_carga:                v.capacidad_carga ?? '',
        numero_documento:               v.usuario?.numero_documento ?? ''
      };
    } else {
      this.resetForm();
    }
    this.modalVisible = true;
    this.fieldErrors  = {};
  }

  cerrarModal()    { this.modalVisible = false; this.resetForm(); this.fieldErrors = {}; }
  cerrarConsulta() { this.vehiculoConsultado = null; }
  clearError(campo: string) { delete this.fieldErrors[campo]; }

  // ── Guardar ────────────────────────────────────────
  guardarVehiculo() {
    this.fieldErrors = {};

    if (!this.vehiculoForm.numero_documento?.toString().trim())
      this.fieldErrors['numero_documento'] = 'El documento del conductor es obligatorio.';
    else if (!/^\d{6,15}$/.test(this.vehiculoForm.numero_documento.toString().trim()))
      this.fieldErrors['numero_documento'] = 'Ingresa un número de documento válido (solo dígitos).';

    if (!this.vehiculoForm.numero_placas?.trim())
      this.fieldErrors['numero_placas'] = 'El número de placas es obligatorio.';

    if (!this.vehiculoForm.nombre_marca_vehiculo?.trim())
      this.fieldErrors['nombre_marca_vehiculo'] = 'La marca es obligatoria.';

    if (!this.vehiculoForm.numero_modelo_anio?.toString().trim())
      this.fieldErrors['numero_modelo_anio'] = 'El modelo es obligatorio.';

    if (!this.vehiculoForm.color_vehiculo?.trim())
      this.fieldErrors['color_vehiculo'] = 'El color es obligatorio.';

    if (!this.vehiculoForm.fecha_vencimiento_soat)
      this.fieldErrors['fecha_vencimiento_soat'] = 'La fecha de vencimiento del SOAT es obligatoria.';

    if (!this.vehiculoForm.fecha_vencimiento_tecno)
      this.fieldErrors['fecha_vencimiento_tecno'] = 'La fecha de vencimiento de tecno-mecánica es obligatoria.';

    if (!this.vehiculoForm.nombre_propietario_vehiculo?.trim())
      this.fieldErrors['nombre_propietario_vehiculo'] = 'El nombre del propietario es obligatorio.';

    if (!this.vehiculoForm.documento_propietario_vehiculo?.trim())
      this.fieldErrors['documento_propietario_vehiculo'] = 'El documento del propietario es obligatorio.';

    if (!this.vehiculoForm.numero_celular_propietario?.trim())
      this.fieldErrors['numero_celular_propietario'] = 'El celular del propietario es obligatorio.';

    if (!this.vehiculoForm.ciudad_propietario?.trim())
      this.fieldErrors['ciudad_propietario'] = 'La ciudad es obligatoria.';

    if (!this.vehiculoForm.direccion_propietario?.trim())
      this.fieldErrors['direccion_propietario'] = 'La dirección es obligatoria.';

    if (Object.keys(this.fieldErrors).length > 0) return;

    if (!confirm(`¿${this.editando ? 'Editar' : 'Registrar'} este vehículo?`)) return;

    const request = this.editando && this.editId
      ? this.api.actualizarVehiculo(this.editId, this.vehiculoForm)
      : this.api.crearVehiculo(this.vehiculoForm);

    request.subscribe({
      next: () => {
        this.refrescarDatos();
        this.mostrarAlerta(`Vehículo ${this.editando ? 'actualizado' : 'registrado'} con éxito.`, 'exito');
      },
      error: (error) => {
        if (error.status === 422 && error.error?.errors) {
          const errores = error.error.errors as Record<string, string[]>;
          Object.entries(errores).forEach(([campo, msgs]) => {
            this.fieldErrors[campo] = msgs[0];
          });
        } else if (error.status === 404 || error.status === 422) {
          this.fieldErrors['numero_documento'] = 'No existe un conductor con ese número de documento.';
        } else {
          this.mostrarAlerta('Error inesperado. Intente nuevamente.', 'error');
        }
      }
    });
  }

  // ── Eliminar ───────────────────────────────────────
  eliminarVehiculo(id: number) {
    if (!confirm('¿Eliminar este vehículo? Esta acción no se puede deshacer.')) return;
    this.api.eliminarVehiculo(id).subscribe({
      next:  () => { this.refrescarDatos(); this.mostrarAlerta('Vehículo eliminado.', 'exito'); },
      error: () => this.mostrarAlerta('Error al eliminar el vehículo.', 'error')
    });
  }

  // ── Consultar ──────────────────────────────────────
  consultarVehiculo(id: number) {
    this.api.getVehiculo(id).subscribe({
      next:  res => this.vehiculoConsultado = res,
      error: ()  => this.mostrarAlerta('Error al consultar el vehículo.', 'error')
    });
  }

  // ── Helpers UI ─────────────────────────────────────
  getConductorInitials(usuario: any): string {
    const n = (usuario?.nombres ?? '').charAt(0).toUpperCase();
    const a = (usuario?.apellidos ?? '').charAt(0).toUpperCase();
    return `${n}${a}`;
  }

  getSoatClass(fecha: string): string {
    if (!fecha) return 'soat-vencido';
    const hoy   = new Date();
    const vence = new Date(fecha);
    const dias  = Math.floor((vence.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
    if (dias < 0)   return 'soat-vencido';
    if (dias <= 30) return 'soat-pronto';
    return 'soat-ok';
  }

  getSoatLabel(fecha: string): string {
    if (!fecha) return 'Sin fecha';
    const hoy   = new Date();
    const vence = new Date(fecha);
    const dias  = Math.floor((vence.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
    if (dias < 0)   return 'Vencido';
    if (dias <= 30) return `Vence en ${dias}d`;
    return 'Vigente';
  }

  vehiculosFiltrados(vehiculos: any[]): any[] {
    let lista = vehiculos.filter(v => {
      const placa = (v.numero_placas ?? '').toLowerCase();
      const doc   = (v.usuario?.numero_documento ?? '').toString().toLowerCase();
      const nom   = ((v.usuario?.nombres ?? '') + ' ' + (v.usuario?.apellidos ?? '')).toLowerCase();
      return (!this.filtroPlaca      || placa.includes(this.filtroPlaca.toLowerCase()))
          && (!this.filtroConductor  || doc.includes(this.filtroConductor.toLowerCase()) || nom.includes(this.filtroConductor.toLowerCase()));
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
  private resetForm() { this.vehiculoForm = this.getEmptyForm(); this.editando = false; this.editId = null; }
  private getEmptyForm() {
    return {
      numero_placas: '', nombre_marca_vehiculo: '', nombre_propietario_vehiculo: '',
      documento_propietario_vehiculo: '', numero_celular_propietario: '',
      direccion_propietario: '', ciudad_propietario: '',
      numero_modelo_anio: '', color_vehiculo: '',
      fecha_vencimiento_soat: '', fecha_vencimiento_tecno: '',
      nombre_satelital: '', usuario_satelital: '', contrasena_satelital: '',
      capacidad_carga: '', numero_documento: ''
    };
  }
  private refrescarDatos() { this.refrescar$.next(); this.cerrarModal(); }

  // ── Exportar ───────────────────────────────────────
  exportarExcel(vehiculos: any[]) {
    const ws = XLSX.utils.json_to_sheet(vehiculos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vehículos');
    XLSX.writeFile(wb, 'vehiculos.xlsx');
  }
  exportarCSV(vehiculos: any[]) {
    const ws = XLSX.utils.json_to_sheet(vehiculos);
    saveAs(new Blob([XLSX.utils.sheet_to_csv(ws)], { type: 'text/csv;charset=utf-8;' }), 'vehiculos.csv');
  }
  exportarWord(vehiculos: any[]) {
    const rows = vehiculos.map(v =>
      new TableRow({ children: [
        new TableCell({ children: [new Paragraph(v.id?.toString() ?? '')] }),
        new TableCell({ children: [new Paragraph(v.numero_placas ?? '')] }),
        new TableCell({ children: [new Paragraph(v.nombre_marca_vehiculo ?? '')] }),
        new TableCell({ children: [new Paragraph(v.nombre_propietario_vehiculo ?? '')] }),
        new TableCell({ children: [new Paragraph((v.usuario?.nombres ?? '') + ' ' + (v.usuario?.apellidos ?? ''))] }),
      ]})
    );
    const doc = new Document({ sections: [{ children: [
      new Paragraph('Reporte de Vehículos — AGATHA'),
      new Table({ rows: [
        new TableRow({ children: [
          new TableCell({ children: [new Paragraph('ID')] }),
          new TableCell({ children: [new Paragraph('Placa')] }),
          new TableCell({ children: [new Paragraph('Marca')] }),
          new TableCell({ children: [new Paragraph('Propietario')] }),
          new TableCell({ children: [new Paragraph('Conductor')] }),
        ]}),
        ...rows
      ]})
    ]}]});
    Packer.toBlob(doc).then(blob => saveAs(blob, 'vehiculos.docx'));
  }
  async exportarPDF(vehiculos: any[]) {
    const pdfMake  = await import('pdfmake/build/pdfmake');
    const pdfFonts = await import('pdfmake/build/vfs_fonts');
    (pdfMake as any).vfs = (pdfFonts as any).vfs;
    (pdfMake as any).createPdf({
      content: [
        { text: 'Reporte de Vehículos — AGATHA', style: 'header' },
        { table: { body: [
          ['ID', 'Placa', 'Marca', 'Propietario', 'Conductor'],
          ...vehiculos.map(v => [v.id, v.numero_placas, v.nombre_marca_vehiculo, v.nombre_propietario_vehiculo, (v.usuario?.nombres ?? '') + ' ' + (v.usuario?.apellidos ?? '')])
        ]}}
      ],
      styles: { header: { fontSize: 16, bold: true, margin: [0, 0, 0, 12] } }
    }).download('vehiculos.pdf');
  }
}
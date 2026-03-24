import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private apiUrl = 'http://127.0.0.1:8000/api';
  constructor(private http: HttpClient) {}

  // ── Usuarios ───────────────────────────────────────
  getUsuarios = (): Observable<any[]> => this.http.get<any[]>(`${this.apiUrl}/usuarios`);
  getUsuario  = (id: number): Observable<any> => this.http.get<any>(`${this.apiUrl}/usuarios/${id}`);
  crearUsuario      = (d: any) => this.http.post(`${this.apiUrl}/usuarios`, d);
  actualizarUsuario = (id: number, d: any) => this.http.put(`${this.apiUrl}/usuarios/${id}`, d);
  eliminarUsuario   = (id: number) => this.http.delete(`${this.apiUrl}/usuarios/${id}`);

  // ── Catálogos ──────────────────────────────────────
  getTiposRol       = (): Observable<any[]> => this.http.get<any[]>(`${this.apiUrl}/tiporol`);
  getTiposDocumento = (): Observable<any[]> => this.http.get<any[]>(`${this.apiUrl}/tipodocumentos`);
  getTiposPago      = (): Observable<any[]> => this.http.get<any[]>(`${this.apiUrl}/tipospago`);
  getTipoPago       = (id: number) => this.http.get<any>(`${this.apiUrl}/tipospago/${id}`);
  crearTipoPago     = (d: any) => this.http.post(`${this.apiUrl}/tipospago`, d);
  actualizarTipoPago= (id: number, d: any) => this.http.put(`${this.apiUrl}/tipospago/${id}`, d);
  eliminarTipoPago  = (id: number) => this.http.delete(`${this.apiUrl}/tipospago/${id}`);
  getTipoRol        = (id: number) => this.http.get<any>(`${this.apiUrl}/tiporol/${id}`);
  crearTipoRol      = (d: any) => this.http.post(`${this.apiUrl}/tiporol`, d);
  actualizarTipoRol = (id: number, d: any) => this.http.put(`${this.apiUrl}/tiporol/${id}`, d);
  eliminarTipoRol   = (id: number) => this.http.delete(`${this.apiUrl}/tiporol/${id}`);
  getTipoDocumento  = (id: number) => this.http.get<any>(`${this.apiUrl}/tipodocumentos/${id}`);
  crearTipoDocumento= (d: any) => this.http.post(`${this.apiUrl}/tipodocumentos`, d);
  actualizarTipoDocumento = (id: number, d: any) => this.http.put(`${this.apiUrl}/tipodocumentos/${id}`, d);
  eliminarTipoDocumento   = (id: number) => this.http.delete(`${this.apiUrl}/tipodocumentos/${id}`);

  // ── Proveedores ────────────────────────────────────
  getProveedores    = (): Observable<any[]> => this.http.get<any[]>(`${this.apiUrl}/proveedores`);
  getProveedor      = (id: number) => this.http.get<any>(`${this.apiUrl}/proveedores/${id}`);
  crearProveedor    = (d: any) => this.http.post(`${this.apiUrl}/proveedores`, d);
  actualizarProveedor= (id: number, d: any) => this.http.put(`${this.apiUrl}/proveedores/${id}`, d);
  eliminarProveedor  = (id: number) => this.http.delete(`${this.apiUrl}/proveedores/${id}`);

  // ── Productos ──────────────────────────────────────
  getProductos    = (): Observable<any[]> => this.http.get<any[]>(`${this.apiUrl}/productos`);
  getProducto     = (id: number) => this.http.get<any>(`${this.apiUrl}/productos/${id}`);
  crearProducto   = (d: any) => this.http.post(`${this.apiUrl}/productos`, d);
  actualizarProducto= (id: number, d: any) => this.http.put(`${this.apiUrl}/productos/${id}`, d);
  eliminarProducto  = (id: number) => this.http.delete(`${this.apiUrl}/productos/${id}`);
  getProductosPorProveedor = (proveedorId: number) =>
    this.http.get<any[]>(`${this.apiUrl}/productos?proveedor_id=${proveedorId}`);

  // ── Mercancías ─────────────────────────────────────
  getMercancias    = (): Observable<any[]> => this.http.get<any[]>(`${this.apiUrl}/mercancias`);
  getMercancia     = (id: number) => this.http.get<any>(`${this.apiUrl}/mercancias/${id}`);
  crearMercancia   = (d: any) => this.http.post(`${this.apiUrl}/mercancias`, d);
  actualizarMercancia= (id: number, d: any) => this.http.put(`${this.apiUrl}/mercancias/${id}`, d);
  eliminarMercancia  = (id: number) => this.http.delete(`${this.apiUrl}/mercancias/${id}`);

  // ── Vehículos ──────────────────────────────────────
  getVehiculos    = (): Observable<any[]> => this.http.get<any[]>(`${this.apiUrl}/vehiculos`);
  getVehiculo     = (id: number) => this.http.get<any>(`${this.apiUrl}/vehiculos/${id}`);
  crearVehiculo   = (d: any) => this.http.post(`${this.apiUrl}/vehiculos`, d);
  actualizarVehiculo= (id: number, d: any) => this.http.put(`${this.apiUrl}/vehiculos/${id}`, d);
  eliminarVehiculo  = (id: number) => this.http.delete(`${this.apiUrl}/vehiculos/${id}`);

  // ── Despachos ──────────────────────────────────────
  getDespachos    = (): Observable<any[]> => this.http.get<any[]>(`${this.apiUrl}/despachos`);
  getDespacho     = (id: number) => this.http.get<any>(`${this.apiUrl}/despachos/${id}`);
  crearDespacho   = (d: any) => this.http.post(`${this.apiUrl}/despachos`, d);
  actualizarDespacho= (id: number, d: any) => this.http.put(`${this.apiUrl}/despachos/${id}`, d);
  eliminarDespacho  = (id: number) => this.http.delete(`${this.apiUrl}/despachos/${id}`);

  // ── QR Despacho ────────────────────────────────────
  /** GET /api/despachos/{id}/qr — imagen PNG del QR */
  getQRDespacho = (id: number) =>
    this.http.get(`${this.apiUrl}/despachos/${id}/qr`, { responseType: 'blob' });

  /** GET /api/despachos/{id}/qr-data — JSON con datos del QR */
  getQRDataDespacho = (id: number) =>
    this.http.get<any>(`${this.apiUrl}/despachos/${id}/qr-data`);

  /** POST /api/despachos/{id}/qr/regenerar — regenerar QR */
  regenerarQR = (id: number) =>
    this.http.post<any>(`${this.apiUrl}/despachos/${id}/qr/regenerar`, {});

  // ── Entregas ───────────────────────────────────────
  getEntregas    = (): Observable<any[]> => this.http.get<any[]>(`${this.apiUrl}/entregas`);
  getEntrega     = (id: number) => this.http.get<any>(`${this.apiUrl}/entregas/${id}`);
  crearEntrega   = (d: any) => this.http.post(`${this.apiUrl}/entregas`, d);
  actualizarEntrega= (id: number, d: any) => this.http.put(`${this.apiUrl}/entregas/${id}`, d);
  eliminarEntrega  = (id: number) => this.http.delete(`${this.apiUrl}/entregas/${id}`);

  // ── Devoluciones ───────────────────────────────────
  getDevoluciones    = (): Observable<any[]> => this.http.get<any[]>(`${this.apiUrl}/devoluciones`);
  getDevolucion      = (id: number) => this.http.get<any>(`${this.apiUrl}/devoluciones/${id}`);
  crearDevolucion    = (d: any) => this.http.post(`${this.apiUrl}/devoluciones`, d);
  actualizarDevolucion=(id: number, d: any) => this.http.put(`${this.apiUrl}/devoluciones/${id}`, d);
  eliminarDevolucion  = (id: number) => this.http.delete(`${this.apiUrl}/devoluciones/${id}`);

  // ── Seguimientos ───────────────────────────────────
  getSeguimientos    = (): Observable<any[]> => this.http.get<any[]>(`${this.apiUrl}/seguimientos`);
  getSeguimiento     = (id: number) => this.http.get<any>(`${this.apiUrl}/seguimientos/${id}`);
  getSeguimientoPorRemesa = (remesa: string) =>
    this.http.get<any>(`${this.apiUrl}/seguimientos/remesa/${remesa}`);
  actualizarSeguimiento= (id: number, d: any) => this.http.put(`${this.apiUrl}/seguimientos/${id}`, d);
  eliminarSeguimiento  = (id: number) => this.http.delete(`${this.apiUrl}/seguimientos/${id}`);

  // ── Fotos ──────────────────────────────────────────
  /** POST /api/fotos/{entidad}/{id} — sube o reemplaza foto */
  subirFoto = (entidad: string, id: number, file: File): Observable<any> => {
    const form = new FormData();
    form.append('foto', file);
    return this.http.post(`${this.apiUrl}/fotos/${entidad}/${id}`, form);
  };

  /** DELETE /api/fotos/{entidad}/{id} — elimina foto */
  eliminarFoto = (entidad: string, id: number): Observable<any> =>
    this.http.delete(`${this.apiUrl}/fotos/${entidad}/${id}`);
}
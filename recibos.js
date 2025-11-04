// recibos.js (module)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBA_i9O3vXzFn2rIKY4XQzll2fLvmD-u3A",
  authDomain: "toperformance-50d5a.firebaseapp.com",
  projectId: "toperformance-50d5a",
  storageBucket: "toperformance-50d5a.appspot.com",
  messagingSenderId: "1020165964748",
  appId: "1:1020165964748:web:f05155f982eb4f2eaf9369"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- DOM refs ---
const inputBuscarProducto = document.getElementById("inputBuscarProducto");
const productosLista = document.getElementById("productosLista");
const productosSeleccionadosDiv = document.getElementById("productosSeleccionados");
const btnGenerar = document.getElementById("btnGenerar");
const btnLimpiar = document.getElementById("btnLimpiar");
const inputCliente = document.getElementById("inputCliente");
const inputServicio = document.getElementById("inputServicio");
const inputDescripcion = document.getElementById("inputDescripcion");
const inputMetodoPago = document.getElementById("inputMetodoPago");
const inputTotal = document.getElementById("inputTotal");

const previewContainer = document.getElementById("previewContainer");
const btnDownloadPDF = document.getElementById("btnDownloadPDF");
const btnSaveLocal = document.getElementById("btnSaveLocal");
const btnNew = document.getElementById("btnNew");

const historialLista = document.getElementById("historialLista");
const btnExportExcel = document.getElementById("btnExportExcel");
const btnBorrarHistorial = document.getElementById("btnBorrarHistorial");
const buscarHistorial = document.getElementById("buscarHistorial");

const btnInicio = document.getElementById("btnInicio");
const btnLogout = document.getElementById("btnLogout");

// estado local
let productos = []; // inventario
let seleccionados = []; // {id,nombre,precio,cantidad}
let ultimoRecibo = null;

// --- protección: requiere sesión ---
onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.href = "index.html";
  }
});

// --- navegación ---
btnInicio.addEventListener("click", ()=> window.location.href = "inicio.html");
btnLogout.addEventListener("click", async ()=> { await signOut(auth); window.location.href = "index.html"; });

// --- cargar productos desde Firestore ---
async function cargarProductos() {
  productosLista.innerHTML = "<div class='small'>Cargando productos...</div>";
  const snap = await getDocs(collection(db, "inventario"));
  productos = snap.docs.map(d=> ({ id: d.id, ...d.data() }));
  mostrarProductos(productos);
}
function mostrarProductos(list){
  productosLista.innerHTML = "";
  if(list.length===0){
    productosLista.innerHTML = "<div class='small'>No hay productos</div>";
    return;
  }
  list.forEach(p=>{
    const div = document.createElement("div");
    div.className = "producto-item";
    div.innerHTML = `
      <div>
        <strong>${p.nombre}</strong><br>
        <small>$${Number(p.precio).toFixed(2)} · ${p.cantidad} en stock</small>
      </div>
      <div>
        <button data-id="${p.id}" data-nombre="${encodeURIComponent(p.nombre)}" data-precio="${p.precio}">Agregar</button>
      </div>
    `;
    productosLista.appendChild(div);
  });
}

// buscar producto
inputBuscarProducto.addEventListener("input", (e)=>{
  const t = e.target.value.trim().toLowerCase();
  const filtered = productos.filter(p => p.nombre.toLowerCase().includes(t));
  mostrarProductos(filtered);
});

// click en lista (delegación)
productosLista.addEventListener("click", async (e)=>{
  const btn = e.target.closest("button");
  if(!btn) return;
  const id = btn.dataset.id;
  const nombre = decodeURIComponent(btn.dataset.nombre);
  const precio = Number(btn.dataset.precio);
  // pedir cantidad
  let cantidad = prompt(`¿Cuántas unidades de "${nombre}" agregar? (stock disponible: ${productos.find(x=>x.id===id)?.cantidad})`, "1");
  if(cantidad===null) return;
  cantidad = Number(cantidad);
  if(!Number.isFinite(cantidad) || cantidad <= 0){ alert("Cantidad inválida"); return; }
  const prodData = productos.find(x=>x.id===id);
  if(!prodData) { alert("Producto no encontrado"); return; }
  if(cantidad > prodData.cantidad){ alert(`No hay suficiente stock. Disponible: ${prodData.cantidad}`); return; }

  // si ya existe en seleccionados, sumar cantidad
  const existing = seleccionados.find(s=>s.id===id);
  if(existing){
    existing.cantidad += cantidad;
  } else {
    seleccionados.push({ id, nombre, precio, cantidad });
  }
  renderSeleccionados();
});

// renderizar seleccionados
function renderSeleccionados(){
  productosSeleccionadosDiv.innerHTML = "";
  if(seleccionados.length===0){ productosSeleccionadosDiv.innerHTML = "<div class='small'>No hay productos seleccionados</div>"; return; }
  seleccionados.forEach((s, idx)=>{
    const tag = document.createElement("div");
    tag.className = "tag";
    tag.innerHTML = `<span>${s.nombre} — ${s.cantidad} × $${Number(s.precio).toFixed(2)} = $${(s.cantidad*s.precio).toFixed(2)}</span>
      <div>
        <button data-idx="${idx}" class="btn-remove" title="Quitar">✕</button>
      </div>`;
    productosSeleccionadosDiv.appendChild(tag);
  });
}
// quitar seleccionado (delegación)
productosSeleccionadosDiv.addEventListener("click", e=>{
  const btn = e.target.closest(".btn-remove");
  if(!btn) return;
  const idx = Number(btn.dataset.idx);
  seleccionados.splice(idx,1);
  renderSeleccionados();
});

// limpiar formulario
btnLimpiar.addEventListener("click", ()=>{
  inputCliente.value = "";
  inputServicio.value = "";
  inputDescripcion.value = "";
  inputMetodoPago.value = "";
  inputTotal.value = "";
  seleccionados = [];
  renderSeleccionados();
  previewContainer.classList.add("hidden");
  ultimoRecibo = null;
});

// generar recibo (vista previa + guardar a Firestore)
btnGenerar.addEventListener("click", async ()=>{
  const cliente = inputCliente.value.trim();
  const servicio = inputServicio.value.trim();
  const descripcion = inputDescripcion.value.trim();
  const metodoPago = inputMetodoPago.value;
  const total = Number(inputTotal.value);

  if(!cliente || !servicio || !metodoPago || !Number.isFinite(total) || seleccionados.length===0){
    alert("Completa cliente, servicio, método de pago, total y agrega al menos 1 producto.");
    return;
  }

  // construir objeto recibo
  const recibo = {
    cliente,
    servicio,
    descripcion,
    metodoPago,
    total,
    productos: seleccionados.map(s=> ({ id:s.id, nombre:s.nombre, precio:s.precio, cantidad:s.cantidad }) ),
    createdAt: serverTimestamp()
  };

  // Guardar en Firestore
  const ref = await addDoc(collection(db, "recibos"), recibo);

  // Actualizar stock (restar)
  // Nota: leer stock actual desde 'productos' array ya cargado
  for(const p of seleccionados){
    const inventRef = doc(db, "inventario", p.id);
    const current = productos.find(x=>x.id===p.id);
    const nuevoStock = (Number(current.cantidad) || 0) - Number(p.cantidad);
    await updateDoc(inventRef, { cantidad: nuevoStock });
  }

  // refrescar productos e historial
  await cargarProductos();
  await cargarHistorial();

  // guardar ultimoRecibo con fecha legible
  recibo.id = ref.id;
  recibo.fecha = new Date().toLocaleString();
  ultimoRecibo = recibo;

  // render preview factura profesional
  renderPreviewFactura(recibo);

  // limpiar seleccionados (pero keep preview and last)
  seleccionados = [];
  renderSeleccionados();
  alert("Recibo generado y stock actualizado ✅");
});

// render factura bonita en previewContainer
function renderPreviewFactura(r){
  previewContainer.classList.remove("hidden");
  const html = `
    <div class="preview-factura" id="facturaImprimible">
      <div class="head">
        <img src="imagenes/logo1.png" alt="logo">
        <div>
          <h3>ToPerformance</h3>
          <div class="small">Taller mecánico • Servicio profesional</div>
        </div>
      </div>

      <div class="meta">
        <div><strong>Cliente:</strong> ${escapeHtml(r.cliente)}</div>
        <div><strong>Servicio:</strong> ${escapeHtml(r.servicio)}</div>
        <div class="small">${escapeHtml(r.descripcion || "")}</div>
        <div class="small">Fecha: ${r.fecha || new Date().toLocaleString()}</div>
        <div class="small">Método: ${r.metodoPago}</div>
      </div>

      <table>
        <thead><tr><th>Descripción</th><th style="text-align:right">Cant</th><th style="text-align:right">P.u.</th><th style="text-align:right">Total</th></tr></thead>
        <tbody>
          ${r.productos.map(p=>`<tr>
            <td>${escapeHtml(p.nombre)}</td>
            <td style="text-align:right">${p.cantidad}</td>
            <td style="text-align:right">$${Number(p.precio).toFixed(2)}</td>
            <td style="text-align:right">$${(p.cantidad*p.precio).toFixed(2)}</td>
          </tr>`).join("")}
        </tbody>
      </table>

      <div class="totales" style="margin-top:12px">
        <div class="small">Gracias por preferirnos</div>
        <div style="text-align:right">
          <div><strong>Subtotal:</strong> $${calcSubtotal(r.productos).toFixed(2)}</div>
          <div><strong>Total:</strong> $${Number(r.total).toFixed(2)}</div>
        </div>
      </div>
    </div>
  `;
  previewContainer.innerHTML = html;
}

// helper subtotal
function calcSubtotal(items){
  return items.reduce((s,it)=> s + (Number(it.precio) * Number(it.cantidad)), 0);
}

// descargar PDF (usa html2canvas + jsPDF)
btnDownloadPDF.addEventListener("click", async ()=>{
  if(!ultimoRecibo){ alert("Primero genera un recibo"); return; }
  const element = document.getElementById("facturaImprimible");
  if(!element){ alert("No hay vista previa"); return; }

  // renderizar con html2canvas
  const canvas = await html2canvas(element, { scale: 2 });
  const imgData = canvas.toDataURL("image/png");

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF('p','mm','a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const imgProps = pdf.getImageProperties(imgData);
  const imgWidth = pageWidth - 20; // margen 10mm
  const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

  let posY = 10;
  pdf.addImage(imgData, 'PNG', 10, posY, imgWidth, imgHeight);
  pdf.save(`Recibo_${sanitizeFilename(ultimoRecibo.cliente)}_${Date.now()}.pdf`);
});

// guardar (ya se guardó al generar) - pero dejamos botón por si hace falta re-guardar o clonar
btnSaveLocal.addEventListener("click", async ()=>{
  if(!ultimoRecibo){ alert("No hay recibo para guardar"); return; }
  // Clonar en Firestore (por si se desea duplicar)
  const copy = { ...ultimoRecibo };
  copy.createdAt = serverTimestamp();
  delete copy.id;
  await addDoc(collection(db, "recibos"), copy);
  await cargarHistorial();
  alert("Copia del recibo guardada en Firestore.");
});

// nuevo
btnNew.addEventListener("click", ()=>{
  inputCliente.value = "";
  inputServicio.value = "";
  inputDescripcion.value = "";
  inputMetodoPago.value = "";
  inputTotal.value = "";
  seleccionados = [];
  renderSeleccionados();
  previewContainer.classList.add("hidden");
  ultimoRecibo = null;
});

// historial: cargar y mostrar
async function cargarHistorial(filterName=""){
  historialLista.innerHTML = "<div class='small'>Cargando...</div>";
  let q = collection(db, "recibos");
  // cargar todos y luego filtrar por cliente (para facilidad)
  const snap = await getDocs(q);
  const docs = snap.docs.map(d=> ({ id:d.id, ...d.data(), fecha: d.data().fecha || (d.data().createdAt ? (new Date(d.data().createdAt.seconds*1000).toLocaleString()) : "") }) );
  // filtro por nombre del cliente si aplica
  const filtered = filterName ? docs.filter(r => r.cliente.toLowerCase().includes(filterName.toLowerCase())) : docs;
  renderHistorial(filtered.sort((a,b)=> (a.fecha < b.fecha) ? 1 : -1)); // ordenar desc por fecha
}

function renderHistorial(items){
  historialLista.innerHTML = "";
  if(items.length===0){ historialLista.innerHTML = "<div class='small'>No hay recibos guardados</div>"; return; }
  items.forEach(r=>{
    const wrapper = document.createElement("div");
    wrapper.className = "recibo-item";
    wrapper.innerHTML = `
      <div class="recibo-header">
        <strong>${r.cliente}</strong> <small style="margin-left:8px;color:#f3f4f6;background:#111827;padding:4px 8px;border-radius:6px;font-weight:600">${r.fecha}</small>
        <div style="margin-left:auto;display:flex;gap:8px">
          <button data-id="${r.id}" class="btn-download-small">PDF</button>
          <button data-id="${r.id}" class="btn-delete-small">Eliminar</button>
        </div>
      </div>
      <div class="recibo-body">
        <p><strong>Servicio:</strong> ${escapeHtml(r.servicio)}</p>
        <p><strong>Descripción:</strong> ${escapeHtml(r.descripcion || "")}</p>
        <p><strong>Método:</strong> ${r.metodoPago}</p>
        <p><strong>Total:</strong> $${Number(r.total).toFixed(2)}</p>
        <h4>Productos:</h4>
        <ul>${(r.productos||[]).map(p=>`<li>${escapeHtml(p.nombre)} (${p.cantidad} × $${Number(p.precio).toFixed(2)})</li>`).join("")}</ul>
      </div>
    `;
    // toggle body
    wrapper.querySelector(".recibo-header").addEventListener("click", (ev)=>{
      // don't toggle when pressing buttons inside header
      if(ev.target.tagName === 'BUTTON') return;
      wrapper.querySelector(".recibo-body").classList.toggle("visible");
    });
    // download PDF specific recibo
    wrapper.querySelector(".btn-download-small").addEventListener("click", async (e)=>{
      e.stopPropagation();
      const id = e.currentTarget.dataset.id;
      await downloadReciboPDFById(id);
    });
    // delete recibo
    wrapper.querySelector(".btn-delete-small").addEventListener("click", async (e)=>{
      e.stopPropagation();
      const id = e.currentTarget.dataset.id;
      if(!confirm("¿Eliminar este recibo? Esta acción no se puede deshacer.")) return;
      await deleteDoc(doc(db, "recibos", id));
      await cargarHistorial();
      alert("Recibo eliminado");
    });

    historialLista.appendChild(wrapper);
  });
}

// descargar PDF por id
async function downloadReciboPDFById(id){
  const snap = await getDocs(collection(db,"recibos"));
  const docSnap = snap.docs.find(d => d.id === id);
  if(!docSnap) { alert("No encontrado"); return; }
  const r = { id: docSnap.id, ...docSnap.data() };
  // normalize fecha
  r.fecha = r.fecha || (r.createdAt ? (new Date(r.createdAt.seconds*1000).toLocaleString()) : new Date().toLocaleString());
  renderPreviewFactura(r);
  // ensure preview rendered in DOM with id facturaImprimible
  const element = document.getElementById("facturaImprimible") || document.querySelector(".preview-factura");
  if(!element) { alert("Error al preparar PDF"); return; }
  // create PDF
  const canvas = await html2canvas(element, { scale: 2 });
  const imgData = canvas.toDataURL("image/png");
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF('p','mm','a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const imgProps = pdf.getImageProperties(imgData);
  const imgWidth = pageWidth - 20;
  const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
  pdf.addImage(imgData,'PNG',10,10,imgWidth,imgHeight);
  pdf.save(`Recibo_${sanitizeFilename(r.cliente)}_${Date.now()}.pdf`);
}

// exportar historial a excel
btnExportExcel.addEventListener("click", async ()=>{
  const snap = await getDocs(collection(db,"recibos"));
  const rows = snap.docs.map(d=> {
    const o = d.data();
    return {
      id: d.id,
      cliente: o.cliente,
      servicio: o.servicio,
      descripcion: o.descripcion || "",
      metodoPago: o.metodoPago,
      total: o.total,
      fecha: o.fecha || (o.createdAt ? (new Date(o.createdAt.seconds*1000).toLocaleString()) : "")
    };
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Recibos");
  XLSX.writeFile(wb, `Historial_Recibos_${Date.now()}.xlsx`);
});

// borrar historial completo
btnBorrarHistorial.addEventListener("click", async ()=>{
  if(!confirm("¿Borrar TODO el historial de recibos? Esta acción eliminará todos los recibos guardados.")) return;
  const snap = await getDocs(collection(db,"recibos"));
  for(const d of snap.docs) await deleteDoc(doc(db,"recibos", d.id));
  await cargarHistorial();
  alert("Historial borrado");
});

// buscar historial por cliente
buscarHistorial && buscarHistorial.addEventListener("input", (e)=>{
  const q = e.target.value.trim();
  cargarHistorial(q);
});

// load initial
async function init(){
  await cargarProductos();
  await cargarHistorial();
  renderSeleccionados();
}
init();

/* ---------- helpers ---------- */
function escapeHtml(s){ if(!s) return ""; return String(s).replace(/[&<>"']/g, c=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function sanitizeFilename(name){ return name.replace(/[^a-z0-9_\-]/gi,'_'); }
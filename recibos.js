// recibos.js (ESM module)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import * as XLSX from "https://cdn.sheetjs.com/xlsx-latest/package/xlsx.mjs";
import jsPDF from "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm";

// --- Config Firebase (la tuya) ---
const firebaseConfig = {
  apiKey: "AIzaSyBA_i9O3vXzFn2rIKY4XQzll2fLvmD-u3A",
  authDomain: "toperformance-50d5a.firebaseapp.com",
  databaseURL: "https://toperformance-50d5a-default-rtdb.firebaseio.com",
  projectId: "toperformance-50d5a",
  storageBucket: "toperformance-50d5a.appspot.com",
  messagingSenderId: "1020165964748",
  appId: "1:1020165964748:web:f05155f982eb4f2eaf9369"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- Colecciones ---
const COL_INVENTARIO = "inventario";
const COL_RECIBOS = "recibos";
const COL_HISTORIAL = "historial";

// --- DOM refs ---
const selectProducto = document.getElementById("selectProducto");
const btnAgregarLinea = document.getElementById("btnAgregarLinea");
const tablaLineas = document.querySelector("#tablaLineas tbody");
const totalEl = document.getElementById("total");
const clienteEl = document.getElementById("cliente");
const cantidadEl = document.getElementById("cantidad");
const btnGuardarRecibo = document.getElementById("btnGuardarRecibo");
const btnGenerarPDF = document.getElementById("btnGenerarPDF");
const tablaRecibosBody = document.querySelector("#tablaRecibos tbody");
const historialList = document.getElementById("historialList");
const btnLogout = document.getElementById("btn-logout");
const btnVolver = document.getElementById("btn-volver");
const metodoPagoEl = document.getElementById("metodoPago");
const previewContent = document.getElementById("previewContent");

// estado local
let productosCache = [];
let lineas = [];

// --- navegación ---
btnVolver.addEventListener("click", ()=> window.location.href = "index.html");
btnLogout.addEventListener("click", async ()=> { await signOut(auth); window.location.href = "index.html"; });

// --- auth check (redirigir si no hay sesión) ---
onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.href = "index.html";
  } else {
    // cargar datos
    cargarProductosSelect();
    cargarRecibos();
    cargarHistorial();
  }
});

// --- cargar productos al select ---
async function cargarProductosSelect(){
  selectProducto.innerHTML = '<option value="">Selecciona producto</option>';
  productosCache = [];
  const snap = await getDocs(collection(db, COL_INVENTARIO));
  snap.forEach(d=>{
    const p = { id: d.id, ...d.data() };
    productosCache.push(p);
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.dataset.precio = p.precio || 0;
    opt.textContent = `${p.nombre} (${p.cantidad} en stock)`;
    selectProducto.appendChild(opt);
  });
}

// --- agregar linea al recibo ---
btnAgregarLinea.addEventListener("click", ()=>{
  const pid = selectProducto.value;
  const cantidad = Number(cantidadEl.value || 1);
  if(!pid) return alert("Selecciona un producto");
  const producto = productosCache.find(p=> p.id === pid);
  if(!producto) return alert("Producto no encontrado");
  if(cantidad <= 0) return alert("Cantidad inválida");
  if(cantidad > producto.cantidad) return alert("No hay suficiente stock");

  const existente = lineas.find(l=> l.id === pid);
  if(existente){
    existente.cantidad += cantidad;
  } else {
    lineas.push({
      id: producto.id,
      nombre: producto.nombre,
      precio: Number(producto.precio||0),
      cantidad
    });
  }
  renderLineas();
});

// --- render lineas ---
function renderLineas(){
  tablaLineas.innerHTML = "";
  let total = 0;
  lineas.forEach((l, idx)=>{
    const tr = document.createElement("tr");
    const subtotal = l.precio * l.cantidad;
    total += subtotal;
    tr.innerHTML = `
      <td>${l.nombre}</td>
      <td>${l.cantidad}</td>
      <td>$${l.precio.toFixed(2)}</td>
      <td>$${subtotal.toFixed(2)}</td>
      <td><button data-idx="${idx}" class="btn-remove">X</button></td>
    `;
    tablaLineas.appendChild(tr);
  });
  totalEl.textContent = total.toFixed(2);
  renderPreview();
  // attach remove handlers
  document.querySelectorAll(".btn-remove").forEach(b=>{
    b.addEventListener("click", (e)=>{
      const i = Number(e.currentTarget.dataset.idx);
      lineas.splice(i,1);
      renderLineas();
    });
  });
}

// --- preview del recibo ---
function renderPreview(){
  if(lineas.length === 0){
    previewContent.innerHTML = "<div class='small muted'>Aún no hay líneas en el recibo.</div>";
    return;
  }
  const cliente = clienteEl.value || "Cliente";
  let html = `<div><strong>Cliente:</strong> ${cliente}</div><div class="small muted">Fecha: ${new Date().toLocaleString()}</div><hr><table style="width:100%"><tbody>`;
  lineas.forEach(l=>{
    html += `<tr><td>${l.nombre}</td><td style="text-align:right">${l.cantidad} x $${l.precio.toFixed(2)}</td></tr>`;
  });
  html += `</tbody></table><hr><div style="text-align:right"><strong>Total: $${lineas.reduce((s,x)=>s + x.precio*x.cantidad,0).toFixed(2)}</strong></div><div class="muted small mt-2">Gracias por visitar ToPerformance</div>`;
  previewContent.innerHTML = html;
}

// --- guardar recibo, actualizar inventario y registrar historial ---
btnGuardarRecibo.addEventListener("click", async ()=>{
  if(lineas.length === 0) return alert("Agrega al menos un producto al recibo.");
  const cliente = clienteEl.value || "Cliente";
  const metodoPago = metodoPagoEl.value || "Efectivo";

  // crear recibo
  try{
    const recibo = {
      cliente,
      lineas,
      total: lineas.reduce((s,x)=> s + x.precio*x.cantidad, 0),
      metodoPago,
      usuario: (auth.currentUser && auth.currentUser.email) || 'desconocido',
      timestamp: serverTimestamp()
    };
    const rref = await addDoc(collection(db, COL_RECIBOS), recibo);

    // actualizar stock producto por producto (simplemente leer y actualizar)
    for(const l of lineas){
      const pRef = doc(db, COL_INVENTARIO, l.id);
      const pSnap = await getDoc(pRef);
      if(!pSnap.exists()){
        console.warn("Producto no encontrado al actualizar stock:", l.id);
        continue;
      }
      const pData = pSnap.data();
      const nuevoStock = (Number(pData.cantidad) || 0) - Number(l.cantidad);
      await updateDoc(pRef, { cantidad: nuevoStock });
      // registrar en historial
      await addDoc(collection(db, COL_HISTORIAL), {
        accion: `Venta: ${l.nombre} x${l.cantidad}`,
        productoId: l.id,
        usuario: (auth.currentUser && auth.currentUser.email) || 'desconocido',
        timestamp: serverTimestamp()
      });
    }

    alert("Recibo guardado y stock actualizado.");
    // limpiar
    lineas = [];
    renderLineas();
    clienteEl.value = "";
    cargarProductosSelect(); // refrescar select con nuevo stock
    cargarRecibos(); // refrescar lista
    cargarHistorial();
  }catch(err){
    console.error(err);
    alert("Error guardando recibo: " + err.message);
  }
});

// --- generar PDF simple (abre en ventana de impresión) ---
btnGenerarPDF.addEventListener("click", ()=>{
  if(lineas.length === 0) return alert("Agrega líneas antes de generar PDF.");
  const cliente = clienteEl.value || "Cliente";
  const fecha = new Date().toLocaleString();
  let html = `<html><head><title>Recibo</title><style>
    body{font-family:Segoe UI; padding:20px}
    .header{display:flex;gap:12px;align-items:center}
    .logo{height:64px}
    table{width:100%;border-collapse:collapse;margin-top:12px}
    th,td{border:1px solid #ddd;padding:8px;text-align:left}
    .right{text-align:right}
  </style></head><body>`;
  html += `<div class="header"><img src="imagenes/logo1.png" class="logo"><div><h2>ToPerformance</h2><div>Recibo de servicio</div></div></div>`;
  html += `<p><strong>Cliente:</strong> ${cliente} <br><strong>Fecha:</strong> ${fecha}</p>`;
  html += `<table><thead><tr><th>Producto</th><th>Cantidad</th><th>Precio</th><th>Subtotal</th></tr></thead><tbody>`;
  lineas.forEach(l=>{
    html += `<tr><td>${l.nombre}</td><td>${l.cantidad}</td><td>$${l.precio.toFixed(2)}</td><td>$${(l.precio*l.cantidad).toFixed(2)}</td></tr>`;
  });
  html += `</tbody></table><h3 class="right">Total: $${lineas.reduce((s,x)=>s + x.precio*x.cantidad,0).toFixed(2)}</h3>`;
  html += `<div class="muted" style="margin-top:20px">Gracias por visitar <strong>ToPerformance</strong></div>`;
  html += `</body></html>`;

  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
});

// --- cargar recibos guardados ---
async function cargarRecibos(){
  tablaRecibosBody.innerHTML = "";
  const snaps = await getDocs(collection(db, COL_RECIBOS));
  snaps.forEach(d=>{
    const r = d.data();
    const tr = document.createElement("tr");
    const fecha = r.timestamp && r.timestamp.toDate ? r.timestamp.toDate().toLocaleString() : "";
    tr.innerHTML = `
      <td>${r.cliente || ""}</td>
      <td>$${(r.total || 0).toFixed(2)}</td>
      <td>${r.metodoPago || ""}</td>
      <td>${fecha}</td>
      <td>
        <button data-id="${d.id}" class="btn-print">PDF</button>
        <button data-id="${d.id}" class="btn-delete">Eliminar</button>
      </td>
    `;
    tablaRecibosBody.appendChild(tr);
  });

  // attach handlers
  document.querySelectorAll(".btn-print").forEach(b=>{
    b.addEventListener("click", async (e)=>{
      const id = e.currentTarget.dataset.id;
      printReciboById(id);
    });
  });
  document.querySelectorAll(".btn-delete").forEach(b=>{
    b.addEventListener("click", async (e)=>{
      const id = e.currentTarget.dataset.id;
      if(confirm("Eliminar recibo?")) {
        await addDoc(collection(db, COL_HISTORIAL), {
          accion: `Recibo eliminado: ${id}`,
          timestamp: serverTimestamp(),
          usuario: (auth.currentUser && auth.currentUser.email) || 'desconocido'
        });
        await (await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js")).deleteDoc(doc(db, COL_RECIBOS, id)).catch(err=>console.error(err));
        cargarRecibos();
      }
    });
  });
}

// --- imprimir recibo existente ---
async function printReciboById(id){
  const rSnap = await getDoc(doc(db, COL_RECIBOS, id));
  if(!rSnap.exists()) return alert("Recibo no encontrado");
  const r = rSnap.data();
  let html = `<html><head><title>Recibo</title><style>body{font-family:Segoe UI;padding:20px}.logo{height:64px}</style></head><body>`;
  html += `<img src="imagenes/logo1.png" class="logo"><h2>ToPerformance</h2>`;
  html += `<p><strong>Cliente:</strong> ${r.cliente || ""}<br><strong>Fecha:</strong> ${r.timestamp && r.timestamp.toDate ? r.timestamp.toDate().toLocaleString() : ""}</p>`;
  html += `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse"><tr><th>Descripción</th><th>Cant</th><th>Precio</th><th>Total</th></tr>`;
  r.lineas.forEach(l=>{
    html += `<tr><td>${l.nombre}</td><td>${l.cantidad}</td><td>$${l.precio.toFixed(2)}</td><td>$${(l.precio*l.cantidad).toFixed(2)}</td></tr>`;
  });
  html += `</table><h3>Total: $${(r.total||0).toFixed(2)}</h3><p>Gracias por visitar <strong>ToPerformance</strong></p></body></html>`;
  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
  w.print();
}

// --- historial (últimos) ---
async function cargarHistorial(){
  historialList.innerHTML = "";
  const q = query(collection(db, COL_HISTORIAL), orderBy("timestamp","desc"), limit(100));
  const snaps = await getDocs(q);
  snaps.forEach(d=>{
    const h = d.data();
    const li = document.createElement("li");
    const fecha = h.timestamp && h.timestamp.toDate ? h.timestamp.toDate().toLocaleString() : (h.fecha || "");
    li.textContent = `${fecha} — ${h.usuario ? h.usuario + ' — ' : ''}${h.accion}`;
    historialList.appendChild(li);
  });
}

// --- exportar recibos a Excel / PDF (lista) ---
document.getElementById("exportRecibosXLS").addEventListener("click", async ()=>{
  const snaps = await getDocs(collection(db, COL_RECIBOS));
  const rows = [];
  snaps.forEach(s=>{
    const r = s.data();
    rows.push({
      id: s.id,
      cliente: r.cliente,
      total: r.total,
      metodoPago: r.metodoPago,
      fecha: r.timestamp && r.timestamp.toDate ? r.timestamp.toDate().toLocaleString() : ""
    });
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Recibos");
  XLSX.writeFile(wb, "Recibos_ToPerformance.xlsx");
});

document.getElementById("exportRecibosPDF").addEventListener("click", async ()=>{
  const snaps = await getDocs(collection(db, COL_RECIBOS));
  const docpdf = new jsPDF();
  docpdf.text("Recibos - ToPerformance", 10, 10);
  let y = 20;
  snaps.forEach(s=>{
    const r = s.data();
    const line = `${r.cliente || ''} | $${(r.total||0).toFixed(2)} | ${r.metodoPago || ''} | ${r.timestamp && r.timestamp.toDate ? r.timestamp.toDate().toLocaleString() : ''}`;
    docpdf.text(line, 10, y);
    y += 8;
    if(y > 270){ docpdf.addPage(); y = 20; }
  });
  docpdf.save("Recibos_ToPerformance.pdf");
});
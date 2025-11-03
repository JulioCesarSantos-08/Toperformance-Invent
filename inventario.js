import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, updateDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import * as XLSX from "https://cdn.sheetjs.com/xlsx-latest/package/xlsx.mjs";
import jsPDF from "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm";

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

const colRef = collection(db, "inventario");
const historialRef = collection(db, "historial");

// 🔹 Referencias a elementos del DOM
const nombre = document.getElementById("nombre");
const categoria = document.getElementById("categoria");
const cantidad = document.getElementById("cantidad");
const precio = document.getElementById("precio");
const proveedor = document.getElementById("proveedor");
const tablaBody = document.getElementById("tablaBody");
const buscar = document.getElementById("buscar");
const historial = document.getElementById("listaHistorial");

let editId = null;

// 🔹 Cerrar sesión
document.getElementById("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});

// 🔹 Cargar productos
async function cargarProductos() {
  tablaBody.innerHTML = "";
  const querySnapshot = await getDocs(colRef);
  querySnapshot.forEach(docSnap => {
    const data = docSnap.data();
    const fila = document.createElement("tr");
    if (data.cantidad <= 5) fila.classList.add("stock-bajo");

    fila.innerHTML = `
      <td>${data.nombre}</td>
      <td>${data.categoria}</td>
      <td>${data.cantidad}</td>
      <td>$${data.precio}</td>
      <td>${data.proveedor}</td>
      <td>
        <button onclick="editarProducto('${docSnap.id}', '${data.nombre}', '${data.categoria}', ${data.cantidad}, ${data.precio}, '${data.proveedor}')">✏️</button>
        <button onclick="eliminarProducto('${docSnap.id}', '${data.nombre}')">🗑️</button>
      </td>
    `;
    tablaBody.appendChild(fila);
  });
}

cargarProductos();

// 🔹 Agregar producto
document.getElementById("agregarBtn").addEventListener("click", async () => {
  if (!nombre.value || !cantidad.value || !precio.value) return alert("Completa los campos obligatorios.");

  await addDoc(colRef, {
    nombre: nombre.value,
    categoria: categoria.value || "General",
    cantidad: parseInt(cantidad.value),
    precio: parseFloat(precio.value),
    proveedor: proveedor.value || "Desconocido"
  });

  await addDoc(historialRef, {
    accion: `Agregado: ${nombre.value}`,
    fecha: new Date().toLocaleString()
  });

  limpiarCampos();
  cargarProductos();
});

// 🔹 Editar producto
window.editarProducto = (id, nom, cat, cant, prec, prov) => {
  nombre.value = nom;
  categoria.value = cat;
  cantidad.value = cant;
  precio.value = prec;
  proveedor.value = prov;
  editId = id;
  document.getElementById("editarBtn").disabled = false;
};

document.getElementById("editarBtn").addEventListener("click", async () => {
  if (!editId) return alert("Selecciona un producto para editar.");

  const ref = doc(db, "inventario", editId);
  await updateDoc(ref, {
    nombre: nombre.value,
    categoria: categoria.value,
    cantidad: parseInt(cantidad.value),
    precio: parseFloat(precio.value),
    proveedor: proveedor.value
  });

  await addDoc(historialRef, {
    accion: `Editado: ${nombre.value}`,
    fecha: new Date().toLocaleString()
  });

  limpiarCampos();
  cargarProductos();
  document.getElementById("editarBtn").disabled = true;
});

// 🔹 Eliminar producto
window.eliminarProducto = async (id, nombreProd) => {
  if (confirm(`¿Seguro que deseas eliminar "${nombreProd}"?`)) {
    await deleteDoc(doc(db, "inventario", id));
    await addDoc(historialRef, {
      accion: `Eliminado: ${nombreProd}`,
      fecha: new Date().toLocaleString()
    });
    cargarProductos();
  }
};

// 🔹 Buscar producto
buscar.addEventListener("input", async (e) => {
  const texto = e.target.value.toLowerCase();
  tablaBody.querySelectorAll("tr").forEach(row => {
    const nombre = row.children[0].textContent.toLowerCase();
    const categoria = row.children[1].textContent.toLowerCase();
    row.style.display = (nombre.includes(texto) || categoria.includes(texto)) ? "" : "none";
  });
});

// 🔹 Descargar Excel
document.getElementById("descargarExcel").addEventListener("click", async () => {
  const querySnapshot = await getDocs(colRef);
  const datos = [];
  querySnapshot.forEach(doc => datos.push(doc.data()));
  const hoja = XLSX.utils.json_to_sheet(datos);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Inventario");
  XLSX.writeFile(libro, "Inventario_Taller.xlsx");
});

// 🔹 Descargar PDF
document.getElementById("descargarPDF").addEventListener("click", async () => {
  const docPDF = new jsPDF();
  docPDF.text("Inventario - Taller ToPerformance", 10, 10);
  let y = 20;
  const querySnapshot = await getDocs(colRef);
  querySnapshot.forEach((d) => {
    const data = d.data();
    docPDF.text(`${data.nombre} | ${data.categoria} | ${data.cantidad} | $${data.precio}`, 10, y);
    y += 10;
  });
  docPDF.save("Inventario_Taller.pdf");
});

// 🔹 Mostrar historial
async function cargarHistorial() {
  historial.innerHTML = "";
  const querySnapshot = await getDocs(historialRef);
  querySnapshot.forEach(d => {
    const li = document.createElement("li");
    li.textContent = `${d.data().fecha} - ${d.data().accion}`;
    historial.appendChild(li);
  });
}

cargarHistorial();

function limpiarCampos() {
  nombre.value = "";
  categoria.value = "";
  cantidad.value = "";
  precio.value = "";
  proveedor.value = "";
}
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_AUTH_DOMAIN",
  projectId: "TU_PROJECT_ID",
  storageBucket: "TU_STORAGE_BUCKET",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

document.getElementById("logoutBtn").addEventListener("click", () => {
  signOut(auth).then(() => {
    window.location.href = "index.html";
  });
});

document.getElementById("volverInicio").addEventListener("click", () => {
  window.location.href = "inicio.html";
});

const generarBtn = document.getElementById("generarRecibo");
const reciboContainer = document.getElementById("reciboContainer");
const nuevoBtn = document.getElementById("nuevoRecibo");
const pdfBtn = document.getElementById("descargarPDF");

generarBtn.addEventListener("click", () => {
  const cliente = document.getElementById("cliente").value.trim();
  const servicio = document.getElementById("servicio").value.trim();
  const costo = document.getElementById("costo").value.trim();
  const metodo = document.getElementById("metodoPago").value;

  if (!cliente || !servicio || !costo || !metodo) {
    alert("Por favor llena todos los campos.");
    return;
  }

  document.getElementById("rCliente").textContent = cliente;
  document.getElementById("rServicio").textContent = servicio;
  document.getElementById("rCosto").textContent = parseFloat(costo).toFixed(2);
  document.getElementById("rMetodo").textContent = metodo;
  document.getElementById("rFecha").textContent = new Date().toLocaleDateString();

  reciboContainer.classList.remove("oculto");
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
});

nuevoBtn.addEventListener("click", () => {
  document.querySelectorAll("input, select").forEach(el => el.value = "");
  reciboContainer.classList.add("oculto");
});

pdfBtn.addEventListener("click", async () => {
  const { jsPDF } = window.jspdf;
  const recibo = document.getElementById("recibo");
  const canvas = await html2canvas(recibo);
  const imgData = canvas.toDataURL("image/png");

  const pdf = new jsPDF("p", "mm", "a4");
  const width = pdf.internal.pageSize.getWidth();
  const height = (canvas.height * width) / canvas.width;

  pdf.addImage(imgData, "PNG", 0, 0, width, height);
  pdf.save(`Recibo_${document.getElementById("rCliente").textContent}.pdf`);
});
// js/firebase.js
// Inicialización Firebase (compat) — usa la configuración que ya me diste
if (!window.firebase) {
  console.error('Firebase no cargado. Asegúrate de incluir los scripts de Firebase en index.html si usas módulos.');
}

// Cargar SDK (compat) dinámicamente si no lo hiciste en tu index (en este proyecto asumimos que usarás el CDN).
// Si prefieres incluir CDN desde HTML, puedes eliminar la carga dinámica.
(function loadFirebaseSDKs(){
  if(window.firebase && firebase.apps && firebase.apps.length) return;
  const base = 'https://www.gstatic.com/firebasejs/9.22.2/';
  const libs = ['firebase-app-compat.js','firebase-auth-compat.js','firebase-firestore-compat.js','firebase-storage-compat.js'];
  libs.forEach(lib=>{
    const s = document.createElement('script');
    s.src = base + lib;
    s.async = false;
    document.head.appendChild(s);
  });
})();

// Esperar un tick para inicializar (cuando los scripts están listos)
setTimeout(()=> {
  try {
    const firebaseConfig = {
      apiKey: "AIzaSyBA_i9O3vXzFn2rIKY4XQzll2fLvmD-u3A",
      authDomain: "toperformance-50d5a.firebaseapp.com",
      databaseURL: "https://toperformance-50d5a-default-rtdb.firebaseio.com",
      projectId: "toperformance-50d5a",
      storageBucket: "toperformance-50d5a.appspot.com",
      messagingSenderId: "1020165964748",
      appId: "1:1020165964748:web:f05155f982eb4f2eaf9369"
    };

    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }

    window._TP = window._TP || {};
    window._TP.auth = firebase.auth();
    window._TP.db = firebase.firestore();
    window._TP.storage = firebase.storage();
  } catch (e) {
    console.error('Error init firebase:', e);
  }
}, 250);
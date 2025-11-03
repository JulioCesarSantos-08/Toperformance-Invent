// js/login.js
const auth = () => window._TP?.auth;
const db = () => window._TP?.db;

const formLogin = document.getElementById('formLogin');
const loginError = document.getElementById('loginError');
const loginView = document.getElementById('loginView');
const panelView = document.getElementById('panelView');
const userEmailEl = document.getElementById('userEmail');
const btnSignOut = document.getElementById('btnSignOut');
const btnGuest = document.getElementById('btnGuest');

function showError(msg){
  loginError.style.display = 'block';
  loginError.innerText = msg;
  setTimeout(()=> { loginError.style.display = 'none'; }, 6000);
}

async function checkIsAdmin(email){
  try{
    const snap = await db().collection('admins').where('email','==', email).get();
    return !snap.empty;
  } catch(e){
    console.error('checkIsAdmin error', e);
    return false;
  }
}

// Manejo submit login
formLogin.addEventListener('submit', async (ev)=>{
  ev.preventDefault();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  try {
    const res = await auth().signInWithEmailAndPassword(email, password);
    // onAuthStateChanged se encargará del resto
  } catch(err){
    console.error(err);
    showError('Correo o contraseña incorrectos.');
  }
});

// Bot dev (opcional) — elimina en producción
btnGuest.addEventListener('click', ()=> {
  // inicia sesión con cuenta de prueba si la tienes — solo para desarrollo
  const testEmail = 'admin@toperformance.com';
  const testPass = 'Prueba123';
  auth().signInWithEmailAndPassword(testEmail, testPass).catch(()=> showError('No se pudo loguear como demo.'));
});

// Observador de estado
auth().onAuthStateChanged(async user => {
  if(!user){
    // mostrar login
    loginView.style.display = 'block';
    panelView.style.display = 'none';
    return;
  }

  // Verificar que sea admin
  const isAdmin = await checkIsAdmin(user.email);
  if(!isAdmin){
    await auth().signOut();
    showError('Acceso restringido: tu cuenta no tiene permisos de administrador.');
    return;
  }

  // Usuario admin -> mostrar panel
  loginView.style.display = 'none';
  panelView.style.display = 'block';
  userEmailEl.innerText = user.email;
});

// Cerrar sesión
btnSignOut.addEventListener('click', async ()=>{
  await auth().signOut();
  window.location.reload();
});
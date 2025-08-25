document.getElementById('loginForm').addEventListener('submit', function (e) {
e.preventDefault();

const usuario = document.getElementById('usuario').value.trim();
const contrasena = document.getElementById('contrasena').value.trim();
const mensajeError = document.getElementById('mensajeError');

  // Credenciales temporales
const usuarioCorrecto = "admin";
const contrasenaCorrecta = "1234";

if (usuario === usuarioCorrecto && contrasena === contrasenaCorrecta) {
    window.location.href = "inicio.html"; // Redirige al panel
} else {
    mensajeError.classList.remove("hidden");
}
});

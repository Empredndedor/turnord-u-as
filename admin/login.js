document.getElementById('loginForm').addEventListener('submit', function (e) {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const contrasena = document.getElementById('contrasena').value.trim();
  const mensajeError = document.getElementById('mensajeError');

  // Ensure the businesses data is loaded
  if (!window.APP_BUSINESSES || window.APP_BUSINESSES.length === 0) {
    mensajeError.textContent = "Error: No se pudo cargar la lista de negocios.";
    mensajeError.classList.remove("hidden");
    return;
  }

  // Find the business with matching credentials
  const foundBusiness = window.APP_BUSINESSES.find(
    business => business.email === email && business.password === contrasena
  );

  if (foundBusiness) {
    // Store the active business ID in session storage
    sessionStorage.setItem('activeBusinessId', foundBusiness.id);

    // Hide error message and redirect
    mensajeError.classList.add("hidden");
    window.location.href = "inicio.html"; // Redirect to the main panel
  } else {
    // Show error message
    mensajeError.textContent = "Correo o contraseña incorrectos.";
    mensajeError.classList.remove("hidden");
  }
});

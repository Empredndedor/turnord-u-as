// Configuración del panel administrativo
document.addEventListener('DOMContentLoaded', function() {
    // Obtener elementos del DOM
    const sidebar = document.getElementById('sidebar');
    const colorBtns = document.querySelectorAll('.color-btn');
    
    // Mapa de colores con sus clases correspondientes
    const colorMap = {
        'blue-900': 'bg-blue-900',
        'green-700': 'bg-green-700',
        'red-700': 'bg-red-700',
        'purple-800': 'bg-purple-800',
        'gray-800': 'bg-gray-800',
        'pink-600': 'bg-pink-600',
        'orange-600': 'bg-orange-600',
        'yellow-600': 'bg-yellow-600',
        'cyan-700': 'bg-cyan-700',
        'indigo-700': 'bg-indigo-700'
    };
    
    // Mapa de colores para hover
    const hoverMap = {
        'blue-900': 'hover:text-blue-200',
        'green-700': 'hover:text-green-200',
        'red-700': 'hover:text-red-200',
        'purple-800': 'hover:text-purple-200',
        'gray-800': 'hover:text-gray-200',
        'pink-600': 'hover:text-pink-200',
        'orange-600': 'hover:text-orange-200',
        'yellow-600': 'hover:text-yellow-200',
        'cyan-700': 'hover:text-cyan-200',
        'indigo-700': 'hover:text-indigo-200'
    };
    
    // Cargar color guardado
    const savedColor = localStorage.getItem('sidebarColor') || 'blue-900';
    
    // Aplicar color guardado al sidebar
    applyColor(savedColor);
    
    // Marcar el botón del color actual como seleccionado
    highlightSelectedColor(savedColor);
    
    // Agregar event listeners a los botones de color
    colorBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const color = this.getAttribute('data-color');
            applyColor(color);
            highlightSelectedColor(color);
            localStorage.setItem('sidebarColor', color);
            
            // Mostrar mensaje de confirmación
            showConfirmation(color);
        });
    });
    
    // Función para aplicar el color al sidebar
    function applyColor(color) {
        if (!sidebar || !colorMap[color]) return;
        
        // Remover todas las clases de color del sidebar
        Object.values(colorMap).forEach(cls => {
            sidebar.classList.remove(cls);
        });
        
        // Agregar la clase del color seleccionado
        sidebar.classList.add(colorMap[color]);
        
        // Actualizar los hover de los enlaces
        updateNavLinks(color);
    }
    
    // Función para actualizar los hover de los enlaces
    function updateNavLinks(color) {
        const navLinks = sidebar.querySelectorAll('nav a:not([href="cierre.html"])');
        
        navLinks.forEach(link => {
            // Remover todos los hover
            Object.values(hoverMap).forEach(cls => {
                link.classList.remove(cls);
            });
            
            // Agregar el hover correspondiente al color
            link.classList.add(hoverMap[color]);
        });
    }
    
    // Función para resaltar el botón del color seleccionado
    function highlightSelectedColor(color) {
        colorBtns.forEach(btn => {
            const btnColor = btn.getAttribute('data-color');
            const parent = btn.closest('.color-option');
            
            if (btnColor === color) {
                parent.classList.add('ring-4', 'ring-offset-2', 'ring-offset-gray-100');
                btn.classList.add('ring-2', 'ring-white');
            } else {
                parent.classList.remove('ring-4', 'ring-offset-2', 'ring-offset-gray-100');
                btn.classList.remove('ring-2', 'ring-white');
            }
        });
    }
    
    // Función para mostrar mensaje de confirmación
    function showConfirmation(color) {
        // Crear elemento de mensaje
        const message = document.createElement('div');
        message.className = 'fixed bottom-4 right-4 bg-white shadow-lg rounded-lg px-4 py-3 flex items-center transition-opacity duration-500';
        message.style.opacity = '0';
        
        // Obtener el nombre del color
        const colorName = document.querySelector(`[data-color="${color}"] + p`).textContent;
        
        // Crear icono de verificación
        const icon = document.createElement('div');
        icon.className = `w-8 h-8 rounded-full ${colorMap[color]} flex items-center justify-center mr-3`;
        icon.innerHTML = '<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
        
        // Crear texto del mensaje
        const text = document.createElement('div');
        text.innerHTML = `<p class="font-medium">Color actualizado</p><p class="text-sm text-gray-600">Se ha aplicado el color ${colorName} a todas las páginas</p>`;
        
        // Agregar elementos al mensaje
        message.appendChild(icon);
        message.appendChild(text);
        
        // Agregar mensaje al body
        document.body.appendChild(message);
        
        // Mostrar mensaje con animación
        setTimeout(() => {
            message.style.opacity = '1';
        }, 10);
        
        // Ocultar mensaje después de 3 segundos
        setTimeout(() => {
            message.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(message);
            }, 500);
        }, 3000);
    }
});
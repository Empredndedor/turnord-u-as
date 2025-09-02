// Configuración del panel administrativo
document.addEventListener('DOMContentLoaded', function() {
    const colorBtns = document.querySelectorAll('.color-btn');
    
    function highlightSelectedColor(color) {
        colorBtns.forEach(btn => {
            const btnColor = btn.getAttribute('data-color');
            const parent = btn.closest('.color-option');
            
            if (btnColor === color) {
                parent.classList.add('ring-4', 'ring-offset-2', 'ring-offset-gray-100', 'ring-blue-500');
                btn.classList.add('ring-2', 'ring-white');
            } else {
                parent.classList.remove('ring-4', 'ring-offset-2', 'ring-offset-gray-100', 'ring-blue-500');
                btn.classList.remove('ring-2', 'ring-white');
            }
        });
    }
    
    // Highlight the currently saved color on page load
    const savedColor = localStorage.getItem('sidebarColor') || 'indigo-700';
    highlightSelectedColor(savedColor);

    // Add event listeners to color buttons
    colorBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const color = this.getAttribute('data-color');
            // Simply save the color. The panel-styler.js script will detect the change and apply it.
            localStorage.setItem('sidebarColor', color);
            highlightSelectedColor(color);
        });
    });
});
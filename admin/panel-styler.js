document.addEventListener('DOMContentLoaded', function() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

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

    // Set 'indigo-700' as the default color
    const savedColor = localStorage.getItem('sidebarColor') || 'indigo-700';

    function applyColor(color) {
        if (!sidebar || !colorMap[color]) return;

        Object.values(colorMap).forEach(cls => {
            sidebar.classList.remove(cls);
        });

        sidebar.classList.add(colorMap[color]);
        updateNavLinks(color);
    }

    function updateNavLinks(color) {
        const navLinks = sidebar.querySelectorAll('nav a:not([href="cierre.html"])');

        navLinks.forEach(link => {
            Object.values(hoverMap).forEach(cls => {
                link.classList.remove(cls);
            });

            link.classList.add(hoverMap[color]);
        });
    }

    function highlightActiveLink() {
        sidebar.querySelectorAll('nav a').forEach(link => {
            // Use a more robust check for the active page
            if (window.location.pathname.includes(link.getAttribute('href'))) {
                // These classes should look good on any theme color
                link.classList.add('bg-black', 'bg-opacity-20', 'font-semibold', 'shadow-inner');
            } else {
                link.classList.remove('bg-black', 'bg-opacity-20', 'font-semibold', 'shadow-inner');
            }
        });
    }

    applyColor(savedColor);
    highlightActiveLink();

    // Listen for changes from other tabs (e.g., the config page)
    window.addEventListener('storage', (e) => {
        if (e.key === 'sidebarColor') {
            applyColor(e.newValue || 'indigo-700');
        }
    });
});

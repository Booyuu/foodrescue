(() => {
  const root = document.documentElement;
  const savedTheme = localStorage.getItem('cfr-theme');
  if (savedTheme) root.dataset.theme = savedTheme;

  const themeButton = document.querySelector('.theme-toggle');
  const refreshThemeIcon = () => {
    if (themeButton) themeButton.innerHTML = `<i class="fa-solid fa-${root.dataset.theme === 'dark' ? 'sun' : 'moon'}"></i>`;
  };
  refreshThemeIcon();
  themeButton?.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('cfr-theme', root.dataset.theme);
    refreshThemeIcon();
  });

  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');
  navToggle?.addEventListener('click', () => {
    navLinks.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', navLinks.classList.contains('open'));
  });

  document.querySelectorAll('.flash button').forEach((button) => button.addEventListener('click', () => button.parentElement.remove()));
  document.querySelectorAll('.flash').forEach((message) => setTimeout(() => message.remove(), 5500));
  document.querySelectorAll('form[data-confirm]').forEach((form) => form.addEventListener('submit', (event) => {
    if (!window.confirm(form.dataset.confirm)) event.preventDefault();
  }));
  document.querySelectorAll('.password-toggle').forEach((button) => button.addEventListener('click', () => {
    const input = button.parentElement.querySelector('input');
    input.type = input.type === 'password' ? 'text' : 'password';
    button.innerHTML = `<i class="fa-regular fa-eye${input.type === 'password' ? '' : '-slash'}"></i>`;
  }));

  function countdownText(expiry) {
    const difference = new Date(expiry).getTime() - Date.now();
    if (difference <= 0) return { text: 'Expired', urgent: true };
    const minutes = Math.floor(difference / 60000);
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const mins = minutes % 60;
    if (days > 0) return { text: `${days}d ${hours}h left`, urgent: days < 1 };
    if (hours > 0) return { text: `${hours}h ${mins}m left`, urgent: hours < 3 };
    return { text: `${Math.max(1, mins)}m left`, urgent: true };
  }
  const countdowns = document.querySelectorAll('[data-expiry]');
  const updateCountdowns = () => countdowns.forEach((element) => {
    const result = countdownText(element.dataset.expiry);
    const icon = element.classList.contains('expiry-pill') ? '<i class="fa-regular fa-clock"></i> ' : '';
    element.innerHTML = `${icon}${result.text}`;
    element.classList.toggle('urgent', result.urgent);
  });
  updateCountdowns();
  if (countdowns.length) setInterval(updateCountdowns, 30000);

  const filterPanel = document.querySelector('.filter-panel');
  document.querySelector('.mobile-filter')?.addEventListener('click', () => filterPanel.classList.add('open'));
  document.querySelector('.filter-close')?.addEventListener('click', () => filterPanel.classList.remove('open'));

  const imageInput = document.querySelector('.upload-box input');
  imageInput?.addEventListener('change', () => {
    if (!imageInput.files[0]) return;
    const preview = document.querySelector('.upload-preview');
    preview.innerHTML = `<img src="${URL.createObjectURL(imageInput.files[0])}" alt="Selected food image">`;
  });

  document.querySelector('#locate-me')?.addEventListener('click', () => {
    const status = document.querySelector('#location-status');
    if (!navigator.geolocation) { status.textContent = 'Location is not supported by this browser.'; return; }
    status.textContent = 'Finding your location…';
    navigator.geolocation.getCurrentPosition((position) => {
      document.querySelector('#latitude').value = position.coords.latitude.toFixed(7);
      document.querySelector('#longitude').value = position.coords.longitude.toFixed(7);
      status.textContent = 'Location added successfully.';
    }, () => { status.textContent = 'We could not access your location. You can still enter the address manually.'; });
  });

  const mapElement = document.querySelector('#pickup-map');
  if (mapElement && window.L) {
    const lat = Number(mapElement.dataset.lat);
    const lng = Number(mapElement.dataset.lng);
    const map = L.map(mapElement).setView([lat, lng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
    L.marker([lat, lng]).addTo(map).bindPopup(mapElement.dataset.title).openPopup();
  }

  const chartCanvas = document.querySelector('#impact-chart');
  if (chartCanvas && window.Chart) {
    const data = JSON.parse(chartCanvas.dataset.chart || '[]');
    new Chart(chartCanvas, {
      type: 'bar',
      data: {
        labels: data.map((item) => item.month),
        datasets: [
          { label: 'Donations', data: data.map((item) => item.donations), backgroundColor: '#4f7c65', borderRadius: 7 },
          { label: 'Meals saved', data: data.map((item) => item.meals), backgroundColor: '#e9b949', borderRadius: 7 }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 } } } }
    });
  }
})();

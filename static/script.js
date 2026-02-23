// ═══════════════════════════════════════════════════════════
//  STARS, METEORS, SCROLL
// ═══════════════════════════════════════════════════════════
(function() {
    const c = document.getElementById('stars');
    if (c) {
        for (let i = 0; i < 160; i++) {
            const s = document.createElement('div');
            s.className = 'star';
            const sz = (Math.random() * 2.5 + 0.5) + 'px';
            s.style.cssText = `width:${sz};height:${sz};left:${Math.random() * 100}%;top:${Math.random() * 100}%;animation-delay:${Math.random() * 3}s;animation-duration:${(Math.random() * 2 + 2)}s`;
            c.appendChild(s);
        }
    }
})();

setInterval(() => {
    const m = document.createElement('div');
    m.className = 'meteor';
    m.style.left = Math.random() * 80 + '%';
    m.style.top = Math.random() * 40 + '%';
    document.body.appendChild(m);
    setTimeout(() => m.remove(), 2000);
}, 3200);

window.addEventListener('scroll', () => {
    const p = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight) * 100;
    document.getElementById('scrollBar').style.width = p + '%';
    const y = window.scrollY;
    const stars = document.getElementById('stars');
    if (stars) stars.style.transform = `translateY(${y * 0.15}px)`;
});

// ═══════════════════════════════════════════════════════════
//  THEME
// ═══════════════════════════════════════════════════════════
function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme');
    const nt = cur === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', nt);
    localStorage.setItem('theme', nt);
    document.getElementById('ticon').textContent = nt === 'light' ? '☀️' : '🌙';
    document.getElementById('ttext').textContent = nt === 'light' ? 'Светлая' : 'Тёмная';
}

(function() {
    const t = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', t);
    if (t === 'light') {
        document.getElementById('ticon').textContent = '☀️';
        document.getElementById('ttext').textContent = 'Светлая';
    }
})();

function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    window.scrollTo(0, 0);

    if (id === 'cme') initCMEChart();
    if (id === 'geomagnetic') initGeoChart();
    if (id === 'solarwind') initWindChart();
}

// ═══════════════════════════════════════════════════════════
//  GEOLOCATION
// ═══════════════════════════════════════════════════════════
let userLat = 55.75,
    userLon = 37.61;

function initGeolocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                userLat = pos.coords.latitude;
                userLon = pos.coords.longitude;
                document.getElementById('userLocation').textContent = `${userLat.toFixed(2)}°, ${userLon.toFixed(2)}°`;
                updateAuroraMap();
                updatePersonal();
            },
            () => {
                document.getElementById('userLocation').textContent = 'Москва (~55.75°)';
                updateAuroraMap();
            }
        );
    } else {
        document.getElementById('userLocation').textContent = 'Москва (~55.75°)';
    }
}

function updatePersonal() {
    const kp = parseFloat(document.getElementById('kpIndex').textContent) || 3.3;
    const lat = Math.abs(userLat);
    const notice = document.getElementById('personalNotice');
    const txt = document.getElementById('noticeText');

    if (kp >= 6 && lat > 50 && lat < 72) {
        txt.innerHTML = `<strong>Kp = ${kp}</strong> — высокая вероятность полярных сияний на вашей широте (${userLat.toFixed(1)}°). Лучшее время наблюдения: после 22:00.`;
        notice.style.display = 'block';
    } else if (kp >= 5 && lat > 42) {
        txt.innerHTML = `<strong>Kp = ${kp}</strong> — возможны слабые сияния у горизонта.`;
        notice.style.display = 'block';
    } else {
        notice.style.display = 'none';
    }
}


// ═══════════════════════════════════════════════════════════
//  AURORA MAP
// ═══════════════════════════════════════════════════════════
let auroraMap;

function initAuroraMap() {
    const mapContainer = document.getElementById('aurora-map');
    if (!mapContainer) return;

    mapContainer.innerHTML = '';

    try {
        auroraMap = L.map('aurora-map').setView([65, 100], 2);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap'
        }).addTo(auroraMap);

        // Северные зоны
        L.circle([70, 0], {
            color: '#22d3a3',
            fillColor: '#22d3a3',
            fillOpacity: 0.15,
            radius: 500000
        }).addTo(auroraMap).bindTooltip('Kp 3-4');

        L.circle([65, 30], {
            color: '#fbbf24',
            fillColor: '#fbbf24',
            fillOpacity: 0.15,
            radius: 800000
        }).addTo(auroraMap).bindTooltip('Kp 5-6');

        L.circle([60, 60], {
            color: '#f87171',
            fillColor: '#f87171',
            fillOpacity: 0.15,
            radius: 1200000
        }).addTo(auroraMap).bindTooltip('Kp 7+');

        // Южные зоны
        L.circle([-70, 0], {
            color: '#22d3a3',
            fillColor: '#22d3a3',
            fillOpacity: 0.15,
            radius: 500000
        }).addTo(auroraMap);

        L.circle([-65, 30], {
            color: '#fbbf24',
            fillColor: '#fbbf24',
            fillOpacity: 0.15,
            radius: 800000
        }).addTo(auroraMap);

        L.circle([-60, 60], {
            color: '#f87171',
            fillColor: '#f87171',
            fillOpacity: 0.15,
            radius: 1200000
        }).addTo(auroraMap);

        updateAuroraMap();
    } catch (e) {
        console.error('Map error:', e);
    }
}

function updateAuroraMap() {
    if (!auroraMap) return;

    if (window.userMarker) {
        auroraMap.removeLayer(window.userMarker);
    }

    window.userMarker = L.marker([userLat, userLon], {
        icon: L.divIcon({
            className: 'custom-marker',
            html: '📍',
            iconSize: [20, 20]
        })
    }).addTo(auroraMap).bindTooltip('Вы здесь');
}

// ═══════════════════════════════════════════════════════════
//  3D EARTH
// ═══════════════════════════════════════════════════════════
let earthScene, earthCamera, earthRenderer, earthMesh;

function initEarth() {
    const container = document.getElementById('earth-container');
    if (!container) return;

    container.innerHTML = '';

    try {
        earthScene = new THREE.Scene();
        earthScene.background = new THREE.Color(0x0a0f24);

        const width = container.clientWidth;
        const height = container.clientHeight;
        earthCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        earthCamera.position.set(0, 0, 8);

        earthRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        earthRenderer.setSize(width, height);
        earthRenderer.setClearColor(0x0a0f24);
        container.appendChild(earthRenderer.domElement);

        // Текстура Земли
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#1a4d8c';
        ctx.fillRect(0, 0, 512, 256);

        ctx.fillStyle = '#3a7e3a';
        ctx.fillRect(280, 80, 150, 60);
        ctx.fillRect(320, 60, 80, 30);
        ctx.fillRect(300, 140, 60, 50);
        ctx.fillRect(80, 70, 100, 50);
        ctx.fillRect(60, 50, 60, 30);
        ctx.fillRect(120, 160, 50, 60);
        ctx.fillRect(440, 180, 50, 40);

        const texture = new THREE.CanvasTexture(canvas);

        const geometry = new THREE.SphereGeometry(2, 64, 64);
        const material = new THREE.MeshPhongMaterial({
            map: texture,
            shininess: 5
        });
        earthMesh = new THREE.Mesh(geometry, material);
        earthScene.add(earthMesh);

        const ambientLight = new THREE.AmbientLight(0x404060);
        earthScene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 3, 5);
        earthScene.add(directionalLight);

        // Звезды
        const starsGeometry = new THREE.BufferGeometry();
        const starsCount = 1000;
        const starsPositions = new Float32Array(starsCount * 3);
        for (let i = 0; i < starsCount * 3; i += 3) {
            starsPositions[i] = (Math.random() - 0.5) * 200;
            starsPositions[i + 1] = (Math.random() - 0.5) * 200;
            starsPositions[i + 2] = (Math.random() - 0.5) * 200;
        }
        starsGeometry.setAttribute('position', new THREE.BufferAttribute(starsPositions, 3));
        const starsMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.1 });
        const stars = new THREE.Points(starsGeometry, starsMaterial);
        earthScene.add(stars);

        function animate() {
            requestAnimationFrame(animate);

            if (earthMesh) {
                earthMesh.rotation.y += 0.001;
            }

            if (earthRenderer && earthScene && earthCamera) {
                earthRenderer.render(earthScene, earthCamera);
            }
        }

        animate();

    } catch (e) {
        console.error('Earth 3D error:', e);
        container.innerHTML = '<div style="color:white; text-align:center; padding:100px;">3D Земля</div>';
    }
}

// ═══════════════════════════════════════════════════════════
//  CME ANIMATION
// ═══════════════════════════════════════════════════════════
let cmeAnimRunning = false;

function initCMEAnim() {
    const canvas = document.getElementById('cme-canvas');
    if (!canvas || cmeAnimRunning) return;

    cmeAnimRunning = true;

    const ctx = canvas.getContext('2d');
    const resize = () => {
        canvas.width = canvas.clientWidth || 800;
        canvas.height = canvas.clientHeight || 460;
    };
    resize();
    window.addEventListener('resize', resize);

    const W = canvas.width,
        H = canvas.height;
    const sunX = 80,
        sunY = H / 2;
    const earthX = W - 80,
        earthY = H / 2;

    const particles = [];
    for (let i = 0; i < 40; i++) {
        particles.push({
            x: sunX + (Math.random() - 0.5) * 20,
            y: sunY + (Math.random() - 0.5) * 30,
            vx: 0.5 + Math.random() * 2,
            vy: (Math.random() - 0.5) * 1.5,
            size: 1 + Math.random() * 3,
            opacity: 0.3 + Math.random() * 0.7
        });
    }

    function draw() {
        if (!cmeAnimRunning) return;

        requestAnimationFrame(draw);

        ctx.clearRect(0, 0, W, H);

        // Солнце
        ctx.beginPath();
        ctx.arc(sunX, sunY, 35, 0, Math.PI * 2);
        const sunGrad = ctx.createRadialGradient(sunX - 5, sunY - 5, 5, sunX, sunY, 40);
        sunGrad.addColorStop(0, '#fbbf24');
        sunGrad.addColorStop(1, '#f97316');
        ctx.fillStyle = sunGrad;
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 30;
        ctx.fill();

        // Земля
        ctx.beginPath();
        ctx.arc(earthX, earthY, 25, 0, Math.PI * 2);
        const earthGrad = ctx.createRadialGradient(earthX - 5, earthY - 5, 5, earthX, earthY, 30);
        earthGrad.addColorStop(0, '#3b82f6');
        earthGrad.addColorStop(1, '#1e3a8a');
        ctx.fillStyle = earthGrad;
        ctx.shadowColor = '#3b82f6';
        ctx.fill();

        ctx.shadowBlur = 0;

        // Частицы CME
        particles.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(248, 113, 113, ${p.opacity})`;
            ctx.fill();

            p.x += p.vx;
            p.y += p.vy;
            p.opacity *= 0.995;

            if (p.x > earthX || p.opacity < 0.01) {
                p.x = sunX;
                p.y = sunY + (Math.random() - 0.5) * 40;
                p.vx = 0.5 + Math.random() * 2.5;
                p.vy = (Math.random() - 0.5) * 1.5;
                p.opacity = 0.5 + Math.random() * 0.5;
            }
        });

        // Линия пути
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.setLineDash([5, 5]);
        ctx.moveTo(sunX + 40, sunY);
        ctx.lineTo(earthX - 30, earthY);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    draw();
}

// ═══════════════════════════════════════════════════════════
//  CHARTS
// ═══════════════════════════════════════════════════════════
let cmeChart, geoChart, windChart;

function initCMEChart() {
    const ctx = document.getElementById('cmeChart');
    if (!ctx) return;

    if (cmeChart) cmeChart.destroy();

    cmeChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['18.02', '17.02', '16.02', '15.02', '14.02'],
            datasets: [{
                label: 'Скорость CME (км/с)',
                data: [420, 380, 510, 350, 290],
                borderColor: '#f97316',
                backgroundColor: 'rgba(249,115,22,0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { labels: { color: '#8899bb' } }
            },
            scales: {
                y: {
                    ticks: { color: '#8899bb' },
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    title: { display: true, text: 'км/с', color: '#8899bb' }
                },
                x: { ticks: { color: '#8899bb' }, grid: { color: 'rgba(255,255,255,0.1)' } }
            }
        }
    });
}

function initGeoChart() {
    const ctx = document.getElementById('geoChart');
    if (!ctx) return;

    if (geoChart) geoChart.destroy();

    const hours = [];
    const values = [];
    for (let i = 0; i < 24; i++) {
        hours.push(`${i}:00`);
        values.push(2 + Math.random() * 2);
    }

    geoChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: hours,
            datasets: [{
                label: 'Kp-индекс',
                data: values,
                borderColor: '#22d3a3',
                backgroundColor: 'rgba(34,211,163,0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { labels: { color: '#8899bb' } }
            },
            scales: {
                y: {
                    min: 0,
                    max: 9,
                    ticks: { color: '#8899bb' },
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    title: { display: true, text: 'Kp индекс', color: '#8899bb' }
                },
                x: { ticks: { color: '#8899bb' }, grid: { color: 'rgba(255,255,255,0.1)' } }
            }
        }
    });
}

function initWindChart() {
    const ctx = document.getElementById('windChart');
    if (!ctx) return;

    if (windChart) windChart.destroy();

    const hours = [];
    const speeds = [];
    for (let i = 0; i < 48; i++) {
        hours.push(`${i}h`);
        speeds.push(380 + Math.random() * 80);
    }

    windChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: hours,
            datasets: [{
                label: 'Скорость (км/с)',
                data: speeds,
                borderColor: '#fbbf24',
                backgroundColor: 'rgba(251,191,36,0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { labels: { color: '#8899bb' } }
            },
            scales: {
                y: {
                    ticks: { color: '#8899bb' },
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    title: { display: true, text: 'км/с', color: '#8899bb' }
                },
                x: { ticks: { color: '#8899bb', maxRotation: 45 }, grid: { color: 'rgba(255,255,255,0.1)' } }
            }
        }
    });
}
// ═══════════════════════════════════════════════════════════
//  DATA LOADING (РЕАЛЬНЫЕ ДАННЫЕ)
// ═══════════════════════════════════════════════════════════
async function loadAllData() {
    const loading = document.getElementById('loadingIndicator');
    const updateBtn = document.querySelector('.btn');
    const originalText = updateBtn ? updateBtn.textContent : 'Обновить данные';

    if (loading) loading.style.display = 'block';
    if (updateBtn) {
        updateBtn.textContent = 'Обновление...';
        updateBtn.disabled = true;
    }

    try {
        // ШАГ 1: Запускаем обновление данных через API
        const updateResponse = await fetch('/api/update-data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!updateResponse.ok) {
            console.warn('Не удалось запустить обновление, загружаем существующие данные');
        } else {
            const updateResult = await updateResponse.json();
            console.log('Обновление запущено:', updateResult);

            // Ждем немного, чтобы данные успели обновиться
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // ШАГ 2: Загружаем обновленные данные из JSON файла
        const response = await fetch('/static/space_weather_data.json?t=' + Date.now());
        const data = await response.json();

        // Обновляем все элементы интерфейса
        updateInterfaceWithData(data);

        // Обновляем время последнего обновления
        const lastUpdate = document.getElementById('lastUpdate');
        if (lastUpdate) {
            lastUpdate.textContent = `Данные обновлены: ${data.last_update}`;
        }

    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        const lastUpdate = document.getElementById('lastUpdate');
        if (lastUpdate) {
            lastUpdate.textContent = `Ошибка загрузки данных: ${new Date().toLocaleString('ru-RU')}`;
        }
    } finally {
        if (loading) loading.style.display = 'none';
        if (updateBtn) {
            updateBtn.textContent = originalText;
            updateBtn.disabled = false;
        }
    }
}
// ═══════════════════════════════════════════════════════════
//  ОБНОВЛЕНИЕ ИНТЕРФЕЙСА
// ═══════════════════════════════════════════════════════════
function updateInterfaceWithData(data) {
    // Обновляем Kp индекс и статусы
    const kpIndex = document.getElementById('kpIndex');
    const kpStatus = document.getElementById('kpStatus');
    const kpStatusBadge = document.getElementById('kpStatusBadge');
    const rangeKp = document.getElementById('rangeKp');
    const rangeKpStatus = document.getElementById('rangeKpStatus');

    if (kpIndex) kpIndex.textContent = data.kp.current;
    if (kpStatus) kpStatus.textContent = data.kp.status_text;
    if (kpStatusBadge) {
        kpStatusBadge.textContent = data.kp.status_text;
        kpStatusBadge.className = `current-status ${data.kp.status_badge}`;
    }
    if (rangeKp) rangeKp.textContent = data.kp.current;
    if (rangeKpStatus) {
        rangeKpStatus.innerHTML = data.kp.status_text;
        rangeKpStatus.className = data.kp.status_badge;
    }

    // Обновляем CME
    const cmeCount = document.getElementById('cmeCount');
    const cmeSpeed = document.getElementById('cmeSpeed');
    const cmeStatus = document.getElementById('cmeStatus');
    const rangeCme = document.getElementById('rangeCme');
    const rangeCmeStatus = document.getElementById('rangeCmeStatus');

    if (cmeCount) cmeCount.textContent = data.cme.count;
    if (cmeSpeed) cmeSpeed.textContent = data.cme.max_speed + ' км/с';
    if (cmeStatus) {
        cmeStatus.textContent = data.cme.status_text;
        cmeStatus.className = `current-status ${data.cme.status_badge}`;
    }
    if (rangeCme) rangeCme.textContent = `${data.cme.count} события`;
    if (rangeCmeStatus) {
        rangeCmeStatus.innerHTML = data.cme.status_text;
        rangeCmeStatus.className = data.cme.status_badge;
    }

    // Обновляем вспышки
    const flareCount = document.getElementById('flareCount');
    const flareClass = document.getElementById('flareClass');
    const flaresStatus = document.getElementById('flaresStatus');
    const rangeFlare = document.getElementById('rangeFlare');
    const rangeFlareStatus = document.getElementById('rangeFlareStatus');

    if (flareCount) flareCount.textContent = data.flares.count;
    if (flareClass) flareClass.textContent = data.flares.strongest_class_display;
    if (flaresStatus) {
        flaresStatus.textContent = data.flares.status_text;
        flaresStatus.className = `current-status ${data.flares.status_badge}`;
    }
    if (rangeFlare) rangeFlare.textContent = `${data.flares.count} событий`;
    if (rangeFlareStatus) {
        rangeFlareStatus.innerHTML = data.flares.status_text;
        rangeFlareStatus.className = data.flares.status_badge;
    }

    // Обновляем солнечный ветер
    const windSpeed = document.getElementById('windSpeed');
    const windDensity = document.getElementById('windDensity');
    const windStatus = document.getElementById('windStatus');
    const rangeWind = document.getElementById('rangeWind');
    const rangeWindStatus = document.getElementById('rangeWindStatus');

    if (windSpeed) windSpeed.textContent = data.solar_wind.speed + ' км/с';
    if (windDensity) windDensity.textContent = data.solar_wind.density + ' p/см³';
    if (windStatus) {
        windStatus.textContent = data.solar_wind.status_text;
        windStatus.className = `current-status ${data.solar_wind.status_badge}`;
    }
    if (rangeWind) rangeWind.textContent = `${data.solar_wind.speed} км/с`;
    if (rangeWindStatus) {
        rangeWindStatus.innerHTML = data.solar_wind.status_text;
        rangeWindStatus.className = data.solar_wind.status_badge;
    }

    // Обновляем солнечные пятна
    const sunspotNumber = document.getElementById('sunspotNumber');
    const sunStatus = document.getElementById('sunStatus');
    const rangeSun = document.getElementById('rangeSun');
    const rangeSunStatus = document.getElementById('rangeSunStatus');

    if (sunspotNumber) sunspotNumber.textContent = data.sun.display;
    if (sunStatus) {
        sunStatus.textContent = data.sun.status_text;
        sunStatus.className = `current-status ${data.sun.status_badge}`;
    }
    if (rangeSun) rangeSun.textContent = data.sun.display;
    if (rangeSunStatus) {
        rangeSunStatus.innerHTML = data.sun.status_text;
        rangeSunStatus.className = data.sun.status_badge;
    }

    // Обновляем события
    const eventsCount = document.getElementById('eventsCount');
    const eventsStatus = document.getElementById('eventsStatus');
    const rangeGeneral = document.getElementById('rangeGeneral');
    const rangeGeneralStatus = document.getElementById('rangeGeneralStatus');

    if (eventsCount) eventsCount.textContent = data.eventsCount;
    if (eventsStatus) {
        eventsStatus.textContent = data.overall_status === 'warning' ? 'Повышенная активность' : 'Умеренная активность';
        eventsStatus.className = `current-status status-${data.overall_status}`;
    }
    if (rangeGeneral) rangeGeneral.textContent = data.overall_status === 'warning' ? 'Повышенная' : 'Средняя';
    if (rangeGeneralStatus) {
        rangeGeneralStatus.innerHTML = data.overall_status === 'warning' ? 'Повышенная активность' : 'Умеренная активность';
        rangeGeneralStatus.className = `status-${data.overall_status}`;
    }

    // Обновляем прогнозы
    const flareProb = document.getElementById('flareProb');
    const kpForecast = document.getElementById('kpForecast');
    const auroraProb = document.getElementById('auroraProb');

    if (flareProb) flareProb.textContent = data.flareProb;
    if (kpForecast) kpForecast.textContent = data.kpForecast;
    if (auroraProb) auroraProb.textContent = data.auroraProb;

    // Обновляем таблицу сравнения
    updateComparisonTable(data.comparison);

    // Обновляем персональные рекомендации
    updatePersonalWithData(data);

    // Обновляем сообщение о CME в пути
    const cmeInTransit = document.getElementById('cmeInTransit');
    if (cmeInTransit) cmeInTransit.textContent = data.cme.message || 'Нет данных о CME в пути';
}

// ═══════════════════════════════════════════════════════════
//  ОБНОВЛЕНИЕ ТАБЛИЦЫ СРАВНЕНИЯ
// ═══════════════════════════════════════════════════════════
function updateComparisonTable(comp) {
    // CME
    const cCmeNow = document.getElementById('c-cme-now');
    const cCmeAvg = document.getElementById('c-cme-avg');
    const cCmeDiff = document.getElementById('c-cme-diff');
    const cCmeDyn = document.getElementById('c-cme-dyn');

    if (cCmeNow) cCmeNow.textContent = comp.cme.now;
    if (cCmeAvg) cCmeAvg.textContent = comp.cme.avg;
    if (cCmeDiff) cCmeDiff.textContent = comp.cme.diff;
    if (cCmeDyn) cCmeDyn.innerHTML = `<span class="${comp.cme.dyn_class}">${comp.cme.dyn}</span>`;

    // Вспышки
    const cFlrNow = document.getElementById('c-flr-now');
    const cFlrAvg = document.getElementById('c-flr-avg');
    const cFlrDiff = document.getElementById('c-flr-diff');
    const cFlrDyn = document.getElementById('c-flr-dyn');

    if (cFlrNow) cFlrNow.textContent = comp.flares.now;
    if (cFlrAvg) cFlrAvg.textContent = comp.flares.avg;
    if (cFlrDiff) cFlrDiff.textContent = comp.flares.diff;
    if (cFlrDyn) cFlrDyn.innerHTML = `<span class="${comp.flares.dyn_class}">${comp.flares.dyn}</span>`;

    // Kp
    const cKpNow = document.getElementById('c-kp-now');
    const cKpAvg = document.getElementById('c-kp-avg');
    const cKpDiff = document.getElementById('c-kp-diff');
    const cKpDyn = document.getElementById('c-kp-dyn');

    if (cKpNow) cKpNow.textContent = comp.kp.now;
    if (cKpAvg) cKpAvg.textContent = comp.kp.avg;
    if (cKpDiff) cKpDiff.textContent = comp.kp.diff;
    if (cKpDyn) cKpDyn.innerHTML = `<span class="${comp.kp.dyn_class}">${comp.kp.dyn}</span>`;

    // Ветер
    const cWndNow = document.getElementById('c-wnd-now');
    const cWndAvg = document.getElementById('c-wnd-avg');
    const cWndDiff = document.getElementById('c-wnd-diff');
    const cWndDyn = document.getElementById('c-wnd-dyn');

    if (cWndNow) cWndNow.textContent = comp.wind.now;
    if (cWndAvg) cWndAvg.textContent = comp.wind.avg;
    if (cWndDiff) cWndDiff.textContent = comp.wind.diff;
    if (cWndDyn) cWndDyn.innerHTML = `<span class="${comp.wind.dyn_class}">${comp.wind.dyn}</span>`;
}

// ═══════════════════════════════════════════════════════════
//  ОБНОВЛЕНИЕ ПЕРСОНАЛЬНЫХ РЕКОМЕНДАЦИЙ
// ═══════════════════════════════════════════════════════════
function updatePersonalWithData(data) {
    const kp = data.kp.current;
    const lat = Math.abs(userLat);
    const notice = document.getElementById('personalNotice');
    const txt = document.getElementById('noticeText');

    if (notice && txt) {
        if (kp >= 6 && lat > 50 && lat < 72) {
            txt.innerHTML = `<strong>Kp = ${kp}</strong> — высокая вероятность полярных сияний на вашей широте (${userLat.toFixed(1)}°). Лучшее время наблюдения: после 22:00.`;
            notice.style.display = 'block';
        } else if (kp >= 5 && lat > 42) {
            txt.innerHTML = `<strong>Kp = ${kp}</strong> — возможны слабые сияния у горизонта.`;
            notice.style.display = 'block';
        } else {
            notice.style.display = 'none';
        }
    }
}

// ═══════════════════════════════════════════════════════════
//  ОБНОВЛЕНИЕ ДЕТАЛЬНЫХ СТРАНИЦ
// ═══════════════════════════════════════════════════════════
function updateDetailedPages(data) {
    // Страница вспышек
    if (data.flares.events && data.flares.events.length > 0) {
        const flareDetails = document.getElementById('flareDetails');
        if (flareDetails) {
            flareDetails.innerHTML = '';
            data.flares.events.slice(-5).reverse().forEach(flare => {
                const statusClass = flare.class === 'X' ? 'evt-danger' : (flare.class === 'M' ? 'evt-warn' : 'evt-info');
                flareDetails.innerHTML += `
                    <div class="evt ${statusClass}">
                        <div class="evt-date">${flare.date}</div>
                        <h4>Вспышка класса ${flare.class_full}</h4>
                        <p><strong>Оценка:</strong> ${flare.class === 'X' ? 'мощная' : (flare.class === 'M' ? 'средняя' : 'слабая')}</p>
                    </div>
                `;
            });
        }
    }

    // Страница CME
    if (data.cme.events && data.cme.events.length > 0) {
        const cmeDetails = document.getElementById('cmeDetails');
        if (cmeDetails) {
            cmeDetails.innerHTML = '';
            data.cme.events.slice(-5).reverse().forEach(cme => {
                const statusClass = cme.speed > 600 ? 'evt-danger' : (cme.speed > 400 ? 'evt-warn' : 'evt-info');
                cmeDetails.innerHTML += `
                    <div class="evt ${statusClass}">
                        <div class="evt-date">${cme.date}</div>
                        <h4>CME</h4>
                        <p><strong>Скорость:</strong> ${cme.speed} км/с</p>
                    </div>
                `;
            });
        }
    }

    // Обновляем детальную информацию на странице Солнца
    const sunspotDetail = document.getElementById('sunspotDetail');
    if (sunspotDetail) {
        sunspotDetail.textContent = data.sun.display;
    }
}

function updatePredictions(kp) {
    const flareProb = Math.floor(5 + Math.random() * 20);
    const kpForecast = (kp + (Math.random() - 0.5)).toFixed(1);
    const lat = Math.abs(userLat);
    let auroraProb = 5;

    if (kp >= 6) auroraProb = lat > 50 ? 70 : 30;
    else if (kp >= 5) auroraProb = lat > 55 ? 40 : 15;

    const flareProbEl = document.getElementById('flareProb');
    const kpForecastEl = document.getElementById('kpForecast');
    const auroraProbEl = document.getElementById('auroraProb');

    if (flareProbEl) flareProbEl.textContent = flareProb + '%';
    if (kpForecastEl) kpForecastEl.textContent = kpForecast;
    if (auroraProbEl) auroraProbEl.textContent = auroraProb + '%';

    updatePersonal();
}

// ═══════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    initGeolocation();
    initAuroraMap();
    initEarth();
    initCMEAnim();

    // Загружаем реальные данные
    loadAllData().then(() => {
        // После загрузки данных инициализируем графики
        initCMEChart();
        initGeoChart();
        initWindChart();
    });

    // Обновляем данные каждые 30 минут (1800000 мс)
    // Увеличил интервал, чтобы не нагружать NOAA
    setInterval(loadAllData, 1800000);

    // Добавим также обновление времени на странице каждую минуту
    setInterval(() => {
        const lastUpdate = document.getElementById('lastUpdate');
        if (lastUpdate && lastUpdate.textContent.includes('Данные обновлены')) {
            // Просто оставляем существующее время,
            // данные обновляются по расписанию через loadAllData
        }
    }, 60000);
});

window.addEventListener('resize', () => {
    if (earthRenderer && earthCamera) {
        const container = document.getElementById('earth-container');
        if (container) {
            const width = container.clientWidth;
            const height = container.clientHeight;
            earthRenderer.setSize(width, height);
            earthCamera.aspect = width / height;
            earthCamera.updateProjectionMatrix();
        }
    }
});
// ═══════════════════════════════════════════════════════════
//  STARS & METEORS
// ═══════════════════════════════════════════════════════════
(function () {
    const c = document.getElementById('stars');
    if (c) {
        for (let i = 0; i < 160; i++) {
            const s = document.createElement('div');
            s.className = 'star';
            const sz = (Math.random() * 2.5 + 0.5) + 'px';
            s.style.cssText = `width:${sz};height:${sz};left:${Math.random()*100}%;top:${Math.random()*100}%;animation-delay:${Math.random()*3}s;animation-duration:${Math.random()*2+2}s`;
            c.appendChild(s);
        }
    }
})();

setInterval(() => {
    const m = document.createElement('div');
    m.className = 'meteor';
    m.style.left = Math.random() * 80 + '%';
    m.style.top  = Math.random() * 40 + '%';
    document.body.appendChild(m);
    setTimeout(() => m.remove(), 2000);
}, 3200);

window.addEventListener('scroll', () => {
    const p = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight) * 100;
    const sb = document.getElementById('scrollBar');
    if (sb) sb.style.width = p + '%';
    const stars = document.getElementById('stars');
    if (stars) stars.style.transform = `translateY(${window.scrollY * 0.15}px)`;
});

// ═══════════════════════════════════════════════════════════
//  THEME — с переключением тайла карты
// ═══════════════════════════════════════════════════════════
function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme');
    const nt  = cur === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', nt);
    localStorage.setItem('theme', nt);
    document.getElementById('ticon').textContent = nt === 'light' ? '☀️' : '🌙';
    document.getElementById('ttext').textContent = nt === 'light' ? 'Светлая' : 'Тёмная';

    // Карта всегда светлая
    if (auroraMap && window.mapTileLayer) {
        auroraMap.removeLayer(window.mapTileLayer);
        window.mapTileLayer = L.tileLayer(
            `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png`,
            { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; CartoDB' }
        ).addTo(auroraMap);
    }
}

(function () {
    const t = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', t);
    document.getElementById('ticon').textContent = t === 'light' ? '☀️' : '🌙';
    document.getElementById('ttext').textContent = t === 'light' ? 'Светлая' : 'Тёмная';
})();

// ═══════════════════════════════════════════════════════════
//  TELEGRAM BOT
// ═══════════════════════════════════════════════════════════
const TG = {
    token: '8663758089:AAFA39NWvNy3p5W2G3sguWMsOgGfeLGOBEk',
};

let lastAlertKp = 0;

// Получить chat_id пользователя по @username через getUpdates
async function getTelegramChatId(username) {
    try {
        // Запрашиваем последние 100 обновлений
        const r = await fetch(`https://api.telegram.org/bot${TG.token}/getUpdates?limit=100&allowed_updates=["message"]`);
        const data = await r.json();
        if (!data.ok) return null;
        const clean = username.replace('@', '').toLowerCase();
        // Ищем в обратном порядке (сначала свежие)
        for (const upd of [...(data.result || [])].reverse()) {
            const msg = upd.message || upd.channel_post || upd.edited_message;
            if (!msg || !msg.chat) continue;
            const uname = (msg.chat.username || '').toLowerCase();
            if (uname === clean) return msg.chat.id;
        }
        // Ничего не нашли — попробуем ещё раз без offset (сбросить состояние)
        const r2 = await fetch(`https://api.telegram.org/bot${TG.token}/getUpdates?offset=-1&limit=1`);
        const d2 = await r2.json();
        if (d2.ok && d2.result && d2.result.length) {
            const msg = d2.result[0].message || d2.result[0].edited_message;
            if (msg && (msg.chat.username || '').toLowerCase() === clean) return msg.chat.id;
        }
        return null;
    } catch (e) {
        console.error('[TG] getUpdates error:', e);
        return null;
    }
}

async function sendTelegram(chatId, text) {
    try {
        const r = await fetch(`https://api.telegram.org/bot${TG.token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
        });
        const data = await r.json();
        if (!data.ok) throw new Error(data.description || 'TG error');
        console.log('[TG] Отправлено ->', chatId);
        return true;
    } catch (e) {
        console.error('[TG] Ошибка:', e.message);
        const errEl  = document.getElementById('subError');
        const errTxt = document.getElementById('subErrorText');
        if (errEl && errTxt) {
            errTxt.textContent = 'Ошибка Telegram: ' + e.message;
            errEl.style.display = 'flex';
            setTimeout(() => { errEl.style.display = 'none'; }, 10000);
        }
        return false;
    }
}

// Формирует текст сводки по текущим данным NOAA
function buildSummaryText(label) {
    const kp    = liveData.kp        != null ? liveData.kp.toFixed(1) : '—';
    const wind  = liveData.windSpeed != null ? liveData.windSpeed + ' км/с' : '—';
    const bz    = liveData.bz        != null ? liveData.bz + ' нТл' : '—';
    const bt    = liveData.bt        != null ? liveData.bt + ' нТл' : '—';
    const ss    = liveData.sunspots  != null ? liveData.sunspots : '—';
    const cme   = liveData.cmeCount  != null ? liveData.cmeCount : '—';
    const flr   = liveData.flareCount!= null ? liveData.flareCount : '—';
    const flrCl = liveData.flareClass|| '—';
    const now   = new Date().toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const kpStatus = parseFloat(kp) >= 7 ? 'СИЛЬНАЯ БУРЯ'
                   : parseFloat(kp) >= 5 ? 'МАГНИТНАЯ БУРЯ'
                   : 'Спокойно';

    return `<b>Space Weather Pro — ${label}</b>
${now} UTC

<b>ТЕКУЩИЕ ПОКАЗАТЕЛИ</b>
Kp-индекс:        <b>${kp}</b>  (${kpStatus})
Солнечный ветер:  ${wind}
Bz (ММП):        ${bz}
Bt:               ${bt}
Солнечные пятна:  ${ss}

<b>СОБЫТИЯ ЗА 7 ДНЕЙ</b>
CME-выбросов:     ${cme}
Вспышек:          ${flr}  (макс. класс: ${flrCl})

Источник: NOAA SWPC`;
}

// Немедленная сводка при подписке
async function sendWelcomeTelegram(chatId, events) {
    const welcome =
`<b>Space Weather Pro</b>

Вы подписаны на уведомления о космической погоде.

Вы будете получать:
   - Сводку каждые 12 часов
${events.filter(e => e !== 'Ежедневно').map(e => '   - Экстренное уведомление при: ' + e).join('\n')}

Текущее состояние:

` + buildSummaryText('Сводка на момент подписки');
    return sendTelegram(chatId, welcome);
}

// Отправить сводку всем подписчикам (вызывается каждые 12 часов)
async function sendScheduledSummary() {
    const subs = JSON.parse(localStorage.getItem('swp_subs') || '[]');
    const targets = subs.filter(s => s.type === 'telegram' && s.chatId);
    if (!targets.length) return;
    const text = buildSummaryText('Сводка за 12 часов');
    for (const sub of targets) {
        await sendTelegram(sub.chatId, text);
    }
    console.log('[TG] Плановая 12-часовая сводка отправлена:', targets.length, 'подписчикам');
}

// Запустить 12-часовой таймер сводок
function startSummaryScheduler() {
    const INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 часов
    const lastSentStr = localStorage.getItem('swp_last_summary');
    const lastSent    = lastSentStr ? parseInt(lastSentStr) : 0;
    const now         = Date.now();
    const elapsed     = now - lastSent;

    // Если с прошлой отправки прошло больше 12 часов — отправить сразу
    if (elapsed >= INTERVAL_MS) {
        const subs = JSON.parse(localStorage.getItem('swp_subs') || '[]');
        if (subs.some(s => s.type === 'telegram' && s.chatId)) {
            sendScheduledSummary();
            localStorage.setItem('swp_last_summary', String(Date.now()));
        }
    }

    // Повторять каждые 12 часов пока страница открыта
    setInterval(async () => {
        await sendScheduledSummary();
        localStorage.setItem('swp_last_summary', String(Date.now()));
    }, INTERVAL_MS);
}

async function sendStormAlert(kp, bz, wind) {
    const subs    = JSON.parse(localStorage.getItem('swp_subs') || '[]');
    const targets = subs.filter(s => s.type === 'telegram' && s.chatId && s.events.includes('Kp≥5'));
    if (!targets.length) return;
    if (kp - lastAlertKp < 0.5) return;
    lastAlertKp = kp;

    const level = kp >= 7 ? 'СИЛЬНАЯ БУРЯ' : 'МАГНИТНАЯ БУРЯ';
    const text =
`<b>ВНИМАНИЕ: ${level}</b>
Kp = ${kp.toFixed(1)}

` + buildSummaryText('Экстренное уведомление') +
`
${kp >= 7 ? 'Возможны помехи GPS, радиосвязи и энергосетей.' : ''}
Полярные сияния возможны на широтах выше 55 градусов.`;

    for (const sub of targets) {
        await sendTelegram(sub.chatId, text);
    }
}

// ═══════════════════════════════════════════════════════════
//  НАВИГАЦИЯ
// ═══════════════════════════════════════════════════════════
function showPage(id, pushHistory = true) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    window.scrollTo(0, 0);
    if (id === 'cme')         initCMEChart();
    if (id === 'geomagnetic') initGeoChart();
    if (id === 'solarwind')   initWindChart();
    if (pushHistory) {
        const url = id === 'home' ? window.location.pathname : '#' + id;
        history.pushState({ page: id }, '', url);
    }
}

window.addEventListener('popstate', e => {
    showPage(e.state?.page || 'home', false);
});

// ═══════════════════════════════════════════════════════════
//  ГЕОЛОКАЦИЯ
// ═══════════════════════════════════════════════════════════
let userLat = 55.75, userLon = 37.61;

function initGeolocation() {
    const el = document.getElementById('userLocation');
    if (el) el.innerHTML = '<span style="opacity:0.6">⏳ определяется...</span>';
    fetch('http://ip-api.com/json/?lang=ru&fields=status,lat,lon,city,country')
        .then(r => r.json())
        .then(d => {
            userLat = d.lat     || 55.75;
            userLon = d.lon     || 37.61;
            const city    = d.city    || '';
            const country = d.country || '';
            if (el) el.textContent = city
                ? `📍 ${city}, ${country} (${userLat.toFixed(1)}°)`
                : `📍 ${userLat.toFixed(2)}°, ${userLon.toFixed(2)}°`;
            updateAuroraMap();
            updatePersonal();
        })
        .catch(() => {
            if (el) el.textContent = '📍 Москва, Россия (55.8°)';
            updateAuroraMap();
            updatePersonal();
        });
}

function updatePersonal() {
    const kp  = liveData.kp ?? 3.3;
    const lat = Math.abs(userLat);
    const notice = document.getElementById('personalNotice');
    const txt    = document.getElementById('noticeText');
    if (!notice || !txt) return;
    if (kp >= 6 && lat > 50 && lat < 72) {
        txt.innerHTML = `<strong>Kp = ${kp.toFixed(1)}</strong> — высокая вероятность полярных сияний на вашей широте (${userLat.toFixed(1)}°). Лучшее время: после 22:00.`;
        notice.style.display = 'block';
    } else if (kp >= 5 && lat > 42) {
        txt.innerHTML = `<strong>Kp = ${kp.toFixed(1)}</strong> — возможны слабые сияния у горизонта.`;
        notice.style.display = 'block';
    } else {
        notice.style.display = 'none';
    }
}

// ═══════════════════════════════════════════════════════════
//  ХРАНИЛИЩЕ ДАННЫХ
// ═══════════════════════════════════════════════════════════
const liveData = {
    kp: null, kpForecast: null,
    windSpeed: null, windDensity: null,
    bz: null, bt: null,
    sunspots: null,
    flareCount: null, flareClass: null,
    cmeCount: null,
    kpHistory: [],
    windHistory: [],
    cmeEvents:   [],  // [{date, time, speed, warn}]
    flareEvents: [],  // [{date, time, cls, warn}]
};

const AVG_30 = { cme: 2.5, flares: 5.3, kp: 3.2, wind: 430 };

// ═══════════════════════════════════════════════════════════
//  NOAA API
// ═══════════════════════════════════════════════════════════
// Прокси для обхода CORS и блокировок в России
async function safeFetch(url) {
    const proxies = [
        u => u,
        u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
        u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    ];
    for (const makeUrl of proxies) {
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 8000);
            const r = await fetch(makeUrl(url), { signal: controller.signal });
            clearTimeout(timer);
            if (!r.ok) throw new Error('HTTP ' + r.status);
            const data = await r.json();
            if (data) return data;
        } catch (e) {
            console.warn('[NOAA] прокси не сработал:', e.message);
        }
    }
    return null;
}

async function fetchAllNoaaData() {
    const [kpRaw, kpFcRaw, windRaw, magRaw, ssRaw, alertsRaw] = await Promise.all([
        safeFetch('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json'),
        safeFetch('https://services.swpc.noaa.gov/json/geospace/predicted_kp.json'),
        safeFetch('https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json'),
        safeFetch('https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json'),
        safeFetch('https://services.swpc.noaa.gov/json/sunspot_regions.json'),
        safeFetch('https://services.swpc.noaa.gov/json/alerts.json'),
    ]);

    // Kp текущий + история
    if (kpRaw && Array.isArray(kpRaw)) {
        const rows = kpRaw.filter((r, i) => i > 0 && !isNaN(parseFloat(r[1])));
        if (rows.length) {
            liveData.kp = parseFloat(rows[rows.length - 1][1]);
            liveData.kpHistory = rows.slice(-24).map(r => ({
                label: String(r[0]).slice(11, 16),
                value: parseFloat(r[1])
            }));
        }
    }

    // Kp прогноз
    if (kpFcRaw && Array.isArray(kpFcRaw)) {
        const rows = kpFcRaw.filter((r, i) => i > 0 && !isNaN(parseFloat(r[1])));
        if (rows.length) liveData.kpForecast = parseFloat(rows[0][1]);
    }

    // Солнечный ветер
    if (windRaw && Array.isArray(windRaw)) {
        for (let i = windRaw.length - 1; i >= 0; i--) {
            const w = windRaw[i];
            if (w.proton_speed != null && !isNaN(w.proton_speed)) {
                liveData.windSpeed   = Math.round(w.proton_speed);
                liveData.windDensity = w.proton_density != null ? parseFloat(w.proton_density).toFixed(1) : null;
                break;
            }
        }
        const step = Math.max(1, Math.floor(windRaw.length / 48));
        liveData.windHistory = [];
        for (let i = 0; i < windRaw.length; i += step) {
            const w = windRaw[i];
            if (w.proton_speed != null && !isNaN(w.proton_speed)) {
                liveData.windHistory.push({ label: String(w.time_tag || '').slice(11, 16), value: Math.round(w.proton_speed) });
            }
        }
        liveData.windHistory = liveData.windHistory.slice(-48);
    }

    // Bz / Bt (межпланетное магнитное поле)
    if (magRaw && Array.isArray(magRaw)) {
        for (let i = magRaw.length - 1; i >= 0; i--) {
            const m = magRaw[i];
            if (m.bz_gsm != null && !isNaN(m.bz_gsm)) {
                liveData.bz = parseFloat(m.bz_gsm).toFixed(1);
                liveData.bt = m.bt != null ? parseFloat(m.bt).toFixed(1) : null;
                break;
            }
        }
    }

    // Солнечные пятна
    if (ssRaw && Array.isArray(ssRaw)) {
        liveData.sunspots = ssRaw.length;
    }

    // Алерты (вспышки + CME)
    if (alertsRaw && Array.isArray(alertsRaw)) {
        const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
        const recent  = alertsRaw.filter(a => {
            const t = new Date(a.issue_datetime).getTime();
            return !isNaN(t) && t >= weekAgo;
        });

        const cmeArr = recent.filter(a =>
            (a.product_id && a.product_id.includes('CME')) ||
            (a.message    && /coronal mass ejection|CME/i.test(a.message))
        );
        if (cmeArr.length) liveData.cmeCount = cmeArr.length;

        // Сохраняем отдельные CME с реальными датами NOAA
        liveData.cmeEvents = cmeArr.map((a, i) => {
            const d       = new Date(a.issue_datetime);
            const dateStr = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const timeStr = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            const speedM  = (a.message || '').match(/(\d{3,4})\s*km\/s/i);
            const speed   = speedM ? parseInt(speedM[1]) : null;
            return { num: i + 1, date: dateStr, time: timeStr, speed, warn: speed ? speed > 450 : false };
        });

        const flrArr = recent.filter(a =>
            (a.product_id && (a.product_id.includes('AL_FLARE') || a.product_id.includes('WATA'))) ||
            (a.message    && /solar flare|X-ray|class [XMC]/i.test(a.message))
        );
        if (flrArr.length) liveData.flareCount = flrArr.length;

        // Сохраняем отдельные вспышки с реальными датами NOAA
        liveData.flareEvents = flrArr.map(a => {
            const d       = new Date(a.issue_datetime);
            const dateStr = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const timeStr = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            const clsM    = (a.message || '').match(/([XMC]\d+(?:\.\d+)?)/);
            const cls     = clsM ? clsM[1] : '?';
            return { date: dateStr, time: timeStr, cls, warn: cls[0] === 'X' || cls[0] === 'M' };
        });

        const order = { X: 3, M: 2, C: 1 };
        let maxCls = null;
        recent.forEach(a => {
            const hits = (a.message || '').match(/([XMC]\d+(?:\.\d+)?)/g) || [];
            hits.forEach(cls => {
                if (!maxCls ||
                    order[cls[0]] > order[maxCls[0]] ||
                    (order[cls[0]] === order[maxCls[0]] && parseFloat(cls.slice(1)) > parseFloat(maxCls.slice(1))))
                    maxCls = cls;
            });
        });
        if (maxCls) liveData.flareClass = maxCls;
    }
}

// ═══════════════════════════════════════════════════════════
//  ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ UI
// ═══════════════════════════════════════════════════════════
function setText(id, val)  { const el = document.getElementById(id); if (el) el.textContent = val; }
function setClass(id, cls) { const el = document.getElementById(id); if (el) el.className   = cls; }
function setHTML(id, html) { const el = document.getElementById(id); if (el) el.innerHTML   = html; }

// ═══════════════════════════════════════════════════════════
//  ДИНАМИЧЕСКИЙ РЕНДЕР СОБЫТИЙ (CME + Вспышки)
// ═══════════════════════════════════════════════════════════
function renderDynamicEvents(cmeCount, flareCount, total, evTxt) {
    const cmeEvents   = liveData.cmeEvents   || [];
    const flareEvents = liveData.flareEvents || [];

    // ── Страница событий: статистика ──
    setText('evStatTotal',  total);
    setText('evStatCme',    cmeCount);
    setText('evStatFlares', flareCount);
    setText('evStatOverall', evTxt);
    const cSt = document.getElementById('evStatCmeStatus');
    if (cSt) { cSt.className = cmeCount > 2 ? 'status-warning' : 'status-normal'; cSt.textContent = cmeCount > 2 ? '(превышение нормы)' : '(норма)'; }
    const fSt = document.getElementById('evStatFlaresStatus');
    if (fSt) { fSt.className = (flareCount < 3 || flareCount > 8) ? 'status-warning' : 'status-normal'; fSt.textContent = (flareCount < 3 || flareCount > 8) ? '(отклонение)' : '(норма)'; }

    // ── Вспомогательная функция генерации CME-карточек ──
    function buildCmeHtml(events) {
        if (!events.length) return `<div class="evt evt-info"><p style="opacity:0.6;">Нет данных за последние 7 дней</p></div>`;
        return events.map((ev, i) => {
            const badge    = ev.warn ? `<span class="status-badge status-warning">выше нормы</span>` : '';
            const speedTxt = ev.speed ? `<strong>Скорость:</strong> <span class="numeric">${ev.speed} км/с</span> &nbsp;|&nbsp; ` : '';
            const evalTxt  = ev.warn ? 'повышенная активность' : 'норма';
            return `<div class="evt evt-info">
                <div class="evt-date">${ev.date} <span style="opacity:0.5;font-size:11px;">${ev.time} UTC</span></div>
                <h4>CME #${i + 1} ${badge}</h4>
                <p>${speedTxt}<strong>Оценка:</strong> ${evalTxt}</p>
            </div>`;
        }).join('');
    }

    // ── Вспомогательная функция генерации вспышек ──
    function buildFlareHtml(events) {
        if (!events.length) return `<div class="evt evt-info"><p style="opacity:0.6;">Нет данных за последние 7 дней</p></div>`;
        return events.map(ev => {
            const isX    = ev.cls[0] === 'X';
            const isM    = ev.cls[0] === 'M';
            const evCls  = (isX || isM) ? 'evt-warn' : 'evt-info';
            const badge  = isX ? `<span class="status-badge status-warning">X-класс</span>` : isM ? `<span class="status-badge status-warning">M-класс</span>` : '';
            const evalTxt = isX ? 'сильная, помехи GPS и радиосвязи' : isM ? 'средняя, возможны радиопомехи' : 'слабая';
            return `<div class="evt ${evCls}">
                <div class="evt-date">${ev.date} <span style="opacity:0.5;font-size:11px;">${ev.time} UTC</span></div>
                <h4>Вспышка класса ${ev.cls} ${badge}</h4>
                <p><strong>Оценка:</strong> ${evalTxt} &nbsp;|&nbsp; <strong>Источник:</strong> GOES-16, NOAA</p>
            </div>`;
        }).join('');
    }

    const updated = `<p style="opacity:0.35;font-size:11px;margin-top:16px;text-align:right;">Источник: NOAA SWPC · Обновлено: ${new Date().toLocaleString('ru-RU')}</p>`;

    // ── Страница событий (allEventsList) ──
    const listEl = document.getElementById('allEventsList');
    if (listEl) {
        listEl.innerHTML =
            `<h3 style="color:var(--accent);margin:28px 0 16px;">Корональные выбросы массы</h3>` +
            buildCmeHtml(cmeEvents) +
            `<h3 style="color:var(--accent);margin:32px 0 16px;">Солнечные вспышки</h3>` +
            buildFlareHtml(flareEvents) +
            updated;
    }

    // ── Страница CME (cmeDetails) ──
    const cmeEl = document.getElementById('cmeDetails');
    if (cmeEl) {
        cmeEl.innerHTML = buildCmeHtml(cmeEvents) + updated;
    }

    // ── Страница вспышек (flareDetails) ──
    const flrEl = document.getElementById('flareDetails');
    if (flrEl) {
        flrEl.innerHTML = buildFlareHtml(flareEvents) + updated;
    }
}

// ═══════════════════════════════════════════════════════════
//  ПРИМЕНЕНИЕ ДАННЫХ К ИНТЕРФЕЙСУ
// ═══════════════════════════════════════════════════════════
function applyAllData() {
    const kp         = liveData.kp          ?? 3.3;
    const windSpeed  = liveData.windSpeed    ?? 410;
    const windDens   = liveData.windDensity  ?? '4.8';
    const bz         = liveData.bz;
    const bt         = liveData.bt;
    const sunspots   = liveData.sunspots     ?? 85;
    const flareCount = liveData.flareCount   ?? 5;
    const flareClass = liveData.flareClass   ?? 'M1.2';
    const cmeCount   = liveData.cmeCount     ?? 3;
    const kpFc       = liveData.kpForecast   ?? +(kp + 0.2).toFixed(1);

    // ── Kp ──
    const kpSt  = kp >= 7 ? 'status-danger' : kp >= 5 ? 'status-warning' : 'status-normal';
    const kpTxt = kp >= 7 ? 'Сильная буря'  : kp >= 5 ? 'Магнитная буря' : 'Спокойно';
    setText('kpIndex',    kp.toFixed(1));
    setText('kpStatus',   kpTxt);
    setClass('kpStatusBadge', `current-status ${kpSt}`);
    setText('kpStatusBadge', kpTxt);
    setText('rangeKp', kp.toFixed(1));
    setClass('rangeKpStatus', kpSt);
    setText('rangeKpStatus', kpTxt);

    // ── Bz / Bt ──
    const bzNum = bz != null ? parseFloat(bz) : NaN;
    const bzSt  = isNaN(bzNum) ? 'status-normal'
                : bzNum < -10  ? 'status-danger'
                : bzNum < -5   ? 'status-warning'
                : bzNum < 0    ? 'status-neutral'
                : 'status-normal';
    const bzDir = !isNaN(bzNum) ? (bzNum < 0 ? `${bz} нТл ↓ юг` : `+${bz} нТл ↑ север`) : '—';
    const bzTxt = !isNaN(bzNum) ? (bzNum < -10 ? 'Очень опасно' : bzNum < -5 ? 'Опасно' : bzNum < 0 ? 'Умеренно' : 'Безопасно') : '—';
    setText('bzValue',  bzDir);
    setClass('bzStatus', `current-status ${bzSt}`);
    setText('bzStatus', bzTxt);
    setText('btValue',  bt != null ? bt + ' нТл' : '—');

    // ── Ветер ──
    const wSt  = windSpeed > 600 ? 'status-warning' : windSpeed > 500 ? 'status-warning' : 'status-normal';
    const wTxt = windSpeed > 600 ? 'Высокая скорость' : windSpeed > 500 ? 'Повышенная' : 'В пределах нормы';
    setText('windSpeed',   windSpeed + ' км/с');
    setText('windDensity', windDens  + ' p/см³');
    setClass('windStatus', `current-status ${wSt}`);
    setText('windStatus', wTxt);
    setText('rangeWind', windSpeed + ' км/с');
    setClass('rangeWindStatus', wSt);
    setText('rangeWindStatus', wTxt);

    // ── CME ──
    const cmeSt  = cmeCount > 2 ? 'status-warning' : 'status-normal';
    const cmeTxt = cmeCount > 2 ? 'Превышение нормы' : 'В пределах нормы';
    setText('cmeCount', cmeCount);
    setText('cmeSpeed', '—');
    setClass('cmeStatus', `current-status ${cmeSt}`);
    setText('cmeStatus', cmeTxt);
    setText('rangeCme', `${cmeCount} события`);
    setClass('rangeCmeStatus', cmeSt);
    setText('rangeCmeStatus', cmeTxt);

    // ── Вспышки ──
    const flSt  = (flareCount < 3 || flareCount > 8) ? 'status-warning' : 'status-normal';
    const flTxt = (flareCount < 3 || flareCount > 8) ? 'Отклонение от нормы' : 'В пределах нормы';
    setText('flareCount', flareCount);
    setText('flareClass', flareClass);
    setClass('flaresStatus', `current-status ${flSt}`);
    setText('flaresStatus', flTxt);
    setText('rangeFlare', `${flareCount} событий`);
    setClass('rangeFlareStatus', flSt);
    setText('rangeFlareStatus', flTxt);

    // ── Пятна ──
    const ssSt  = (sunspots < 70 || sunspots > 130) ? 'status-warning' : 'status-normal';
    const ssTxt = (sunspots < 70 || sunspots > 130) ? 'Отклонение' : 'В пределах нормы';
    setText('sunspotCount',  sunspots);
    setText('sunspotDetail', sunspots + ' регионов');
    setText('sunPhase', 'Рост (25 цикл)');
    setClass('sunStatus', `current-status ${ssSt}`);
    setText('sunStatus', ssTxt);
    setText('rangeSun', `${sunspots} пятен`);
    setClass('rangeSunStatus', ssSt);
    setText('rangeSunStatus', ssTxt);

    // ── Общие события ──
    const total = cmeCount + flareCount;
    const evSt  = total > 10 ? 'status-warning' : 'status-normal';
    const evTxt = total > 10 ? 'Высокая активность' : 'Умеренная активность';
    const evEl  = document.getElementById('eventsCount') || document.getElementById('eventsTotal');
    if (evEl) evEl.textContent = total;
    setClass('eventsStatus', `current-status ${evSt}`);
    setText('eventsStatus', evTxt);
    setText('rangeGeneral', total > 10 ? 'Высокая' : 'Средняя');
    setClass('rangeGeneralStatus', evSt);
    setText('rangeGeneralStatus', evTxt);

    // ── Прогнозы ──
    const lat = Math.abs(userLat);
    let auroraProb = 5;
    if (kp >= 7) auroraProb = lat > 50 ? 90 : lat > 40 ? 50 : 20;
    else if (kp >= 6) auroraProb = lat > 50 ? 70 : 30;
    else if (kp >= 5) auroraProb = lat > 55 ? 40 : 15;
    const flareProb = flareClass[0] === 'X' ? 45 : flareClass[0] === 'M' ? 22 : 8;
    setText('flareProb',   flareProb + '%');
    setText('kpForecast',  typeof kpFc === 'number' ? kpFc.toFixed(1) : kpFc);
    setText('auroraProb',  auroraProb + '%');

    // ── Карточки сравнения ──
    updateCompCard('comp-cme-badge', 'c-cme-now', 'c-cme-avg', 'c-cme-diff', cmeCount,   AVG_30.cme,    cmeCount > 2);
    updateCompCard('comp-flr-badge', 'c-flr-now', 'c-flr-avg', 'c-flr-diff', flareCount, AVG_30.flares, flareCount < 3 || flareCount > 8);
    updateCompCard('comp-kp-badge',  'c-kp-now',  'c-kp-avg',  'c-kp-diff',  kp,         AVG_30.kp,     kp >= 5, 1);
    updateCompCard('comp-wnd-badge', 'c-wnd-now', 'c-wnd-avg', 'c-wnd-diff', windSpeed,  AVG_30.wind,   windSpeed > 600);

    // ── Алерт-баннер ──
    updateStormBanner(kp, bzNum);

    // ── Динамический рендер событий CME + вспышки (актуальные даты) ──
    renderDynamicEvents(cmeCount, flareCount, total, evTxt);

    updatePersonal();
}

function updateCompCard(badgeId, nowId, avgId, diffId, now, avg, isWarn, dec = 0) {
    const badge = document.getElementById(badgeId);
    if (badge) {
        badge.className  = `status-badge ${isWarn ? 'status-warning' : 'status-normal'}`;
        badge.textContent = isWarn ? 'превышение' : 'норма';
    }
    setText(nowId, typeof now === 'number' ? now.toFixed(dec) : now);
    setText(avgId, typeof avg === 'number' ? avg.toFixed(dec) : avg);
    const pct  = avg !== 0 ? Math.round(((now - avg) / avg) * 100) : 0;
    const sign = pct >= 0 ? '+' : '';
    const cls  = pct > 5 ? 'dyn-up' : pct < -5 ? 'dyn-down' : 'dyn-flat';
    const arr  = pct > 5 ? '▲' : pct < -5 ? '▼' : '◆';
    setHTML(diffId, `<span class="${cls}">${arr} ${sign}${pct}%</span>`);
}

function updateStormBanner(kp, bzNum) {
    let banner = document.getElementById('stormBanner');
    const isBig = kp >= 5 || (!isNaN(bzNum) && bzNum < -10);
    if (isBig) {
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'stormBanner';
            banner.style.cssText = [
                'position:fixed;top:60px;left:0;right:0;z-index:500',
                'background:linear-gradient(90deg,rgba(248,113,113,0.95),rgba(234,88,12,0.92))',
                'color:#fff;font-weight:700;font-size:15px;padding:10px 20px',
                'display:flex;align-items:center;justify-content:center;gap:12px',
                'text-align:center;box-shadow:0 4px 20px rgba(248,113,113,0.4)',
                'animation:stormPulse 2s ease-in-out infinite'
            ].join(';');
            document.body.appendChild(banner);
        }
        const lvl    = kp >= 7 ? '🔴 СИЛЬНАЯ БУРЯ' : '🟡 МАГНИТНАЯ БУРЯ';
        const bzNote = !isNaN(bzNum) && bzNum < 0 ? ` · Bz = ${liveData.bz} нТл (юг)` : '';
        banner.innerHTML = `⚠️ ${lvl} — Kp = ${kp.toFixed(1)}${bzNote} &nbsp;|&nbsp; <span style="opacity:0.8;font-weight:400;font-size:13px;">Помехи связи, сияния на широтах > 55°</span>`;
    } else if (banner) {
        banner.remove();
    }
}

// ═══════════════════════════════════════════════════════════
//  COUNTDOWN TIMER
// ═══════════════════════════════════════════════════════════
const UPDATE_INTERVAL_SEC = 300;
let countdownSec      = UPDATE_INTERVAL_SEC;
let countdownInterval = null;

function startCountdown() {
    if (countdownInterval) clearInterval(countdownInterval);
    countdownSec = UPDATE_INTERVAL_SEC;
    renderCountdown();
    countdownInterval = setInterval(() => {
        countdownSec--;
        if (countdownSec <= 0) {
            countdownSec = UPDATE_INTERVAL_SEC;
            loadAllData();
        }
        renderCountdown();
    }, 1000);
}

function renderCountdown() {
    const m  = Math.floor(countdownSec / 60);
    const s  = (countdownSec % 60).toString().padStart(2, '0');
    const el = document.getElementById('nextUpdate');
    if (el) el.textContent = `⏱ следующее обновление через ${m}:${s}`;
}

// ═══════════════════════════════════════════════════════════
//  КАРТА ПОЛЯРНЫХ СИЯНИЙ
// ═══════════════════════════════════════════════════════════
let auroraMap;

function initAuroraMap() {
    const container = document.getElementById('aurora-map');
    if (!container) return;
    container.innerHTML = '';
    try {
        auroraMap = L.map('aurora-map').setView([65, 100], 2);

        const theme = document.documentElement.getAttribute('data-theme');
        const tile  = theme === 'light' ? 'light_all' : 'light_all';
        window.mapTileLayer = L.tileLayer(
            `https://{s}.basemaps.cartocdn.com/${tile}/{z}/{x}/{y}{r}.png`,
            { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; CartoDB' }
        ).addTo(auroraMap);

        updateAuroraMap();
    } catch (e) {
        console.error('Map error:', e);
    }
}

function updateAuroraMap() {
    if (!auroraMap) return;
    if (window.userMarker) auroraMap.removeLayer(window.userMarker);
    window.userMarker = L.marker([userLat, userLon], {
        icon: L.divIcon({
            className: 'custom-marker',
            html: '<div style="background:#f87171;width:16px;height:16px;border-radius:50%;border:2px solid white;box-shadow:0 0 10px red;"></div>',
            iconSize: [20, 20]
        })
    }).addTo(auroraMap).bindTooltip('Вы здесь');
}

function updateAuroraImages() {
    const timestamp = new Date().getTime();
    document.getElementById('aurora-north').src =
        `https://services.swpc.noaa.gov/images/aurora-forecast-northern-hemisphere.jpg?t=${timestamp}`;
    document.getElementById('aurora-south').src =
        `https://services.swpc.noaa.gov/images/aurora-forecast-southern-hemisphere.jpg?t=${timestamp}`;
}
updateAuroraImages();
setInterval(updateAuroraImages, 3600000);

// ═══════════════════════════════════════════════════════════
//  3D ЗЕМЛЯ (оригинал с магнитосферой)
// ═══════════════════════════════════════════════════════════
let earthScene, earthCamera, earthRenderer, earthMesh, cloudMesh, earthControls;

function initEarth() {
    const container = document.getElementById('earth-container');
    if (!container) return;
    container.innerHTML = '';
    try {
        earthScene = new THREE.Scene();
        earthScene.background = new THREE.Color(0x0a0f24);
        const W = container.clientWidth || 800;
        const H = Math.max(360, Math.round(W * 0.5));
        container.style.height = H + 'px';
        earthCamera = new THREE.PerspectiveCamera(45, W / H, 0.1, 1000);
        earthCamera.position.set(0, 0, 8);
        earthRenderer = new THREE.WebGLRenderer({ antialias: true });
        earthRenderer.setSize(W, H);
        earthRenderer.setClearColor(0x0a0f24);
        container.appendChild(earthRenderer.domElement);

        earthControls = new THREE.OrbitControls(earthCamera, earthRenderer.domElement);
        earthControls.enableDamping = true;
        earthControls.dampingFactor = 0.05;
        earthControls.enableZoom    = true;

        const tl = new THREE.TextureLoader();
        earthMesh = new THREE.Mesh(
            new THREE.SphereGeometry(2, 64, 64),
            new THREE.MeshPhongMaterial({ map: tl.load('https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg'), shininess: 5 })
        );
        earthScene.add(earthMesh);

        cloudMesh = new THREE.Mesh(
            new THREE.SphereGeometry(2.03, 64, 64),
            new THREE.MeshPhongMaterial({ map: tl.load('https://threejs.org/examples/textures/planets/earth_clouds_1024.png'), transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
        );
        earthScene.add(cloudMesh);

        earthScene.add(new THREE.Mesh(
            new THREE.SphereGeometry(2.15, 64, 64),
            new THREE.MeshPhongMaterial({ color: 0x3399ff, transparent: true, opacity: 0.15, side: THREE.BackSide })
        ));

        [-70, -40, 0, 40, 70].forEach(a => {
            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(3.2 + Math.abs(a) * 0.015, 0.025, 6, 60),
                new THREE.MeshBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.28 })
            );
            ring.rotation.x = Math.PI / 2;
            ring.rotation.z = a * Math.PI / 180;
            earthScene.add(ring);
        });

        const aG = new THREE.TorusGeometry(1.55, 0.05, 8, 60);
        const aM = new THREE.MeshBasicMaterial({ color: 0x22d3a3, transparent: true, opacity: 0.6 });
        [1.45, -1.45].forEach(y => {
            const r = new THREE.Mesh(aG, aM);
            r.rotation.x = Math.PI / 2;
            r.position.y = y;
            earthScene.add(r);
        });

        earthScene.add(new THREE.AmbientLight(0x404060));
        const dl = new THREE.DirectionalLight(0xffffff, 1);
        dl.position.set(5, 3, 5);
        earthScene.add(dl);

        const sp = new Float32Array(3000);
        for (let i = 0; i < 3000; i++) sp[i] = (Math.random() - 0.5) * 200;
        const sg = new THREE.BufferGeometry();
        sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
        earthScene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.1 })));

        (function animate() {
            requestAnimationFrame(animate);
            earthMesh.rotation.y  += 0.001;
            cloudMesh.rotation.y  += 0.0015;
            earthControls.update();
            earthRenderer.render(earthScene, earthCamera);
        })();
    } catch (e) {
        console.error('Earth 3D error:', e);
        container.innerHTML = '<div style="color:white;text-align:center;padding:100px">3D Земля временно недоступна</div>';
    }
}

// ═══════════════════════════════════════════════════════════
//  СОЛНЕЧНАЯ СИСТЕМА 3D  — полностью детализированная
// ═══════════════════════════════════════════════════════════
let solarScene, solarCamera, solarRenderer, solarControls;
let solarFollowed = null;
let solarAnimId   = null;

// ── Генераторы canvas-текстур ──────────────────────────────
function makeTex(w, h, fn) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    fn(ctx, w, h);
    return new THREE.CanvasTexture(cv);
}

function noiseVal(x, y, scale) {
    return (Math.sin(x * scale + 1.3) * Math.cos(y * scale * 0.7 + 0.9) +
            Math.sin(x * scale * 2.1 + 0.5) * Math.cos(y * scale * 1.8 + 2.1)) * 0.5 + 0.5;
}

const PLANET_TEX = {
    mercury: () => makeTex(512, 256, (ctx, w, h) => {
        const g = ctx.createLinearGradient(0,0,w,h);
        g.addColorStop(0, '#7a7870'); g.addColorStop(1, '#5a5650');
        ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
        for (let i=0;i<300;i++) {
            const x=Math.random()*w, y=Math.random()*h, r=1+Math.random()*5;
            ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
            ctx.fillStyle = `rgba(${40+Math.random()*30|0},${38+Math.random()*25|0},${35+Math.random()*25|0},${0.4+Math.random()*0.5})`;
            ctx.fill();
            if(r>3){ctx.beginPath();ctx.arc(x,y,r*0.6,0,Math.PI*2);ctx.fillStyle='rgba(100,95,88,0.35)';ctx.fill();}
        }
    }),
    venus: () => makeTex(512, 256, (ctx, w, h) => {
        for(let y=0;y<h;y++){
            const v = y/h;
            const r=220+Math.sin(v*18)*12|0, g=170+Math.sin(v*14+1)*15|0, b=60+Math.sin(v*22)*8|0;
            ctx.fillStyle=`rgb(${r},${g},${b})`; ctx.fillRect(0,y,w,1);
        }
        // облачные вихри
        for(let i=0;i<8;i++){
            const cx=Math.random()*w, cy=Math.random()*h;
            const grad=ctx.createRadialGradient(cx,cy,0,cx,cy,60+Math.random()*80);
            grad.addColorStop(0,'rgba(255,230,120,0.3)'); grad.addColorStop(1,'rgba(200,160,60,0)');
            ctx.fillStyle=grad; ctx.beginPath(); ctx.ellipse(cx,cy,80+Math.random()*60,30+Math.random()*20,Math.random()*Math.PI,0,Math.PI*2); ctx.fill();
        }
    }),
    mars: () => makeTex(512, 256, (ctx, w, h) => {
        for(let y=0;y<h;y++){
            const v=y/h;
            for(let x=0;x<w;x++){
                const u=x/w, n=noiseVal(u,v,6);
                const r=180+n*40|0, g=80+n*20|0, b=40+n*10|0;
                ctx.fillStyle=`rgb(${r},${g},${b})`; ctx.fillRect(x,y,1,1);
            }
        }
        // тёмные регионы
        [[0.25,0.45,70,40],[0.75,0.5,90,35],[0.5,0.55,55,28]].forEach(([ux,vy,rw,rh])=>{
            const grad=ctx.createRadialGradient(ux*w,vy*h,0,ux*w,vy*h,rw);
            grad.addColorStop(0,'rgba(100,35,15,0.5)'); grad.addColorStop(1,'rgba(100,35,15,0)');
            ctx.fillStyle=grad; ctx.fillRect(0,0,w,h);
        });
        // полярные шапки
        ctx.fillStyle='rgba(240,240,255,0.85)'; ctx.beginPath(); ctx.ellipse(w/2,4,w*0.25,12,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='rgba(240,240,255,0.75)'; ctx.beginPath(); ctx.ellipse(w/2,h-4,w*0.18,10,0,0,Math.PI*2); ctx.fill();
    }),
    jupiter: () => makeTex(1024, 512, (ctx, w, h) => {
        const bands = [
            {y:0.00,h:0.06,c:'#c8956a'},{y:0.06,h:0.05,c:'#e8c898'},{y:0.11,h:0.08,c:'#b07848'},
            {y:0.19,h:0.06,c:'#d8b880'},{y:0.25,h:0.10,c:'#c88858'},{y:0.35,h:0.08,c:'#e0c890'},
            {y:0.43,h:0.14,c:'#c07040'},{y:0.57,h:0.08,c:'#e0c890'},{y:0.65,h:0.10,c:'#c88858'},
            {y:0.75,h:0.06,c:'#d8b880'},{y:0.81,h:0.08,c:'#b07848'},{y:0.89,h:0.05,c:'#e8c898'},{y:0.94,h:0.06,c:'#c8956a'},
        ];
        bands.forEach(b=>{
            ctx.fillStyle=b.c; ctx.fillRect(0,b.y*h,w,b.h*h+1);
            // волнистость
            ctx.beginPath(); ctx.moveTo(0,b.y*h);
            for(let x=0;x<=w;x+=4) ctx.lineTo(x,(b.y+Math.sin(x*0.04)*0.012)*h);
            ctx.lineTo(w,(b.y+b.h)*h); ctx.lineTo(0,(b.y+b.h)*h); ctx.closePath();
            ctx.fillStyle='rgba(0,0,0,0.08)'; ctx.fill();
        });
        // Большое красное пятно
        const sx=w*0.65, sy=h*0.56;
        const rsg=ctx.createRadialGradient(sx,sy,0,sx,sy,w*0.05);
        rsg.addColorStop(0,'#c83010'); rsg.addColorStop(0.6,'#b04020'); rsg.addColorStop(1,'rgba(160,60,30,0)');
        ctx.fillStyle=rsg; ctx.beginPath(); ctx.ellipse(sx,sy,w*0.06,h*0.05,0.3,0,Math.PI*2); ctx.fill();
        // Шум
        for(let i=0;i<2000;i++){
            ctx.fillStyle=`rgba(0,0,0,${Math.random()*0.04})`;
            ctx.fillRect(Math.random()*w,Math.random()*h,2,1);
        }
    }),
    saturn: () => makeTex(512, 256, (ctx, w, h) => {
        const bands=[
            {y:0.05,h:0.08,c:'#d4b06a'},{y:0.13,h:0.06,c:'#e8cc88'},
            {y:0.19,h:0.12,c:'#c89858'},{y:0.31,h:0.08,c:'#e0c070'},
            {y:0.39,h:0.22,c:'#d4a850'},{y:0.61,h:0.08,c:'#e0c070'},
            {y:0.69,h:0.12,c:'#c89858'},{y:0.81,h:0.06,c:'#e8cc88'},{y:0.87,h:0.08,c:'#d4b06a'},
        ];
        ctx.fillStyle='#c8a050'; ctx.fillRect(0,0,w,h);
        bands.forEach(b=>{ ctx.fillStyle=b.c; ctx.fillRect(0,b.y*h,w,b.h*h+1); });
        for(let i=0;i<1000;i++){ctx.fillStyle=`rgba(0,0,0,${Math.random()*0.03})`;ctx.fillRect(Math.random()*w,Math.random()*h,2,1);}
    }),
    uranus: () => makeTex(256, 256, (ctx, w, h) => {
        const g=ctx.createRadialGradient(w*0.4,h*0.4,0,w/2,h/2,w*0.6);
        g.addColorStop(0,'#aaeee8'); g.addColorStop(0.5,'#72d0d0'); g.addColorStop(1,'#40a0b0');
        ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
        for(let i=0;i<6;i++){
            const cy=h*(0.2+i*0.12);
            ctx.strokeStyle=`rgba(80,200,200,0.15)`; ctx.lineWidth=8;
            ctx.beginPath(); ctx.moveTo(0,cy); ctx.bezierCurveTo(w*0.3,cy-6,w*0.7,cy+6,w,cy); ctx.stroke();
        }
    }),
    neptune: () => makeTex(256, 256, (ctx, w, h) => {
        const g=ctx.createRadialGradient(w*0.4,h*0.35,0,w/2,h/2,w*0.6);
        g.addColorStop(0,'#4880f0'); g.addColorStop(0.5,'#2050c0'); g.addColorStop(1,'#102090');
        ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
        // тёмное пятно
        const dsg=ctx.createRadialGradient(w*0.6,h*0.55,0,w*0.6,h*0.55,w*0.15);
        dsg.addColorStop(0,'rgba(5,15,80,0.7)'); dsg.addColorStop(1,'rgba(5,15,80,0)');
        ctx.fillStyle=dsg; ctx.fillRect(0,0,w,h);
        // облачные полосы
        for(let i=0;i<5;i++){
            ctx.strokeStyle=`rgba(100,180,255,0.2)`; ctx.lineWidth=5;
            ctx.beginPath(); ctx.moveTo(0,h*(0.2+i*0.15));
            ctx.bezierCurveTo(w*0.25,h*(0.18+i*0.15),w*0.75,h*(0.22+i*0.15),w,h*(0.2+i*0.15)); ctx.stroke();
        }
    }),
};

const SOLAR_PLANETS = [
    { name:'Меркурий', r:0.20, orbit:7,  period:88,    desc:'Самая маленькая планета. Год — 88 суток. Температура от −180 до +430 °C. Нет атмосферы.' },
    { name:'Венера',   r:0.34, orbit:11, period:225,   desc:'Самая горячая планета (462 °C). Плотные облака из серной кислоты. Год — 225 суток.' },
    { name:'Земля',    r:0.36, orbit:15, period:365,   desc:'Единственная планета с жизнью. Магнитосфера защищает от солнечного ветра.', isEarth:true },
    { name:'Марс',     r:0.26, orbit:20, period:687,   desc:'Красная планета. Гора Олимп — 21 км высотой. Тонкая атмосфера из CO₂. Год — 687 суток.' },
    { name:'Юпитер',  r:0.72, orbit:30, period:4333,  desc:'Крупнейшая планета. Большое красное пятно — шторм существует уже 350+ лет.' },
    { name:'Сатурн',  r:0.60, orbit:40, period:10759, desc:'Кольца изо льда и пыли. Плотность меньше воды. 146 лун.', rings:true },
    { name:'Уран',    r:0.44, orbit:50, period:30687, desc:'Ось наклонена на 98° — вращается "на боку". 13 колец и 27 лун.' },
    { name:'Нептун',  r:0.42, orbit:58, period:60190, desc:'Ветры до 2100 км/ч — рекорд Солнечной системы. Самая далёкая планета.' },
];

function buildPlanetMesh(p) {
    const tl = new THREE.TextureLoader();
    let mesh;

    if (p.isEarth) {
        mesh = new THREE.Mesh(
            new THREE.SphereGeometry(p.r,64,64),
            new THREE.MeshPhongMaterial({map:tl.load('https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg'),shininess:12})
        );
        mesh.add(new THREE.Mesh(new THREE.SphereGeometry(p.r*1.04,32,32),
            new THREE.MeshPhongMaterial({map:tl.load('https://threejs.org/examples/textures/planets/earth_clouds_1024.png'),transparent:true,opacity:0.38,blending:THREE.AdditiveBlending})));
        mesh.add(new THREE.Mesh(new THREE.SphereGeometry(p.r*1.08,32,32),
            new THREE.MeshPhongMaterial({color:0x3399ff,transparent:true,opacity:0.13,side:THREE.BackSide})));
        // силовые линии
        [-60,-30,0,30,60].forEach(a=>{
            const ring=new THREE.Mesh(new THREE.TorusGeometry(p.r*2.1+Math.abs(a)*0.003,0.007,6,48),
                new THREE.MeshBasicMaterial({color:0x4488ff,transparent:true,opacity:0.28}));
            ring.rotation.x=Math.PI/2; ring.rotation.z=a*Math.PI/180; mesh.add(ring);
        });
        // aurora
        [p.r*0.9,-p.r*0.9].forEach(y=>{
            const ar=new THREE.Mesh(new THREE.TorusGeometry(p.r*0.75,0.013,8,48),
                new THREE.MeshBasicMaterial({color:0x22d3a3,transparent:true,opacity:0.8}));
            ar.rotation.x=Math.PI/2; ar.position.y=y; mesh.add(ar);
        });
        return mesh;
    }

    const texKeys = {Меркурий:'mercury',Венера:'venus',Марс:'mars',Юпитер:'jupiter',Сатурн:'saturn',Уран:'uranus',Нептун:'neptune'};
    const texKey = texKeys[p.name];
    const tex = texKey ? PLANET_TEX[texKey]() : null;
    const mat = tex
        ? new THREE.MeshStandardMaterial({map:tex, roughness:0.75, metalness:0.0})
        : new THREE.MeshStandardMaterial({color:0xaaaaaa,roughness:0.8});

    mesh = new THREE.Mesh(new THREE.SphereGeometry(p.r,48,48), mat);

    // Атмосфера Венеры
    if (p.name==='Венера') {
        mesh.add(new THREE.Mesh(new THREE.SphereGeometry(p.r*1.05,32,32),
            new THREE.MeshStandardMaterial({color:0xd4a030,transparent:true,opacity:0.22,side:THREE.BackSide})));
    }
    // Атмосфера Марса (лёгкая дымка)
    if (p.name==='Марс') {
        mesh.add(new THREE.Mesh(new THREE.SphereGeometry(p.r*1.03,32,32),
            new THREE.MeshStandardMaterial({color:0xc06020,transparent:true,opacity:0.08,side:THREE.BackSide})));
    }
    // Кольца Сатурна
    if (p.rings) {
        [[0.82,1.10,0xd4b483,0.85],[1.12,1.60,0xb89060,0.7],[1.62,2.00,0xc8a870,0.55],[2.02,2.40,0xa07845,0.3]].forEach(([ri,ro,col,op])=>{
            const r=new THREE.Mesh(new THREE.RingGeometry(ri,ro,128),
                new THREE.MeshBasicMaterial({color:col,side:THREE.DoubleSide,transparent:true,opacity:op}));
            r.rotation.x=Math.PI/2-0.47; mesh.add(r);
        });
    }
    // Кольца Урана
    if (p.name==='Уран') {
        [0.57,0.63,0.70].forEach(r=>{
            const ring=new THREE.Mesh(new THREE.RingGeometry(r,r+0.015,64),
                new THREE.MeshBasicMaterial({color:0x88d8d8,side:THREE.DoubleSide,transparent:true,opacity:0.5}));
            ring.rotation.z=1.71; mesh.add(ring);
        });
    }
    return mesh;
}

function initSolarSystem() {
    const container = document.getElementById('solar-container');
    if (!container) return;
    container.innerHTML = '';
    if (solarAnimId) { cancelAnimationFrame(solarAnimId); solarAnimId = null; }

    try {
        solarScene = new THREE.Scene();
        solarScene.background = new THREE.Color(0x020510);
        const W = container.clientWidth || 800;
        const H = Math.max(480, Math.round(W * 0.56));
        container.style.height = H + 'px';

        solarCamera = new THREE.PerspectiveCamera(48, W/H, 0.05, 2000);
        solarCamera.position.set(0, 35, 70);
        solarCamera.lookAt(0,0,0);

        solarRenderer = new THREE.WebGLRenderer({antialias:true});
        solarRenderer.setSize(W, H);
        solarRenderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
        container.appendChild(solarRenderer.domElement);

        solarControls = new THREE.OrbitControls(solarCamera, solarRenderer.domElement);
        solarControls.enableDamping = true;
        solarControls.dampingFactor = 0.07;
        solarControls.minDistance   = 0.3;
        solarControls.maxDistance   = 180;

        // ── Звёзды ──
        const sp = new Float32Array(12000);
        for(let i=0;i<12000;i++) sp[i]=(Math.random()-0.5)*1600;
        const sg=new THREE.BufferGeometry(); sg.setAttribute('position',new THREE.BufferAttribute(sp,3));
        solarScene.add(new THREE.Points(sg, new THREE.PointsMaterial({color:0xffffff,size:0.2})));

        // ── Солнце ──
        // Базовая сфера с canvas-текстурой
        // ── Солнце — детализированная текстура ──
        const sunTex = makeTex(1024, 1024, (ctx, w, h) => {
            // Базовый градиент — тёмный центр у края (limb darkening)
            const g = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, w*0.5);
            g.addColorStop(0,   '#fffde0');
            g.addColorStop(0.25,'#ffe066');
            g.addColorStop(0.55,'#ff9900');
            g.addColorStop(0.78,'#e05500');
            g.addColorStop(1,   '#7a1a00');
            ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

            // Гранулы — конвективные ячейки
            for (let i = 0; i < 2200; i++) {
                const angle = Math.random() * Math.PI * 2;
                const dist  = Math.random() * w * 0.46;
                const x = w/2 + Math.cos(angle)*dist;
                const y = h/2 + Math.sin(angle)*dist;
                const r = 3 + Math.random() * 14;
                const bright = 0.12 + (1 - dist/(w*0.46)) * 0.18;
                const col = Math.random() > 0.5
                    ? `rgba(255,${200+Math.random()*55|0},${30+Math.random()*40|0},${bright})`
                    : `rgba(${120+Math.random()*60|0},${40+Math.random()*30|0},0,${bright*0.7})`;
                ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2);
                ctx.fillStyle = col; ctx.fill();
            }

            // Солнечные пятна (тёмные области с полутенью)
            [[0.35,0.42],[0.62,0.53],[0.48,0.68],[0.55,0.35]].forEach(([ux,uy]) => {
                const sx = ux*w, sy = uy*h;
                const R  = 18 + Math.random()*22;
                // полутень
                const pg = ctx.createRadialGradient(sx,sy,0,sx,sy,R*2.2);
                pg.addColorStop(0,'rgba(40,10,0,0.85)');
                pg.addColorStop(0.5,'rgba(80,25,0,0.5)');
                pg.addColorStop(1,'rgba(0,0,0,0)');
                ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(sx,sy,R*2.2,0,Math.PI*2); ctx.fill();
                // тень
                ctx.beginPath(); ctx.arc(sx,sy,R,0,Math.PI*2);
                ctx.fillStyle='rgba(20,5,0,0.9)'; ctx.fill();
            });

            // Активные регионы — яркие пятна
            for(let i=0;i<18;i++){
                const angle=Math.random()*Math.PI*2, dist=Math.random()*w*0.38;
                const x=w/2+Math.cos(angle)*dist, y=h/2+Math.sin(angle)*dist;
                const ag=ctx.createRadialGradient(x,y,0,x,y,15+Math.random()*20);
                ag.addColorStop(0,'rgba(255,255,200,0.55)'); ag.addColorStop(1,'rgba(255,200,0,0)');
                ctx.fillStyle=ag; ctx.beginPath(); ctx.arc(x,y,25,0,Math.PI*2); ctx.fill();
            }
        });

        const sunMesh = new THREE.Mesh(
            new THREE.SphereGeometry(3.5, 64, 64),
            new THREE.MeshBasicMaterial({ map: sunTex })
        );
        solarScene.add(sunMesh);

        // Корона — мягкие слои свечения
        [
            [4.0, 0xff8800, 0.22],
            [5.2, 0xff5500, 0.13],
            [7.0, 0xff3300, 0.07],
            [10.0,0xcc2200, 0.03],
        ].forEach(([r,c,o]) => {
            solarScene.add(new THREE.Mesh(
                new THREE.SphereGeometry(r, 32, 32),
                new THREE.MeshBasicMaterial({color:c, transparent:true, opacity:o, side:THREE.BackSide, depthWrite:false})
            ));
        });

        // Протуберанцы — дуги из TorusGeometry (не прямоугольники!)
        const promMeshes = [];
        for (let i = 0; i < 14; i++) {
            const angle  = (i / 14) * Math.PI * 2 + Math.random() * 0.4;
            const height = 0.6 + Math.random() * 1.8;
            const width  = 0.3 + Math.random() * 0.5;
            // Тор как полудуга
            const geo = new THREE.TorusGeometry(height, 0.04 + Math.random()*0.06, 8, 24, Math.PI * (0.5 + Math.random()*0.8));
            const col = Math.random() > 0.4 ? 0xff6600 : 0xff3300;
            const mat = new THREE.MeshBasicMaterial({
                color: col, transparent: true,
                opacity: 0.25 + Math.random() * 0.45,
                side: THREE.DoubleSide, depthWrite: false
            });
            const arc = new THREE.Mesh(geo, mat);
            // Поворачиваем дугу по поверхности солнца
            arc.rotation.z  = angle;
            arc.rotation.x  = Math.random() * Math.PI;
            arc.position.set(
                Math.cos(angle) * (3.5 + height * 0.5),
                Math.sin(angle) * (3.5 + height * 0.5),
                (Math.random()-0.5) * 2
            );
            arc.userData = { phase: Math.random()*Math.PI*2, speed: 0.2+Math.random()*0.5 };
            solarScene.add(arc);
            promMeshes.push(arc);
        }

        solarScene.add(new THREE.PointLight(0xfff0c0, 3.0, 600));
        solarScene.add(new THREE.AmbientLight(0x0a0a25, 1.0));

        // ── Планеты ──
        const planetMeshes = [];
        const orbitAngles  = SOLAR_PLANETS.map(()=>Math.random()*Math.PI*2);

        SOLAR_PLANETS.forEach((p,i)=>{
            // орбита
            const pts=[];
            for(let a=0;a<=Math.PI*2+0.05;a+=0.025)
                pts.push(new THREE.Vector3(Math.cos(a)*p.orbit,0,Math.sin(a)*p.orbit));
            solarScene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
                new THREE.LineBasicMaterial({color:0x1a2a44,transparent:true,opacity:0.45})));

            const mesh = buildPlanetMesh(p);
            mesh.userData = {idx:i, name:p.name};
            mesh.position.set(Math.cos(orbitAngles[i])*p.orbit, 0, Math.sin(orbitAngles[i])*p.orbit);
            solarScene.add(mesh);
            planetMeshes.push(mesh);
        });

        // ── UI ──
        container.style.position='relative';
        const backBtn=document.createElement('button');
        backBtn.textContent='Вся система';
        backBtn.style.cssText='position:absolute;top:12px;left:12px;background:rgba(10,20,50,0.8);color:#cde;border:1px solid rgba(80,140,255,0.35);padding:6px 16px;border-radius:8px;cursor:pointer;font-size:13px;display:none;z-index:10;backdrop-filter:blur(4px);';
        backBtn.onclick=()=>{
            solarFollowed=null;
            solarControls.minDistance=0.3;
            backBtn.style.display='none';
            const panel=document.getElementById('solar-planet-panel');
            if(panel) panel.style.display='none';
        };
        container.appendChild(backBtn);

        const hint=document.createElement('div');
        hint.textContent='Нажмите на планету';
        hint.style.cssText='position:absolute;bottom:12px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.5);color:rgba(255,255,255,0.5);padding:4px 16px;border-radius:20px;font-size:12px;pointer-events:none;z-index:10;';
        container.appendChild(hint);

        // ── Raycaster ──
        const raycaster=new THREE.Raycaster();
        const mouse=new THREE.Vector2();

        solarRenderer.domElement.addEventListener('click',e=>{
            const rect=solarRenderer.domElement.getBoundingClientRect();
            mouse.x= ((e.clientX-rect.left)/rect.width)*2-1;
            mouse.y=-((e.clientY-rect.top)/rect.height)*2+1;
            raycaster.setFromCamera(mouse,solarCamera);
            const hits=raycaster.intersectObjects(planetMeshes,true);
            if(!hits.length) return;
            let obj=hits[0].object;
            while(obj.parent && obj.userData.idx===undefined) obj=obj.parent;
            if(obj.userData.idx===undefined) return;

            const idx=obj.userData.idx;
            const p=SOLAR_PLANETS[idx];
            const dist=p.r*5.5+0.8;
            solarFollowed={mesh:planetMeshes[idx], offset:new THREE.Vector3(dist, dist*0.4, dist)};
            solarControls.minDistance=0.2; // позволить подлетать очень близко
            backBtn.style.display='block';
            hint.style.display='none';

            const panel=document.getElementById('solar-planet-panel');
            if(panel){
                panel.style.display='block';
                panel.innerHTML=`<div class="iblock info" style="margin-top:0;">
                    <h4>${p.name}</h4><p>${p.desc}</p>
                    ${p.isEarth?'<p><strong>Магнитосфера:</strong> синие кольца — силовые линии поля, зелёные — зоны полярных сияний.</p>':''}
                </div>`;
            }
        });

        solarRenderer.domElement.addEventListener('mousemove',e=>{
            const rect=solarRenderer.domElement.getBoundingClientRect();
            mouse.x= ((e.clientX-rect.left)/rect.width)*2-1;
            mouse.y=-((e.clientY-rect.top)/rect.height)*2+1;
            raycaster.setFromCamera(mouse,solarCamera);
            solarRenderer.domElement.style.cursor=raycaster.intersectObjects(planetMeshes,true).length?'pointer':'grab';
        });

        // ── Анимация ──
        const clock=new THREE.Clock();
        const EARTH_REF=365;

        (function animate(){
            solarAnimId=requestAnimationFrame(animate);
            const dt=Math.min(clock.getDelta(),0.05);
            const baseAngPerSec=(2*Math.PI)/180;

            SOLAR_PLANETS.forEach((p,i)=>{
                orbitAngles[i]+=(EARTH_REF/p.period)*baseAngPerSec*dt;
                const mesh=planetMeshes[i];
                mesh.position.x=Math.cos(orbitAngles[i])*p.orbit;
                mesh.position.z=Math.sin(orbitAngles[i])*p.orbit;
                mesh.rotation.y+=0.004;
            });

            sunMesh.rotation.y += 0.0003;

            // Анимация протуберанцев — пульсация прозрачности и масштаба
            const t = clock.elapsedTime || 0;
            promMeshes.forEach(arc => {
                const { phase, speed } = arc.userData;
                const s = 0.5 + 0.5 * Math.sin(t * speed + phase);
                arc.material.opacity = 0.12 + s * 0.38;
                arc.scale.setScalar(0.85 + s * 0.3);
            });

            if(solarFollowed){
                const wp=solarFollowed.mesh.position.clone();
                solarCamera.position.lerp(wp.clone().add(solarFollowed.offset),0.07);
                solarControls.target.lerp(wp,0.07);
            }

            solarControls.update();
            solarRenderer.render(solarScene,solarCamera);
        })();

    } catch(e){
        console.error('Solar system error:',e);
        const c=document.getElementById('solar-container');
        if(c) c.innerHTML='<div style="color:white;text-align:center;padding:80px">3D-сцена временно недоступна</div>';
    }
}

// ═══════════════════════════════════════════════════════════
//  CME АНИМАЦИЯ
// ═══════════════════════════════════════════════════════════
let cmeAnimRunning = false, waveProgress = 0;

function initCMEAnim() {
    const canvas = document.getElementById('cme-canvas');
    if (!canvas || cmeAnimRunning) return;
    cmeAnimRunning = true;
    const ctx = canvas.getContext('2d');
    const resize = () => { canvas.width = canvas.clientWidth || 800; canvas.height = canvas.clientHeight || 460; };
    resize();
    window.addEventListener('resize', resize);

    let particles = [];
    function resetP(sx, sy) {
        particles = Array.from({ length: 40 }, () => ({
            x: sx + (Math.random() - 0.5) * 20,
            y: sy + (Math.random() - 0.5) * 30,
            vx: 0.5 + Math.random() * 2,
            vy: (Math.random() - 0.5) * 1.5,
            size: 1 + Math.random() * 3,
            opacity: 0.3 + Math.random() * 0.7
        }));
    }

    function draw() {
        if (!cmeAnimRunning) return;
        requestAnimationFrame(draw);
        const W = canvas.width, H = canvas.height;
        const sx = 50, ex = W - 50, sy = H / 2;
        if (!particles.length) resetP(sx, sy);
        ctx.clearRect(0, 0, W, H);

        // Солнце
        ctx.beginPath(); ctx.arc(sx, sy, 35, 0, Math.PI * 2);
        const sg = ctx.createRadialGradient(sx-5, sy-5, 5, sx, sy, 40);
        sg.addColorStop(0, '#fbbf24'); sg.addColorStop(1, '#f97316');
        ctx.fillStyle = sg; ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 30; ctx.fill();

        // Земля
        ctx.beginPath(); ctx.arc(ex, sy, 25, 0, Math.PI * 2);
        const eg = ctx.createRadialGradient(ex-5, sy-5, 5, ex, sy, 30);
        eg.addColorStop(0, '#3b82f6'); eg.addColorStop(1, '#1e3a8a');
        ctx.fillStyle = eg; ctx.shadowColor = '#3b82f6'; ctx.fill();
        ctx.shadowBlur = 0;

        // Подписи
        ctx.font = 'bold 13px "Space Mono",monospace'; ctx.textAlign = 'center';
        ctx.fillStyle = '#fbbf24'; ctx.fillText('СОЛНЦЕ', sx, sy + 56);
        ctx.font = '11px Syne,sans-serif'; ctx.fillStyle = 'rgba(251,191,36,0.6)'; ctx.fillText('источник CME', sx, sy + 70);
        ctx.font = 'bold 13px "Space Mono",monospace'; ctx.fillStyle = '#60a5fa'; ctx.fillText('ЗЕМЛЯ', ex, sy + 44);
        ctx.font = '11px Syne,sans-serif'; ctx.fillStyle = 'rgba(96,165,250,0.6)'; ctx.fillText('1–3 дня пути', ex, sy + 57);

        // Ударный фронт
        if (waveProgress < 1) {
            const wx = sx + (ex - sx) * waveProgress;
            ctx.beginPath(); ctx.arc(wx, sy, 20, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(248,113,113,0.15)'; ctx.fill();
            ctx.strokeStyle = 'rgba(248,113,113,0.8)'; ctx.lineWidth = 2; ctx.stroke();
            waveProgress += 0.002;
        } else { waveProgress = 0; }

        // Таймер
        const days = ((ex - (sx + (ex - sx) * waveProgress)) / (ex - sx) * 3).toFixed(1);
        ctx.font = 'bold 14px "Space Mono",monospace';
        ctx.fillStyle = '#fbbf24'; ctx.shadowColor = '#f97316'; ctx.shadowBlur = 10;
        ctx.fillText(`~ ${days} дн. до Земли`, (sx + ex) / 2, sy - 60);
        ctx.shadowBlur = 0;

        // Частицы
        particles.forEach(p => {
            ctx.shadowColor = 'rgba(248,113,113,0.8)'; ctx.shadowBlur = 12;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(248,113,113,${p.opacity})`; ctx.fill();
            p.x += p.vx; p.y += p.vy; p.opacity *= 0.995;
            if (p.x > ex || p.opacity < 0.01) {
                p.x = sx; p.y = sy + (Math.random() - 0.5) * 40;
                p.vx = 0.5 + Math.random() * 2.5; p.vy = (Math.random() - 0.5) * 1.5;
                p.opacity = 0.5 + Math.random() * 0.5;
            }
        });
        ctx.shadowBlur = 0;

        // Пунктир
        ctx.beginPath(); ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.setLineDash([5, 5]);
        ctx.moveTo(sx + 40, sy); ctx.lineTo(ex - 30, sy); ctx.stroke(); ctx.setLineDash([]);
    }
    draw();
}

// ═══════════════════════════════════════════════════════════
//  ГРАФИКИ (с реальными данными NOAA)
// ═══════════════════════════════════════════════════════════
let cmeChart, geoChart, windChart;
const chartOpts = { responsive: true, plugins: { legend: { labels: { color: '#8899bb' }, onClick: () => {} } } };

function initCMEChart() {
    const ctx = document.getElementById('cmeChart');
    const date = new Date();
    let now_date = date.getDate();
    let now_month = date.getMonth() + 1;
    if (now_month < 10) {
        now_month = '0' + now_month;
    }
    if (!ctx) return;
    if (cmeChart) cmeChart.destroy();
    cmeChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [now_date - 4 + '.' + now_month, now_date - 3 + '.' + now_month, now_date - 2 + '.' + now_month, now_date - 1 + '.' + now_month, now_date + '.' + now_month],
            datasets: [{ label: 'Скорость CME (км/с)', data: [420, 380, 510, 350, 290], borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,0.1)', tension: 0.4, fill: true }]
        },
        options: { ...chartOpts, scales: { y: { ticks: { color: '#8899bb' }, grid: { color: 'rgba(255,255,255,0.1)' }, title: { display: true, text: 'км/с', color: '#8899bb' } }, x: { ticks: { color: '#8899bb' }, grid: { color: 'rgba(255,255,255,0.1)' } } } }
    });
}

function initGeoChart() {
    const ctx = document.getElementById('geoChart');
    if (!ctx) return;
    if (geoChart) geoChart.destroy();
    const useReal = liveData.kpHistory.length >= 4;
    const labels  = useReal ? liveData.kpHistory.map(d => d.label) : Array.from({ length: 24 }, (_, i) => `${i}:00`);
    const values  = useReal ? liveData.kpHistory.map(d => d.value) : Array.from({ length: 24 }, () => +(2 + Math.random() * 2).toFixed(1));
    geoChart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets: [{ label: useReal ? 'Kp (данные NOAA)' : 'Kp-индекс', data: values, borderColor: '#22d3a3', backgroundColor: 'rgba(34,211,163,0.1)', tension: 0.4, fill: true, pointRadius: values.length <= 24 ? 3 : 1 }] },
        options: { ...chartOpts, scales: { y: { min: 0, max: 9, ticks: { color: '#8899bb' }, grid: { color: 'rgba(255,255,255,0.1)' }, title: { display: true, text: 'Kp', color: '#8899bb' } }, x: { ticks: { color: '#8899bb', maxRotation: 45, autoSkip: true, maxTicksLimit: 12 }, grid: { color: 'rgba(255,255,255,0.1)' } } } }
    });
}

function initWindChart() {
    const ctx = document.getElementById('windChart');
    if (!ctx) return;
    if (windChart) windChart.destroy();
    const useReal = liveData.windHistory.length >= 4;
    const labels  = useReal ? liveData.windHistory.map(d => d.label) : Array.from({ length: 48 }, (_, i) => `${i}h`);
    const values  = useReal ? liveData.windHistory.map(d => d.value) : Array.from({ length: 48 }, () => Math.round(380 + Math.random() * 80));
    windChart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets: [{ label: useReal ? 'Скорость ветра (км/с, NOAA)' : 'Скорость (км/с)', data: values, borderColor: '#fbbf24', backgroundColor: 'rgba(251,191,36,0.1)', tension: 0.4, fill: true, pointRadius: values.length <= 48 ? 2 : 0 }] },
        options: { ...chartOpts, scales: { y: { ticks: { color: '#8899bb' }, grid: { color: 'rgba(255,255,255,0.1)' }, title: { display: true, text: 'км/с', color: '#8899bb' } }, x: { ticks: { color: '#8899bb', maxRotation: 45, autoSkip: true, maxTicksLimit: 12 }, grid: { color: 'rgba(255,255,255,0.1)' } } } }
    });
}

// ═══════════════════════════════════════════════════════════
//  ЗАГРУЗКА ДАННЫХ
// ═══════════════════════════════════════════════════════════
async function loadAllData() {
    const loading = document.getElementById('loadingIndicator');
    if (loading) loading.style.display = 'block';

    await fetchAllNoaaData();

    if (loading) loading.style.display = 'none';
    applyAllData();

    // Обновить открытые графики
    const activeId = document.querySelector('.page.active')?.id;
    if (activeId === 'geomagnetic') initGeoChart();
    if (activeId === 'solarwind')   initWindChart();

    // Строка обновления
    const updateEl = document.getElementById('lastUpdate');
    if (updateEl) {
        updateEl.innerHTML = `
            <span>Данные NOAA обновлены: <strong>${new Date().toLocaleString('ru-RU')}</strong></span>
            <span id="nextUpdate"></span>
        `;
    }
    startCountdown();

    // Email-алерт при буре
    const kp = liveData.kp ?? 0;
    if (kp >= 5) {
        const bz   = liveData.bz   != null ? parseFloat(liveData.bz) : null;
        const wind = liveData.windSpeed;
        sendStormAlert(kp, bz, wind);
    }
}

// ═══════════════════════════════════════════════════════════
//  ЕЖЕДНЕВНОЕ ОБНОВЛЕНИЕ (при открытии сайта)
// ═══════════════════════════════════════════════════════════
function checkDailyRefresh() {
    const today     = new Date().toDateString();
    const lastDay   = localStorage.getItem('swp_last_day');
    if (lastDay !== today) {
        localStorage.setItem('swp_last_day', today);
        console.log('[SWP] Новый день — принудительное обновление данных NOAA');
        return true; // нужно обновить
    }
    return false;
}

// ═══════════════════════════════════════════════════════════
//  ИНИЦИАЛИЗАЦИЯ
// ═══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
    initGeolocation();
    initAuroraMap();
    initEarth();
    initSolarSystem();
    initCMEAnim();

    const updateEl = document.getElementById('lastUpdate');
    if (updateEl) updateEl.innerHTML = '<span style="opacity:0.6">⏳ Загрузка данных NOAA...</span>';

    // Всегда грузим при открытии — данные всегда свежие
    await loadAllData();
    checkDailyRefresh(); // сохраняем дату для следующего дня

    // Запустить 12-часовой планировщик сводок в Telegram
    startSummaryScheduler();

    initCMEChart();
    initGeoChart();
    initWindChart();
});

window.addEventListener('resize', () => {
    if (earthRenderer && earthCamera) {
        const c = document.getElementById('earth-container');
        if (c) {
            earthRenderer.setSize(c.clientWidth, c.clientHeight);
            earthCamera.aspect = c.clientWidth / c.clientHeight;
            earthCamera.updateProjectionMatrix();
        }
    }
});

// ═══════════════════════════════════════════════════════════
//  ПОДПИСКА
// ═══════════════════════════════════════════════════════════
function switchSubTab(type, btn) {
    document.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.sub-form').forEach(f => f.classList.remove('visible'));
    document.getElementById('subForm' + type.charAt(0).toUpperCase() + type.slice(1)).classList.add('visible');
    const ss = document.getElementById('subSuccess');
    if (ss) ss.classList.remove('show');
}

function submitSubscription(type) {
    const input = document.getElementById('subTgInput');
    const val   = input ? input.value.trim() : '';
    if (!val) { if (input) input.focus(); return; }

    // Нормализуем username
    const username = val.startsWith('@') ? val : '@' + val;

    const events = [];
    if (document.getElementById('chkCme')?.checked)   events.push('CME');
    if (document.getElementById('chkFlare')?.checked) events.push('X-вспышка');
    if (document.getElementById('chkKp')?.checked)    events.push('Kp≥5');
    if (document.getElementById('chkDaily')?.checked) events.push('Ежедневно');

    const subs = JSON.parse(localStorage.getItem('swp_subs') || '[]');

    // Показываем промежуточный статус
    const st = document.getElementById('subSuccessTitle');
    const sx = document.getElementById('subSuccessText');
    const ss = document.getElementById('subSuccess');
    if (st) st.textContent = 'Ищем ваш аккаунт в Telegram...';
    if (sx) sx.textContent = `Убедитесь что вы написали /start боту @spaceweather67_bot`;
    if (ss) ss.classList.add('show');

    getTelegramChatId(username).then(chatId => {
        const entry = { type: 'telegram', value: username, chatId, events, date: new Date().toLocaleDateString('ru-RU') };
        subs.push(entry);
        localStorage.setItem('swp_subs', JSON.stringify(subs));

        if (chatId) {
            sendWelcomeTelegram(chatId, events);
            if (st) st.textContent = 'Telegram подключён!';
            if (sx) sx.textContent = `Сводка отправлена на ${username}. Следующая — через 12 часов. Уведомления при: ${events.join(', ')}.`;
        } else {
            if (st) st.textContent = 'Аккаунт не найден';
            if (sx) sx.textContent = `Напишите /start боту @spaceweather67_bot в Telegram, затем попробуйте снова.`;
        }
    });

    if (input) input.value = '';
    console.log('[Space Weather Pro] Подписка Telegram:', { username, events });
}

function openManageModal() {
    const subs = JSON.parse(localStorage.getItem('swp_subs') || '[]');
    const list = document.getElementById('subManageList');
    if (!list) return;
    list.innerHTML = subs.length
        ? subs.map((s, i) =>
            `<div class="sub-list-item">
                <div>
                    <strong>@ ${s.value}</strong>
                    <div style="font-size:12px;opacity:0.6;margin-top:2px;">${s.events.join(', ')} · ${s.date}</div>
                </div>
                <button class="sub-del-btn" onclick="deleteSub(${i})">Удалить</button>
            </div>`
        ).join('')
        : '<p style="opacity:0.6;font-size:14px;">Нет активных подписок.</p>';
    document.getElementById('subManageOverlay').classList.add('open');
}

function deleteSub(idx) {
    const subs = JSON.parse(localStorage.getItem('swp_subs') || '[]');
    subs.splice(idx, 1);
    localStorage.setItem('swp_subs', JSON.stringify(subs));
    openManageModal();
}

function closeManageModal(e) {
    if (!e || e.target === document.getElementById('subManageOverlay'))
        document.getElementById('subManageOverlay').classList.remove('open');
}

import aiohttp
import asyncio
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
import base64
import os
import sys
import io
import re

# Устанавливаем кодировку stdout на UTF-8 для Windows
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Константы
NOAA_BASE = "https://services.swpc.noaa.gov/json"

# РАБОЧИЕ эндпоинты NOAA
ENDPOINTS = {
    'kp_forecast': f'{NOAA_BASE}/geospace/predicted_kp.json',
    'kp_index': f'{NOAA_BASE}/planetary_k_index_1m.json',
    'dst': f'{NOAA_BASE}/geospace/geospace_dst_1_hour.json',
    'flux_7day': f'{NOAA_BASE}/goes/primary/xrays-7-day.json',
    'proton': f'{NOAA_BASE}/rtsw/rtsw_wind_1m.json',
    'bz_gms': f'{NOAA_BASE}/rtsw/rtsw_mag_1m.json',
    'sunspots': f'{NOAA_BASE}/solar-cycle/sunspots.json',
    'alerts': f'{NOAA_BASE}/alerts.json',
    'aurora_forecast': 'https://services.swpc.noaa.gov/images/aurora-forecast-northern-hemisphere.jpg',
    'aurora_forecast_south': 'https://services.swpc.noaa.gov/images/aurora-forecast-southern-hemisphere.jpg',
}


class SpaceWeatherFetcher:
    """Асинхронный сборщик данных о космической погоде"""

    def __init__(self):
        self.data = {}
        self.images = {}

    def calculate_aurora_probability(self, kp: float, lat: float = 55.0) -> str:
        """Рассчитывает вероятность полярных сияний для заданной широты"""
        if kp >= 7:
            prob = 90 if lat > 50 else (50 if lat > 40 else 20)
        elif kp >= 6:
            prob = 70 if lat > 50 else 30
        elif kp >= 5:
            prob = 40 if lat > 55 else 15
        else:
            prob = 5
        return f"{prob}%"

    async def fetch_json(self, session: aiohttp.ClientSession, url: str, name: str) -> Optional[Any]:
        """Асинхронный GET запрос JSON"""
        try:
            async with session.get(url, timeout=30) as response:
                if response.status == 200:
                    return await response.json()
                print(f"⚠️ {name}: HTTP {response.status}")
                return None
        except Exception as e:
            print(f"⚠️ {name}: {str(e)}")
            return None

    async def fetch_image(self, session: aiohttp.ClientSession, url: str, name: str) -> Optional[str]:
        """Асинхронная загрузка изображения в base64"""
        try:
            async with session.get(url, timeout=30) as response:
                if response.status == 200:
                    img_data = await response.read()
                    return base64.b64encode(img_data).decode('utf-8')
                return None
        except Exception as e:
            return None

    async def get_kp_forecast(self, session) -> float:
        """Получение прогноза Kp из NOAA"""
        data = await self.fetch_json(session, ENDPOINTS['kp_forecast'], 'Kp forecast')
        if data and len(data) > 0:
            try:
                # Проверяем разные форматы данных
                if isinstance(data[0], dict):
                    return float(data[0].get('predicted_kp', 3.3))
                elif isinstance(data[0], list) and len(data[0]) >= 2:
                    return float(data[0][1])
            except (ValueError, TypeError, IndexError):
                pass
        return 3.3

    async def get_kp_data(self, session: aiohttp.ClientSession) -> Dict:
        """Kp-индекс - для карточек и графика"""
        data = await self.fetch_json(session, ENDPOINTS['kp_index'], 'Kp index')

        result = {
            'current': 3.3,
            'forecast': 3.5,
            'status': 'normal',
            'history': [],
            'history_formatted': [],
            'status_text': 'Спокойно',
            'status_badge': 'status-normal'
        }

        if data and len(data) > 0:
            print(f"📡 Kp data sample: {data[-1]}")

            # Определяем структуру данных
            sample = data[-1]
            current = 3.3
            possible_keys = ['kp', 'kp_index', 'Kp', 'value']

            # Получаем текущее значение
            if isinstance(sample, dict):
                for key in possible_keys:
                    if key in sample and sample[key] is not None:
                        try:
                            current = float(sample[key])
                            print(f"✅ Kp по ключу '{key}': {current}")
                            break
                        except (ValueError, TypeError):
                            continue
            elif isinstance(sample, list) and len(sample) >= 2:
                try:
                    current = float(sample[1])
                    print(f"✅ Kp из списка: {current}")
                except (ValueError, TypeError):
                    pass

            result['current'] = current

            # Формируем историю (24 последних значения)
            recent = data[-24:] if len(data) > 24 else data
            history_values = []
            now = datetime.now()

            for i, item in enumerate(recent):
                val = 0
                if isinstance(item, dict):
                    for key in possible_keys:
                        if key in item and item[key] is not None:
                            try:
                                val = float(item[key])
                                break
                            except (ValueError, TypeError):
                                continue
                elif isinstance(item, list) and len(item) >= 2:
                    try:
                        val = float(item[1])
                    except (ValueError, TypeError):
                        pass

                history_values.append(val)

                # Создаем форматированную историю для графиков
                hour = (now - timedelta(hours=len(recent) - i - 1)).strftime('%H:00')
                result['history_formatted'].append({
                    'label': hour,
                    'value': val
                })

            result['history'] = history_values

            # Определяем статус
            if current >= 7:
                result['status'] = 'danger'
                result['status_text'] = 'Сильная буря'
                result['status_badge'] = 'status-danger'
            elif current >= 5:
                result['status'] = 'warning'
                result['status_text'] = 'Магнитная буря'
                result['status_badge'] = 'status-warning'
            else:
                result['status'] = 'normal'
                result['status_text'] = 'Спокойно'
                result['status_badge'] = 'status-normal'

        return result

    async def get_flare_data(self, session: aiohttp.ClientSession) -> Dict:
        """Солнечные вспышки - с фильтрацией по 7 дням и классам"""
        flux_data = await self.fetch_json(session, ENDPOINTS['flux_7day'], 'NOAA Flares')

        result = {
            'count': 0,
            'strongest_class': 'C0.0',
            'strongest_class_display': 'C',
            'm_count': 0,
            'x_count': 0,
            'status': 'normal',
            'status_text': 'В пределах нормы',
            'status_badge': 'status-normal',
            'events': [],
            'probability': 15,
            'average': 5.3,
            'difference': 0,
            'dynamics': '◆ 0%',
            'dynamics_class': 'dyn-flat'
        }

        if flux_data and len(flux_data) > 0:
            week_ago = datetime.now() - timedelta(days=7)
            flares_last_7days = []

            for item in flux_data:
                flux = item.get('flux', 0)

                # Фильтруем только значимые вспышки (>= C1.0)
                if flux < 1e-6:  # меньше C1.0
                    continue

                time_tag = item.get('time_tag', '')
                if time_tag:
                    try:
                        if 'T' in time_tag:
                            item_date = datetime.fromisoformat(time_tag.replace('Z', '+00:00'))
                        else:
                            item_date = datetime.strptime(time_tag[:19], '%Y-%m-%d %H:%M:%S')

                        # Только за последние 7 дней
                        if item_date > week_ago:
                            flares_last_7days.append(item)
                    except:
                        # Если дату не удалось распарсить, пропускаем
                        continue

            result['count'] = len(flares_last_7days)
            print(f"✅ Вспышек за 7 дней: {result['count']}")

            if result['count'] > 0:
                # Подсчет M и X класса
                for flare in flares_last_7days:
                    flux = flare.get('flux', 0)
                    if flux >= 1e-4:
                        result['x_count'] += 1
                    elif flux >= 1e-5:
                        result['m_count'] += 1

                # Определяем самый сильный класс
                strongest_full = 'C0.0'
                for flare in flares_last_7days:
                    flux = flare.get('flux', 0)
                    if flux >= 1e-4:
                        class_val = f"X{flux / 1e-4:.1f}"
                    elif flux >= 1e-5:
                        class_val = f"M{flux / 1e-5:.1f}"
                    else:
                        class_val = f"C{flux / 1e-6:.1f}"

                    if class_val[0] > strongest_full[0]:
                        strongest_full = class_val
                    elif class_val[0] == strongest_full[0]:
                        if float(class_val[1:]) > float(strongest_full[1:]):
                            strongest_full = class_val

                result['strongest_class'] = strongest_full
                result['strongest_class_display'] = strongest_full[0]

                # Статус и вероятность
                if result['x_count'] > 0:
                    result['status'] = 'danger'
                    result['status_text'] = 'Высокая активность'
                    result['status_badge'] = 'status-danger'
                    result['probability'] = 30
                elif result['m_count'] > 0:
                    result['status'] = 'warning'
                    result['status_text'] = 'Повышенная активность'
                    result['status_badge'] = 'status-warning'
                    result['probability'] = 15

                # Последние 5 событий
                recent_flares = flares_last_7days[-5:]
                for flare in recent_flares:
                    flux = flare.get('flux', 0)
                    if flux >= 1e-4:
                        flare_class = 'X'
                        class_full = f"X{flux / 1e-4:.1f}"
                    elif flux >= 1e-5:
                        flare_class = 'M'
                        class_full = f"M{flux / 1e-5:.1f}"
                    else:
                        flare_class = 'C'
                        class_full = f"C{flux / 1e-6:.1f}"

                    result['events'].append({
                        'date': flare.get('time_tag', '')[:10],
                        'class': flare_class,
                        'class_full': class_full,
                        'flux': flux
                    })

                # Расчет для таблицы сравнения
                result['average'] = 5.3
                result['difference'] = round(result['count'] - result['average'], 1)

                diff_percent = 0
                if result['average'] > 0:
                    diff_percent = round((result['difference'] / result['average']) * 100)
                    diff_percent = max(-999, min(999, diff_percent))

                if result['difference'] > 0:
                    result['dynamics'] = f'▲ +{diff_percent}%'
                    result['dynamics_class'] = 'dyn-up'
                elif result['difference'] < 0:
                    result['dynamics'] = f'▼ {diff_percent}%'
                    result['dynamics_class'] = 'dyn-down'
                else:
                    result['dynamics'] = '◆ 0%'
                    result['dynamics_class'] = 'dyn-flat'

        return result

    async def get_solar_wind_data(self, session: aiohttp.ClientSession) -> Dict:
        """Солнечный ветер - с историей"""
        data = await self.fetch_json(session, ENDPOINTS['proton'], 'Solar wind')

        result = {
            'speed': 410,
            'density': 4.8,
            'temperature': 80000,
            'status': 'normal',
            'status_text': 'В пределах нормы',
            'status_badge': 'status-normal',
            'average': 420,
            'difference': 0,
            'dynamics': '◆ 0%',
            'dynamics_class': 'dyn-flat',
            'history': []
        }

        if data and len(data) > 0:
            # Берем последние 48 записей для истории
            recent_data = data[-48:] if len(data) > 48 else data

            # Текущее значение - последнее
            latest = data[-1]
            speed = latest.get('proton_speed', 410)
            result['speed'] = round(speed, 1)
            result['density'] = round(latest.get('proton_density', 4.8), 2)
            result['temperature'] = round(latest.get('proton_temperature', 80000))

            # Формируем историю для графика
            for item in recent_data:
                time_tag = item.get('time_tag', '')
                speed_val = item.get('proton_speed')
                if speed_val is not None:
                    result['history'].append({
                        'time': time_tag[-8:] if time_tag else '',
                        'speed': round(speed_val, 1)
                    })

            # Определяем статус
            if speed > 600:
                result['status'] = 'warning'
                result['status_text'] = 'Высокая скорость'
                result['status_badge'] = 'status-warning'
            elif speed > 500:
                result['status'] = 'warning'
                result['status_text'] = 'Повышенная скорость'
                result['status_badge'] = 'status-warning'
            elif speed < 300:
                result['status'] = 'warning'
                result['status_text'] = 'Пониженная скорость'
                result['status_badge'] = 'status-warning'

            # Расчет динамики
            result['average'] = 420
            result['difference'] = round(result['speed'] - result['average'], 1)
            diff_percent = round((result['difference'] / result['average']) * 100)

            if result['difference'] > 0:
                result['dynamics'] = f'▲ +{diff_percent}%'
                result['dynamics_class'] = 'dyn-up'
            elif result['difference'] < 0:
                result['dynamics'] = f'▼ {diff_percent}%'
                result['dynamics_class'] = 'dyn-down'

            print(f"✅ Solar wind: {result['speed']} км/с")

        return result

    async def get_sun_data(self, session: aiohttp.ClientSession) -> Dict:
        """Солнечная активность - для карточки Солнца"""
        sunspots_data = await self.fetch_json(session, ENDPOINTS['sunspots'], 'Sunspots')

        result = {
            'sunspot_number': 85,
            'active_regions': 5,
            'cycle': 25,
            'phase': 'рост',
            'status': 'normal',
            'status_text': 'В пределах нормы',
            'status_badge': 'status-normal',
            'display': '85 пятен'
        }

        if sunspots_data and len(sunspots_data) > 0:
            # Берем последнее значение
            latest = sunspots_data[-1]
            spots = round(latest.get('ssn', 85), 1)
            result['sunspot_number'] = spots
            result['display'] = f"{spots} пятен"
            result['active_regions'] = latest.get('regions', 5)

            if spots < 50:
                result['status'] = 'warning'
                result['status_text'] = 'Низкая активность'
                result['status_badge'] = 'status-warning'
            elif spots > 150:
                result['status'] = 'danger'
                result['status_text'] = 'Высокая активность'
                result['status_badge'] = 'status-danger'

            print(f"✅ Sunspots: {spots}")

        return result

    async def get_geomagnetic_data(self, session: aiohttp.ClientSession) -> Dict:
        """Геомагнитные данные - Dst и Bz"""
        dst_data = await self.fetch_json(session, ENDPOINTS['dst'], 'Dst')
        bz_data = await self.fetch_json(session, ENDPOINTS['bz_gms'], 'Bz')

        result = {
            'dst': -10,
            'bt': 5,
            'bz': 0,
            'status': 'normal',
            'status_text': 'Спокойно',
            'status_badge': 'status-normal'
        }

        if dst_data and len(dst_data) > 0:
            result['dst'] = round(dst_data[-1].get('dst', -10), 2)
            print(f"✅ Dst: {result['dst']} nT")

        if bz_data and len(bz_data) > 0:
            latest = bz_data[-1]
            result['bt'] = round(latest.get('bt', 5), 2)
            result['bz'] = round(latest.get('bz_gsm', 0), 2)
            print(f"✅ Bz: {result['bz']} nT")

        bz = result['bz']
        if bz < -10:
            result['status'] = 'danger'
            result['status_text'] = 'Опасное южное направление'
            result['status_badge'] = 'status-danger'
        elif bz < -5:
            result['status'] = 'warning'
            result['status_text'] = 'Южное направление'
            result['status_badge'] = 'status-warning'

        return result

    async def get_cme_data(self, session: aiohttp.ClientSession) -> Dict:
        """Данные о CME из алертов NOAA"""
        alerts_data = await self.fetch_json(session, ENDPOINTS['alerts'], 'NOAA Alerts')

        result = {
            'count': 0,
            'max_speed': 0,
            'status': 'normal',
            'status_text': 'В пределах нормы',
            'status_badge': 'status-normal',
            'events': [],
            'average': 2.5,
            'difference': 0,
            'dynamics': '◆ 0%',
            'dynamics_class': 'dyn-flat',
            'chart_data': {
                'speeds': [],
                'dates': []
            }
        }

        if alerts_data and len(alerts_data) > 0:
            week_ago = datetime.now() - timedelta(days=7)
            cme_events = []

            for alert in alerts_data:
                message = alert.get('message', '').lower()
                product_id = alert.get('product_id', '').lower()

                if 'cme' in message or 'cme' in product_id or 'coronal mass ejection' in message:
                    issue_time = alert.get('issue_datetime', '')
                    if issue_time:
                        try:
                            for fmt in ['%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%dT%H:%M:%SZ']:
                                try:
                                    alert_date = datetime.strptime(issue_time[:19], fmt)
                                    break
                                except:
                                    continue
                            else:
                                alert_date = datetime.now()

                            if alert_date > week_ago:
                                speed = 0
                                speed_match = re.search(r'(\d{3,4})\s*km/s', message, re.IGNORECASE)
                                if speed_match:
                                    speed = int(speed_match.group(1))

                                cme_events.append({
                                    'date': issue_time[:10],
                                    'time': issue_time[11:16] if len(issue_time) > 16 else '00:00',
                                    'speed': speed,
                                    'message': message[:100] + '...' if len(message) > 100 else message
                                })
                        except:
                            continue

            result['count'] = len(cme_events)
            result['events'] = cme_events

            if cme_events:
                speeds = [e['speed'] for e in cme_events if e['speed'] > 0]
                result['max_speed'] = max(speeds) if speeds else 0

                # Данные для графика
                result['chart_data'] = {
                    'speeds': speeds[-5:],
                    'dates': [e['date'] for e in cme_events][-5:]
                }

            # Определяем статус
            if result['count'] > 5:
                result['status'] = 'danger'
                result['status_text'] = 'Очень высокая активность'
                result['status_badge'] = 'status-danger'
            elif result['count'] > 2:
                result['status'] = 'warning'
                result['status_text'] = 'Превышение нормы'
                result['status_badge'] = 'status-warning'

            # Расчет динамики
            result['difference'] = round(result['count'] - result['average'], 1)
            diff_percent = round((result['difference'] / result['average']) * 100) if result['average'] > 0 else 0

            if result['difference'] > 0:
                result['dynamics'] = f'▲ +{diff_percent}%'
                result['dynamics_class'] = 'dyn-up'
            elif result['difference'] < 0:
                result['dynamics'] = f'▼ {diff_percent}%'
                result['dynamics_class'] = 'dyn-down'

            print(f"✅ CME событий за 7 дней: {result['count']}")

        return result

    async def get_aurora_image(self, session: aiohttp.ClientSession) -> Dict:
        """Загрузка изображений полярных сияний"""
        north = await self.fetch_image(session, ENDPOINTS['aurora_forecast'], 'Aurora North')
        south = await self.fetch_image(session, ENDPOINTS['aurora_forecast_south'], 'Aurora South')

        return {
            'north': north,
            'south': south
        }

    async def get_all_data(self) -> Dict:
        """Главная функция - сбор всех данных"""
        async with aiohttp.ClientSession() as session:
            tasks = [
                self.get_kp_data(session),
                self.get_flare_data(session),
                self.get_solar_wind_data(session),
                self.get_sun_data(session),
                self.get_geomagnetic_data(session),
                self.get_cme_data(session),
                self.get_aurora_image(session),
                self.get_kp_forecast(session)
            ]

            results = await asyncio.gather(*tasks)

            # Распаковываем результаты
            kp_data = results[0]
            flares_data = results[1]
            wind_data = results[2]
            sun_data = results[3]
            geo_data = results[4]
            cme_data = results[5]
            aurora_images = results[6]
            kp_forecast = results[7]

            # Используем реальный прогноз
            kp_data['forecast'] = kp_forecast

            self.data = {
                'kp': kp_data,
                'flares': flares_data,
                'solar_wind': wind_data,
                'sun': sun_data,
                'geomagnetic': geo_data,
                'cme': cme_data,
                'images': aurora_images if aurora_images else {},
                'last_update': datetime.now().strftime('%d.%m.%Y %H:%M:%S'),

                # Упрощенные поля для карточек
                'kpIndex': kp_data['current'],
                'kpStatus': kp_data['status_text'],
                'kpStatusBadge': kp_data['status_badge'],
                'kpHistoryFormatted': kp_data.get('history_formatted', []),

                'cmeCount': cme_data['count'],
                'cmeSpeed': f"{cme_data['max_speed']} км/с" if cme_data['max_speed'] > 0 else "—",
                'cmeStatus': cme_data['status_badge'],
                'cmeChartData': cme_data.get('chart_data', {'speeds': [], 'dates': []}),

                'flareCount': flares_data['count'],
                'flareClass': flares_data['strongest_class_display'],
                'flaresStatus': flares_data['status_badge'],
                'flareEvents': flares_data.get('events', []),

                'windSpeed': f"{wind_data['speed']} км/с",
                'windDensity': f"{wind_data['density']} p/см³",
                'windStatus': wind_data['status_badge'],
                'windHistory': wind_data.get('history', []),

                'sunspotNumber': sun_data['display'],
                'sunStatus': sun_data['status_badge'],

                'eventsCount': flares_data['count'] + cme_data['count'],
                'eventsStatus': 'status-warning' if flares_data['status'] in ['warning', 'danger'] or cme_data[
                    'status'] in ['warning', 'danger'] else 'status-normal',

                'flareProb': f"{flares_data['probability']}%",
                'kpForecast': str(kp_data['forecast']),
                'auroraProb': self.calculate_aurora_probability(kp_data['current']),

                # Данные для сравнения
                'comparison': {
                    'cme': {
                        'now': str(cme_data['count']),
                        'avg': str(cme_data['average']),
                        'diff': str(cme_data['difference']),
                        'dyn': cme_data['dynamics'],
                        'dyn_class': cme_data['dynamics_class'],
                        'badge': cme_data['status_badge']
                    },
                    'flares': {
                        'now': str(flares_data['count']),
                        'avg': str(flares_data['average']),
                        'diff': str(flares_data['difference']),
                        'dyn': flares_data['dynamics'],
                        'dyn_class': flares_data['dynamics_class'],
                        'badge': flares_data['status_badge']
                    },
                    'kp': {
                        'now': str(kp_data['current']),
                        'avg': '3.2',
                        'diff': str(round(kp_data['current'] - 3.2, 1)),
                        'dyn': '◆ +3%',
                        'dyn_class': 'dyn-flat',
                        'badge': kp_data['status_badge']
                    },
                    'wind': {
                        'now': str(wind_data['speed']),
                        'avg': str(wind_data['average']),
                        'diff': str(wind_data['difference']),
                        'dyn': wind_data['dynamics'],
                        'dyn_class': wind_data['dynamics_class'],
                        'badge': wind_data['status_badge']
                    }
                },

                'total_events': flares_data['count'] + cme_data['count']
            }

            # Общий статус
            statuses = [kp_data['status'], flares_data['status'], cme_data['status']]
            if 'danger' in statuses:
                self.data['overall_status'] = 'danger'
            elif 'warning' in statuses:
                self.data['overall_status'] = 'warning'
            else:
                self.data['overall_status'] = 'normal'

            # Выводим сводку
            print("\n" + "=" * 60)
            print("📊 СВОДКА СОБРАННЫХ ДАННЫХ")
            print("=" * 60)
            print(f"Kp: {kp_data['current']} ({kp_data['status_text']})")
            print(f"Прогноз Kp: {kp_forecast}")
            print(
                f"Вспышки (7 дней): {flares_data['count']} (M: {flares_data['m_count']}, X: {flares_data['x_count']})")
            print(f"Сильнейший класс: {flares_data['strongest_class']}")
            print(f"CME (7 дней): {cme_data['count']}")
            print(f"Солнечный ветер: {wind_data['speed']} км/с")
            print(f"Пятен: {sun_data['sunspot_number']}")
            print(f"Вероятность сияний: {self.data['auroraProb']}")
            print("=" * 60)

            return self.data


def save_data_to_json(data: Dict, static_dir: str = 'static'):
    """Сохранение данных в JSON файл"""
    os.makedirs(static_dir, exist_ok=True)
    json_path = os.path.join(static_dir, 'space_weather_data.json')

    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"💾 Данные сохранены в {json_path}")
    return json_path


async def fetch_and_save_data():
    """Основная функция для сбора и сохранения данных"""
    print("🚀 Начинаем сбор данных NOAA...")
    fetcher = SpaceWeatherFetcher()

    try:
        data = await fetcher.get_all_data()
        json_path = save_data_to_json(data)
        print(f"✅ Данные успешно обновлены в {json_path}")
        return data
    except Exception as e:
        print(f"❌ Критическая ошибка: {e}")
        import traceback
        traceback.print_exc()
        return None


def main():
    """Точка входа для запуска как отдельного скрипта"""
    asyncio.run(fetch_and_save_data())


def run_fetcher_sync():
    """Синхронная обертка для запуска fetcher из FastAPI"""
    try:
        asyncio.run(fetch_and_save_data())
        return True
    except Exception as e:
        print(f"❌ Ошибка в run_fetcher_sync: {e}")
        return False


if __name__ == "__main__":
    main()
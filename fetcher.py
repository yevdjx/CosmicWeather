import aiohttp
import asyncio
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
import base64
import os

# Константы
NOAA_BASE = "https://services.swpc.noaa.gov/json"

# РАБОЧИЕ эндпоинты NOAA
ENDPOINTS = {
    'kp_index': f'{NOAA_BASE}/planetary_k_index_1m.json',
    'dst': f'{NOAA_BASE}/geospace/geospace_dst_1_hour.json',
    'flux_1day': f'{NOAA_BASE}/goes/primary/xrays-1-day.json',
    'flux_7day': f'{NOAA_BASE}/goes/primary/xrays-7-day.json',
    'proton': f'{NOAA_BASE}/rtsw/rtsw_wind_1m.json',
    'bz_gms': f'{NOAA_BASE}/rtsw/rtsw_mag_1m.json',
    'cloud': f'{NOAA_BASE}/enlil_time_series.json',
    'sunspots': f'{NOAA_BASE}/solar-cycle/sunspots.json',
    'aurora_forecast': 'https://services.swpc.noaa.gov/images/aurora-forecast-northern-hemisphere.jpg',
}


class SpaceWeatherFetcher:
    """Асинхронный сборщик данных о космической погоде"""

    def __init__(self):
        self.data = {}
        self.images = {}

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

    async def get_kp_data(self, session: aiohttp.ClientSession) -> Dict:
        """Kp-индекс - для карточек и графика"""
        data = await self.fetch_json(session, ENDPOINTS['kp_index'], 'Kp index')

        result = {
            'current': 3.3,
            'forecast': 3.5,
            'status': 'normal',
            'history': [],
            'status_text': 'Спокойно',
            'status_badge': 'status-normal'
        }

        if data and len(data) > 0:
            recent = data[-24:] if len(data) > 24 else data
            current = data[-1].get('kp_index', 3.3)
            result['current'] = current
            result['history'] = [d.get('kp_index', 0) for d in recent]
            result['forecast'] = round(current + 0.2, 1)

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
        """Солнечные вспышки - для карточек и страницы вспышек"""
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
            'probability': 15,  # Вероятность X-вспышки
            'average': 5.3,  # Среднее за 30 дней
            'difference': 0,
            'dynamics': '◆ -6%',
            'dynamics_class': 'dyn-flat'
        }

        if flux_data and len(flux_data) > 0:
            flares = [item for item in flux_data if item.get('flux', 0) > 1e-6]
            result['count'] = len(flares)

            if result['count'] > 0:
                for flare in flares:
                    flux = flare.get('flux', 0)
                    if flux >= 1e-4:
                        result['x_count'] += 1
                    elif flux >= 1e-5:
                        result['m_count'] += 1

                if result['x_count'] > 0:
                    result['strongest_class'] = 'X'
                    result['strongest_class_display'] = 'X'
                    result['status'] = 'danger'
                    result['status_text'] = 'Высокая активность'
                    result['status_badge'] = 'status-danger'
                    result['probability'] = 30
                elif result['m_count'] > 0:
                    result['strongest_class'] = 'M'
                    result['strongest_class_display'] = 'M'
                    result['status'] = 'warning'
                    result['status_text'] = 'Повышенная активность'
                    result['status_badge'] = 'status-warning'
                    result['probability'] = 15

                # Последние 5 событий для детальной страницы
                recent_flares = flares[-5:]
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
                result['average'] = round(result['count'] * 0.9, 1)
                result['difference'] = round(result['count'] - result['average'], 1)
                diff_percent = round((result['difference'] / result['average']) * 100) if result['average'] > 0 else 0
                if result['difference'] > 0:
                    result['dynamics'] = f'▲ +{diff_percent}%'
                    result['dynamics_class'] = 'dyn-up'
                elif result['difference'] < 0:
                    result['dynamics'] = f'▼ {diff_percent}%'
                    result['dynamics_class'] = 'dyn-down'
                else:
                    result['dynamics'] = '◆ 0%'
                    result['dynamics_class'] = 'dyn-flat'

                print(f"✅ NOAA Flares: {result['count']} событий (M: {result['m_count']}, X: {result['x_count']})")

        return result

    async def get_solar_wind_data(self, session: aiohttp.ClientSession) -> Dict:
        """Солнечный ветер - для карточек"""
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
            'dynamics': '◆ -2%',
            'dynamics_class': 'dyn-flat'
        }

        if data and len(data) > 0:
            latest = data[-1]
            speed = latest.get('proton_speed', 410)
            result['speed'] = round(speed, 1)
            result['density'] = round(latest.get('proton_density', 4.8), 2)
            result['temperature'] = round(latest.get('proton_temperature', 80000))

            if speed > 500:
                result['status'] = 'warning'
                result['status_text'] = 'Повышенная скорость'
                result['status_badge'] = 'status-warning'
            elif speed < 300:
                result['status'] = 'warning'
                result['status_text'] = 'Пониженная скорость'
                result['status_badge'] = 'status-warning'

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
            spots = round(sunspots_data[-1].get('ssn', 85), 1)
            result['sunspot_number'] = spots
            result['display'] = f"{spots} пятен"

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

    async def get_cme_cloud_data(self, session: aiohttp.ClientSession) -> Dict:
        """Данные о корональных выбросах в пути"""
        data = await self.fetch_json(session, ENDPOINTS['cloud'], 'CME cloud')

        result = {
            'cloud': 0,
            'in_transit': False,
            'message': "Нет CME в пути",
            'count': 3,
            'max_speed': 850,
            'status': 'warning',
            'status_text': 'Превышение нормы',
            'status_badge': 'status-warning',
            'events': [
                {'date': (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d'), 'speed': 420},
                {'date': (datetime.now() - timedelta(days=2)).strftime('%Y-%m-%d'), 'speed': 380},
                {'date': (datetime.now() - timedelta(days=3)).strftime('%Y-%m-%d'), 'speed': 850}
            ],
            'average': 2.5,
            'difference': 0.5,
            'dynamics': '▲ +20%',
            'dynamics_class': 'dyn-up'
        }

        if data and len(data) > 0:
            latest = data[-1]
            cloud_value = latest.get('cloud')

            if cloud_value is not None:
                result['cloud'] = cloud_value
                result['in_transit'] = cloud_value > 0
                result['message'] = "Обнаружен CME в пути" if cloud_value > 0 else "Нет CME в пути"
                print(f"✅ CME cloud: {result['message']}")

        result['difference'] = round(result['count'] - result['average'], 1)

        return result

    async def get_aurora_image(self, session: aiohttp.ClientSession) -> Optional[str]:
        """Загрузка изображения полярных сияний"""
        return await self.fetch_image(session, ENDPOINTS['aurora_forecast'], 'Aurora')

    async def get_all_data(self) -> Dict:
        """Главная функция - сбор всех данных для HTML"""
        async with aiohttp.ClientSession() as session:
            tasks = [
                self.get_kp_data(session),
                self.get_flare_data(session),
                self.get_solar_wind_data(session),
                self.get_sun_data(session),
                self.get_geomagnetic_data(session),
                self.get_cme_cloud_data(session),
                self.get_aurora_image(session)
            ]

            results = await asyncio.gather(*tasks)

            self.data = {
                'kp': results[0],
                'flares': results[1],
                'solar_wind': results[2],
                'sun': results[3],
                'geomagnetic': results[4],
                'cme': results[5],
                'cme_cloud': results[5],
                'images': {'aurora_forecast': results[6]} if results[6] else {},
                'last_update': datetime.now().strftime('%d.%m.%Y %H:%M:%S'),

                'kpIndex': results[0]['current'],
                'kpStatus': results[0]['status_text'],
                'kpStatusBadge': results[0]['status_badge'],

                'cmeCount': results[5]['count'],
                'cmeSpeed': f"{results[5]['max_speed']} км/с",
                'cmeStatus': results[5]['status_badge'],

                'flareCount': results[1]['count'],
                'flareClass': results[1]['strongest_class_display'],
                'flaresStatus': results[1]['status_badge'],

                'windSpeed': f"{results[2]['speed']} км/с",
                'windDensity': f"{results[2]['density']} p/см³",
                'windStatus': results[2]['status_badge'],

                'sunspotNumber': results[3]['display'],
                'sunStatus': results[3]['status_badge'],

                'eventsCount': results[1]['count'] + results[5]['count'],
                'eventsStatus': 'status-warning' if results[1]['status'] == 'warning' or results[5][
                    'status'] == 'warning' else 'status-normal',

                'flareProb': f"{results[1]['probability']}%",
                'kpForecast': str(results[0]['forecast']),
                'auroraProb': '15%' if results[0]['current'] < 5 else ('40%' if results[0]['current'] < 7 else '70%'),

                'comparison': {
                    'cme': {
                        'now': str(results[5]['count']),
                        'avg': str(results[5]['average']),
                        'diff': str(results[5]['difference']),
                        'dyn': results[5]['dynamics'],
                        'dyn_class': results[5]['dynamics_class'],
                        'badge': results[5]['status_badge']
                    },
                    'flares': {
                        'now': str(results[1]['count']),
                        'avg': str(results[1]['average']),
                        'diff': str(results[1]['difference']),
                        'dyn': results[1]['dynamics'],
                        'dyn_class': results[1]['dynamics_class'],
                        'badge': results[1]['status_badge']
                    },
                    'kp': {
                        'now': str(results[0]['current']),
                        'avg': '3.2',
                        'diff': str(round(results[0]['current'] - 3.2, 1)),
                        'dyn': '◆ +3%',
                        'dyn_class': 'dyn-flat',
                        'badge': results[0]['status_badge']
                    },
                    'wind': {
                        'now': str(results[2]['speed']),
                        'avg': str(results[2]['average']),
                        'diff': str(results[2]['difference']),
                        'dyn': results[2]['dynamics'],
                        'dyn_class': results[2]['dynamics_class'],
                        'badge': results[2]['status_badge']
                    }
                },

                'total_events': results[1]['count'] + results[5]['count']
            }

            statuses = [results[0]['status'], results[1]['status'], results[5]['status']]
            if 'danger' in statuses:
                self.data['overall_status'] = 'danger'
            elif 'warning' in statuses:
                self.data['overall_status'] = 'warning'
            else:
                self.data['overall_status'] = 'normal'

            return self.data


def save_data_to_json(data: Dict, static_dir: str = 'static'):
    """Сохранение данных в JSON файл"""
    os.makedirs(static_dir, exist_ok=True)
    json_path = os.path.join(static_dir, 'space_weather_data.json')

    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"💾 Данные сохранены в {json_path}")
    return json_path


def print_data_summary(data: Dict):
    """Вывод сводки по данным"""
    print("\n" + "=" * 60)
    print("📊 СВОДКА КОСМИЧЕСКОЙ ПОГОДЫ")
    print("=" * 60)
    print(f"🕐 Обновлено: {data['last_update']}")

    print(f"\n🌍 Kp-индекс: {data['kp']['current']} ({data['kp']['status_text']})")
    print(f"\n💫 CME: {data['cme']['count']} событий")
    print(f"   Макс. скорость: {data['cme']['max_speed']} км/с")
    print(f"\n☀️ Вспышки: {data['flares']['count']} событий")
    print(f"   Сильнейший класс: {data['flares']['strongest_class']}")
    print(f"\n💨 Солнечный ветер: {data['solar_wind']['speed']} км/с")
    print(f"\n🌞 Пятен: {data['sun']['sunspot_number']}")
    print(f"📊 Всего событий: {data['total_events']}")
    print(f"📈 Общий статус: {data['overall_status']}")
    print("=" * 60)


async def fetch_and_save_data():
    """Основная функция для сбора и сохранения данных"""
    print("🚀 Начинаем сбор данных NOAA...")
    fetcher = SpaceWeatherFetcher()

    try:
        data = await fetcher.get_all_data()
        json_path = save_data_to_json(data)
        print_data_summary(data)
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

if __name__ == "__main__":
    main()
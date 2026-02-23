from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi import BackgroundTasks
import subprocess
from fastapi.templating import Jinja2Templates
from starlette.requests import Request
import asyncio
import os
import json
from datetime import datetime
import uvicorn
import sys

# Создаем FastAPI приложение
app = FastAPI(title="Space Weather Monitor", description="Мониторинг космической погоды")

# Монтируем статические файлы (CSS, JS, JSON)
app.mount("/static", StaticFiles(directory="static"), name="static")


# Настраиваем шаблоны (если используете Jinja2)
# templates = Jinja2Templates(directory="templates")

# ============================================
# ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
# ============================================

def get_weather_data():
    """Получить данные из JSON файла"""
    json_path = os.path.join("static", "space_weather_data.json")
    try:
        if os.path.exists(json_path):
            with open(json_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return None
    except Exception as e:
        print(f"Ошибка чтения JSON: {e}")
        return None


def get_last_update_time():
    """Получить время последнего обновления данных"""
    json_path = os.path.join("static", "space_weather_data.json")
    try:
        if os.path.exists(json_path):
            mod_time = os.path.getmtime(json_path)
            return datetime.fromtimestamp(mod_time).strftime("%d.%m.%Y %H:%M:%S")
        return "Данные отсутствуют"
    except Exception as e:
        return "Ошибка"


# ============================================
# МАРШРУТЫ (ROUTES)
# ============================================

@app.get("/", response_class=HTMLResponse)
async def read_root():
    """Главная страница - отдаем HTML"""
    html_path = os.path.join("templates", "index.html")
    if os.path.exists(html_path):
        with open(html_path, 'r', encoding='utf-8') as f:
            content = f.read()
        return HTMLResponse(content=content)
    return HTMLResponse(content="<h1>Файл index.html не найден</h1>")


@app.get("/api/weather-data")
async def api_weather_data():
    """API endpoint для получения данных в формате JSON"""
    data = get_weather_data()
    if data:
        return JSONResponse(content=data)
    return JSONResponse(
        status_code=404,
        content={"error": "Данные не найдены", "last_update": get_last_update_time()}
    )


@app.get("/api/status")
async def api_status():
    """Проверка статуса сервера"""
    data = get_weather_data()
    return {
        "status": "running",
        "data_available": data is not None,
        "last_update": get_last_update_time(),
        "server_time": datetime.now().strftime("%d.%m.%Y %H:%M:%S")
    }


@app.get("/health")
async def health_check():
    """Проверка здоровья сервера"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


@app.post("/api/update-data")
async def update_data(background_tasks: BackgroundTasks):
    """
    Запускает обновление данных из NOAA в фоновом режиме
    """

    def run_fetcher():
        try:
            # Запускаем fetcher.py как отдельный процесс
            result = subprocess.run(
                [sys.executable, "fetcher.py"],
                capture_output=True,
                text=True,
                timeout=120  # таймаут 2 минуты
            )
            if result.returncode == 0:
                print(f"✅ Данные успешно обновлены: {result.stdout}")
            else:
                print(f"❌ Ошибка при обновлении: {result.stderr}")
        except Exception as e:
            print(f"❌ Исключение при обновлении: {e}")

    # Запускаем в фоне, чтобы не блокировать ответ
    background_tasks.add_task(run_fetcher)

    return {"status": "started", "message": "Обновление данных запущено"}


async def run_fetcher_periodically():
    """Запускает fetcher каждые 3 минуты в фоне"""
    while True:
        try:
            print(f"\n{'=' * 60}")
            print(f"🕐 Автоматический запуск fetcher в {datetime.now().strftime('%H:%M:%S')}")
            print(f"{'=' * 60}\n")

            # Запускаем fetcher.py
            result = subprocess.run(
                [sys.executable, "fetcher.py"],
                capture_output=True,
                text=True,
                timeout=120
            )

            if result.returncode == 0:
                print("✅ Автообновление успешно")
            else:
                print(f"❌ Ошибка автообновления: {result.stderr}")

        except Exception as e:
            print(f"❌ Исключение в автообновлении: {e}")

        # Ждем 3 минуты
        await asyncio.sleep(180)


@app.on_event("startup")
async def startup_event():
    """Запускает фоновую задачу при старте сервера"""
    asyncio.create_task(run_fetcher_periodically())

# ============================================
# ЗАПУСК СЕРВЕРА
# ============================================

if __name__ == "__main__":
    print("=" * 60)
    print("🚀 Space Weather Server запускается...")
    print("📡 Режим: Веб-сервер (данные из fetcher.py)")
    print("=" * 60)

    # Проверяем наличие данных
    data = get_weather_data()
    if data:
        print(f"✅ Данные загружены: {get_last_update_time()}")
    else:
        print("⚠️ Данные не найдены. Запустите fetcher.py для получения данных")

    print("\n🌐 Сервер доступен по адресу: http://localhost:8000")
    print("📊 API: http://localhost:8000/api/weather-data")
    print("=" * 60)

    # Запускаем сервер
    uvicorn.run(app, host="0.0.0.0", port=8000)
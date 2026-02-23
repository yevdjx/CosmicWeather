@echo off
chcp 65001 > nul
echo ========================================
echo [%date% %time%] Запуск обновления данных...
echo ========================================

cd /d "%~dp0"

:: Активируем виртуальное окружение
call venv\Scripts\activate.bat

:: Запускаем fetcher для получения данных
python fetcher.py

:: Проверяем результат
if %errorlevel% equ 0 (
    echo [%date% %time%] ✓ Данные успешно обновлены >> update_log.txt
    echo ✓ Данные успешно обновлены
) else (
    echo [%date% %time%] ✗ Ошибка при обновлении данных >> update_log.txt
    echo ✗ Ошибка при обновлении данных
)

call deactivate
echo ========================================
echo Готово!
echo ========================================
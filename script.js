const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const launchBtn = document.getElementById('launchBtn');
const resultDiv = document.getElementById('result');
const dateInput = document.getElementById('launchDate');

// Идеальный угол для перелета Земля-Марс (в градусах) — это угол Гомановской траектории
const IDEAL_ANGLE = 44; 

// Функция для запроса данных у NASA JPL Horizons API
async function fetchPlanetData(planetId, startDate, endDate) {
    // planetId: 399 - Земля, 499 - Марс
    // Запрос векторов (положение и скорость) относительно барицентра Солнечной системы (500@0)
    const url = `https://ssd.jpl.nasa.gov/api/horizons.api?format=json&COMMAND='${planetId}'&OBJ_DATA='NO'&MAKE_EPHEM='YES'&EPHEM_TYPE='VECTORS'&CENTER='500@0'&START_TIME='${startDate}'&STOP_TIME='${endDate}'&STEP_SIZE='1 d'`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        // NASA возвращает данные в виде текстовой таблицы внутри JSON-объекта
        const textData = data.result;
        return parseHorizonsData(textData);
    } catch (error) {
        console.error("Ошибка при получении данных:", error);
        return null;
    }
}

// Парсинг текстового ответа от NASA (вытаскиваем координаты X и Y)
function parseHorizonsData(text) {
    const lines = text.split('\n');
    const positions = [];
    let startParsing = false;

    for (let line of lines) {
        if (line.includes('$$SOE')) { // Начало данных
            startParsing = true;
            continue;
        }
        if (line.includes('$$EOE')) { // Конец данных
            break;
        }
        if (startParsing) {
            // Формат строки: Date, X, Y, Z, VX, VY, VZ
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 4) {
                positions.push({
                    date: parts[0],
                    x: parseFloat(parts[1]),
                    y: parseFloat(parts[2])
                });
            }
        }
    }
    return positions;
}

// Расчет угла между Землей и Марсом относительно Солнца
function calculateAngle(earthPos, marsPos) {
    const angleEarth = Math.atan2(earthPos.y, earthPos.x);
    const angleMars = Math.atan2(marsPos.y, marsPos.x);
    let angleDiff = angleMars - angleEarth;
    
    // Приводим угол к диапазону 0-360 градусов
    if (angleDiff < 0) angleDiff += 2 * Math.PI;
    return angleDiff * (180 / Math.PI);
}

// Отрисовка планет на Canvas (упрощенная 2D-визуализация)
function drawOrbits(earthPos, marsPos) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Рисуем Солнце
    ctx.beginPath();
    ctx.arc(centerX, centerY, 10, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffcc00';
    ctx.fill();
    ctx.fillText("Солнце", centerX - 20, centerY + 25);

    // Масштабирование (упрощенное, чтобы планеты влезли на экран)
    const scale = 0.0000005; 
    
    // Рисуем Землю
    ctx.beginPath();
    ctx.arc(centerX + earthPos.x * scale, centerY - earthPos.y * scale, 5, 0, 2 * Math.PI);
    ctx.fillStyle = '#00aaff';
    ctx.fill();
    ctx.fillText("Земля", centerX + earthPos.x * scale + 10, centerY - earthPos.y * scale);

    // Рисуем Марс
    ctx.beginPath();
    ctx.arc(centerX + marsPos.x * scale, centerY - marsPos.y * scale, 4, 0, 2 * Math.PI);
    ctx.fillStyle = '#ff4d4d';
    ctx.fill();
    ctx.fillText("Марс", centerX + marsPos.x * scale + 10, centerY - marsPos.y * scale);
}

// Главная функция игры (вызывается по клику)
async function checkLaunch() {
    const selectedDate = dateInput.value;
    if (!selectedDate) {
        resultDiv.innerHTML = "Пожалуйста, выбери дату!";
        return;
    }

    resultDiv.innerHTML = "Запрос к NASA... ⏳";

    // Запрашиваем данные на выбранную дату (и +1 день, чтобы захватить сутки)
    const nextDay = new Date(new Date(selectedDate).getTime() + 86400000).toISOString().split('T')[0];
    
    // Получаем данные для Земли (399) и Марса (499)
    const earthData = await fetchPlanetData(399, selectedDate, nextDay);
    const marsData = await fetchPlanetData(499, selectedDate, nextDay);

    if (!earthData || !marsData || earthData.length === 0 || marsData.length === 0) {
        resultDiv.innerHTML = "Ошибка получения данных от NASA. Попробуй еще раз.";
        return;
    }

    const earthPos = earthData[0];
    const marsPos = marsData[0];

    drawOrbits(earthPos, marsPos);

    const angle = calculateAngle(earthPos, marsPos);
    const diff = Math.abs(angle - IDEAL_ANGLE);

    let message = `Угол между Землей и Марсом: <b>${angle.toFixed(2)}°</b><br>`;
    message += `Идеальный угол для старта: <b>${IDEAL_ANGLE}°</b><br><br>`;

    if (diff <= 5) {
        message += "🎉 <b>ИДЕАЛЬНЫЙ СТАРТ!</b> Ракета долетит до Марса с минимальным расходом топлива!";
        resultDiv.style.border = "2px solid #00ff00";
    } else if (diff <= 15) {
        message += "⚠️ <b>Хороший старт.</b> Но придется потратить немного больше топлива.";
        resultDiv.style.border = "2px solid #ffcc00";
    } else {
        message += "❌ <b>Неудачная дата.</b> Марс слишком далеко или близко. Ракета не долетит.";
        resultDiv.style.border = "2px solid #ff4d4d";
    }

    resultDiv.innerHTML = message;
}

launchBtn.addEventListener('click', checkLaunch);

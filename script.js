const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const launchBtn = document.getElementById('launchBtn');
const resultDiv = document.getElementById('result');
const dateInput = document.getElementById('launchDate');

const IDEAL_ANGLE = 44; 

async function fetchPlanetData(planetId, startDate, endDate) {
    // Убираем лишние кавычки и пробелы, формируем правильный URL
    const url = `https://ssd.jpl.nasa.gov/api/horizons.api?format=json&COMMAND=${planetId}&OBJ_DATA=NO&MAKE_EPHEM=YES&EPHEM_TYPE=VECTORS&CENTER=500@0&START_TIME=${startDate}&STOP_TIME=${endDate}&STEP_SIZE=1d`;
    
    console.log(`Запрос к NASA для planetId ${planetId}:`, url);

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Проверяем, есть ли поле result
        if (!data.result) {
            console.error("NASA вернула ответ без поля 'result':", data);
            return null;
        }

        return parseHorizonsData(data.result);
    } catch (error) {
        console.error(`Ошибка при запросе к NASA для planetId ${planetId}:`, error);
        return null;
    }
}

function parseHorizonsData(text) {
    const lines = text.split('\n');
    const positions = [];
    let startParsing = false;

    for (let line of lines) {
        if (line.includes('$$SOE')) {
            startParsing = true;
            continue;
        }
        if (line.includes('$$EOE')) {
            break;
        }
        if (startParsing) {
            const parts = line.trim().split(/\s+/);
            // Убедимся, что в строке достаточно данных
            if (parts.length >= 4 && !isNaN(parseFloat(parts[1])) && !isNaN(parseFloat(parts[2]))) {
                positions.push({
                    date: parts[0],
                    x: parseFloat(parts[1]),
                    y: parseFloat(parts[2])
                });
            }
        }
    }
    console.log(`Распарсено ${positions.length} строк данных.`);
    return positions;
}

function calculateAngle(earthPos, marsPos) {
    const angleEarth = Math.atan2(earthPos.y, earthPos.x);
    const angleMars = Math.atan2(marsPos.y, marsPos.x);
    let angleDiff = angleMars - angleEarth;
    
    if (angleDiff < 0) angleDiff += 2 * Math.PI;
    return angleDiff * (180 / Math.PI);
}

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

async function checkLaunch() {
    const selectedDate = dateInput.value;
    if (!selectedDate) {
        resultDiv.innerHTML = "Пожалуйста, выбери дату!";
        return;
    }

    resultDiv.innerHTML = "Запрос к NASA... ⏳";
    console.log("Начало запроса для даты:", selectedDate);

    // Формируем даты в формате YYYY-MM-DD
    const nextDay = new Date(new Date(selectedDate).getTime() + 86400000).toISOString().split('T')[0];
    const startDate = selectedDate; // Используем выбранную дату как старт
    
    try {
        const earthData = await fetchPlanetData(399, startDate, nextDay);
        const marsData = await fetchPlanetData(499, startDate, nextDay);

        if (!earthData || !marsData || earthData.length === 0 || marsData.length === 0) {
            throw new Error("Не удалось получить данные от NASA.");
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
        console.log("Успех! Угол:", angle);
    } catch (error) {
        console.error("Критическая ошибка в игре:", error);
        resultDiv.innerHTML = "Ошибка получения данных от NASA. Попробуй еще раз. (Проверь консоль F12)";
    }
}

launchBtn.addEventListener('click', checkLaunch);

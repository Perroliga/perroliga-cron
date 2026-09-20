const puppeteer = require('puppeteer');

(async () => {
  console.log('Iniciando navegador headless para Pichichi y Zamora...');
  
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled' // Oculta que es un bot
    ]
  });
  
  const page = await browser.newPage();
  
  // Asignar un User-Agent moderno y real
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  );

  // Evitar la detección de webdriver
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  const cronKey = process.env.MI_CRON_KEY;
  const webKey = process.env.MI_WEB;
  const destinationUrl = `${webKey}/crons/actualizar_pichichi_zamora.php?key=${cronKey}`;

  try {
    // ------------------------------------------------------------------
    // ETAPA 1: Obtener datos de Goles (Pichichi) mediante navegación
    // ------------------------------------------------------------------
    console.log('Navegando a la API de Goles en SofaScore...');
    const urlGoles = "https://api.sofascore.com/api/v1/unique-tournament/8/season/61627/top-players/goals";
    await page.goto(urlGoles, { waitUntil: 'networkidle0', timeout: 30000 });

    const rawGoles = await page.evaluate(() => document.body.innerText);
    const dataGoles = JSON.parse(rawGoles);

    // ------------------------------------------------------------------
    // ETAPA 2: Obtener datos de Porteros (Zamora) mediante navegación
    // ------------------------------------------------------------------
    console.log('Navegando a la API de Porteros en SofaScore...');
    const urlPorteros = "https://api.sofascore.com/api/v1/unique-tournament/8/season/61627/top-players/goalsConceded";
    await page.goto(urlPorteros, { waitUntil: 'networkidle0', timeout: 30000 });

    const rawPorteros = await page.evaluate(() => document.body.innerText);
    const dataPorteros = JSON.parse(rawPorteros);

    // Mapear y procesar resultados
    const listaGoles = dataGoles.topPlayers || dataGoles.players || [];
    const listaPorteros = dataPorteros.topPlayers || dataPorteros.players || [];

    const pichichi = listaGoles.slice(0, 10).map((item, index) => ({
      posicion: index + 1,
      jugador: item.player?.name || "Desconocido",
      equipo: item.team?.name || "Desconocido",
      goles: parseInt(item.statistics?.goals || item.value || 0)
    }));

    const zamora = listaPorteros.slice(0, 10).map((item, index) => ({
      posicion: index + 1,
      jugador: item.player?.name || "Desconocido",
      equipo: item.team?.name || "Desconocido",
      goles_enc: parseInt(item.statistics?.goalsConceded || item.value || 0),
      partidos: parseInt(item.statistics?.appearances || item.statistics?.matches || 0),
      promedio_goles: (item.statistics?.appearances > 0) 
        ? parseFloat((item.statistics.goalsConceded / item.statistics.appearances).toFixed(2)) 
        : 0
    }));

    const payload = { pichichi, zamora };
    console.log(` Extraídos: ${payload.pichichi.length} Pichichis y ${payload.zamora.length} Zamoras.`);

    if (payload.pichichi.length === 0) {
      throw new Error('No se pudo extraer ningún jugador de SofaScore.');
    }

    // ------------------------------------------------------------------
    // ETAPA 3: Pasar el filtro de InfinityFree y guardar
    // ------------------------------------------------------------------
    console.log(`Navegando a tu servidor para superar reto AES: ${destinationUrl}`);
    await page.goto(destinationUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    console.log('Enviando datos al PHP...');
    const respuestaServidor = await page.evaluate(async (url, data) => {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await resp.text();
    }, destinationUrl, payload);

    console.log('--- RESPUESTA DEL SERVIDOR PHP ---');
    console.log(respuestaServidor);

  } catch (error) {
    console.error(' Error durante la ejecución:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();

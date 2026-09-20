const puppeteer = require('puppeteer');

(async () => {
  console.log('Iniciando navegador headless para Pichichi y Zamora...');
  
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  const cronKey = process.env.MI_CRON_KEY;
  const webKey = process.env.MI_WEB;
  const destinationUrl = `${webKey}/crons/actualizar_pichichi_zamora.php?key=${cronKey}`;

  try {
    // 1. Primero navegamos a la raíz o a cualquier PHP para superar el reto aes.js y obtener la cookie __test
    console.log('Superando el filtro AES de InfinityFree...');
    await page.goto(webKey, { waitUntil: 'networkidle2', timeout: 30000 });

    // 2. Extraer los datos de SofaScore directamente desde Node.js (SofaScore no tiene bloqueo AES)
    console.log('Obteniendo datos de SofaScore...');
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    };

    const [resGoles, resPorteros] = await Promise.all([
      fetch("https://api.sofascore.com/api/v1/unique-tournament/8/season/61627/top-players/goals", { headers }),
      fetch("https://api.sofascore.com/api/v1/unique-tournament/8/season/61627/top-players/goalsConceded", { headers })
    ]);

    const dataGoles = await resGoles.json();
    const dataPorteros = await resPorteros.json();

    const pichichi = (dataGoles.topPlayers || []).slice(0, 10).map((item, index) => ({
      posicion: index + 1,
      jugador: item.player?.name || "Desconocido",
      equipo: item.team?.name || "Desconocido",
      goles: parseInt(item.statistics?.goals || 0)
    }));

    const zamora = (dataPorteros.topPlayers || []).slice(0, 10).map((item, index) => ({
      posicion: index + 1,
      jugador: item.player?.name || "Desconocido",
      equipo: item.team?.name || "Desconocido",
      goles_enc: parseInt(item.statistics?.goalsConceded || 0),
      partidos: parseInt(item.statistics?.appearances || 0),
      promedio_goles: item.statistics?.appearances > 0 
        ? parseFloat((item.statistics.goalsConceded / item.statistics.appearances).toFixed(2)) 
        : 0
    }));

    const payload = { pichichi, zamora };

    // 3. Hacer el POST a InfinityFree usando el navegador Puppeteer (que ya tiene la cookie autorizada)
    console.log('Enviando datos procesados a InfinityFree...');
    const respuestaServidor = await page.evaluate(async (url, data) => {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await resp.text();
    }, destinationUrl, payload);

    console.log('--- RESPUESTA DEL SERVIDOR ---');
    console.log(respuestaServidor);

  } catch (error) {
    console.error('Error durante la ejecución:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();

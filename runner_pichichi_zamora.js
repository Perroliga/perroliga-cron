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
    // ------------------------------------------------------------------
    // ETAPA 1: Obtener datos desde el contexto del dominio de SofaScore
    // ------------------------------------------------------------------
    console.log('Navegando a SofaScore para evitar bloqueos CORS...');
    await page.goto('https://www.sofascore.com', { waitUntil: 'domcontentloaded', timeout: 30000 });

    console.log('Obteniendo datos de la API de SofaScore...');
    const payload = await page.evaluate(async () => {
      const urlGoles = "https://api.sofascore.com/api/v1/unique-tournament/8/season/61627/top-players/goals";
      const urlPorteros = "https://api.sofascore.com/api/v1/unique-tournament/8/season/61627/top-players/goalsConceded";

      const [resGoles, resPorteros] = await Promise.all([
        fetch(urlGoles),
        fetch(urlPorteros)
      ]);

      if (!resGoles.ok || !resPorteros.ok) {
        throw new Error(`SofaScore respondió con status: Goles=${resGoles.status}, Porteros=${resPorteros.status}`);
      }

      const dataGoles = await resGoles.json();
      const dataPorteros = await resPorteros.json();

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

      return { pichichi, zamora };
    });

    console.log(` Extraídos: ${payload.pichichi.length} Pichichis y ${payload.zamora.length} Zamoras.`);

    if (payload.pichichi.length === 0) {
      throw new Error('No se pudo extraer ningún jugador de SofaScore.');
    }

    // ------------------------------------------------------------------
    // ETAPA 2: Pasar el filtro AES de InfinityFree y enviar datos
    // ------------------------------------------------------------------
    console.log(`Navegando a tu servidor para pasar reto AES: ${destinationUrl}`);
    await page.goto(destinationUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    console.log('Enviando datos al PHP de InfinityFree...');
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

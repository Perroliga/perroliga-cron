const puppeteer = require('puppeteer');
const dns = require('node:dns').promises;

(async () => {
  console.log('Iniciando navegador para superar el reto aes.js para actualizar partidos...');

  // Puppeteer se encarga automáticamente de buscar su Chrome instalado
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  // Leer las claves desde las variables de entorno de GitHub Actions
  const cronKey = process.env.MI_CRON_KEY;
  const webKey = process.env.MI_WEB;
  const url = `${webKey}/crons/cron_sincronizar_partidos.php?key=${cronKey}`;

  try {

    // 1. Comprobar la resolución DNS
    const hostname = new URL(url).hostname;

    console.log(`Comprobando DNS del dominio: ${hostname}`);

    try {
      const resultadoDNS = await dns.lookup(hostname, { all: true });
      console.log('DNS CORRECTO:', resultadoDNS);

    } catch (errorDNS) {
      console.error(
        'FALLO EN LA RESOLUCIÓN DNS:',
        errorDNS.code,
        errorDNS.message
      );
    }

    // 2. Intentar abrir la página hasta 3 veces si falla el DNS
    console.log(`Navegando a: ${new URL(url).origin}${new URL(url).pathname}`);

    for (let intento = 1; intento <= 3; intento++) {

      try {
        await page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });

        console.log('Página abierta correctamente.');
        break;

      } catch (error) {

        const falloDNS = error.message.includes('ERR_NAME_NOT_RESOLVED');

        if (!falloDNS || intento === 3) {
          throw error;
        }

        const espera = 2000 * intento;

        console.warn(
          `Fallo DNS en el intento ${intento}. Reintentando en ${espera / 1000} segundos...`
        );

        // Esperar antes del siguiente intento
        await new Promise(resolve => setTimeout(resolve, espera));
      }
    }

    // 3. Mostrar la respuesta del cron PHP
    const bodyHTML = await page.evaluate(() => document.body.innerText);

    console.log('--- RESPUESTA DEL SERVIDOR ---');
    console.log(bodyHTML);

  } catch (error) {

    console.error('Error durante la ejecución:', error);
    process.exitCode = 1;

  } finally {

    await browser.close();

  }

})();

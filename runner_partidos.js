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

    // 1. Comprobar DNS con hasta 5 intentos
const hostname = new URL(url).hostname;
let dnsResuelto = false;

for (let intento = 1; intento <= 5; intento++) {
  try {
    const resultadoDNS = await dns.lookup(hostname, { all: true });

    console.log('DNS CORRECTO:', resultadoDNS);
    dnsResuelto = true;
    break;

  } catch (errorDNS) {
    console.error(
      `FALLO DNS ${intento}/5:`,
      errorDNS.code,
      errorDNS.message
    );

    if (intento === 5) {
      throw new Error(
        `No se pudo resolver ${hostname} después de 5 intentos.`
      );
    }

    const espera = intento * 5000;

    console.warn(`Esperando ${espera / 1000} segundos...`);

    await new Promise(resolve => setTimeout(resolve, espera));
  }
}

if (!dnsResuelto) {
  throw new Error('No se ha podido resolver el dominio.');
}

// 2. Abrir la página con hasta 3 intentos
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

    const espera = intento * 5000;

    console.warn(
      `Fallo DNS en Puppeteer. Reintento ${intento}/3 en ${espera / 1000} segundos...`
    );

    await new Promise(resolve => setTimeout(resolve, espera));
  }
}

// 3. Mostrar respuesta del cron PHP
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

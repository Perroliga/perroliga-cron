const puppeteer = require('puppeteer');

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

  // Leer la clave desde la variable de entorno de GitHub Actions
  const cronKey = process.env.MI_CRON_KEY;
  const miweb = process.env.MI_WEB;
  const url = `https://'${miweb}'/cron_sincronizar_partidos.php?key=${cronKey}`;

  try {
    console.log(`Navegando a: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    const bodyHTML = await page.evaluate(() => document.body.innerText);
    console.log('--- RESPUESTA DEL SERVIDOR ---');
    console.log(bodyHTML);
  } catch (error) {
    console.error('Error durante la ejecución:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();

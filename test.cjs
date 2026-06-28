const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');

const app = express();
const port = 3000;

app.use('/personal-finance-premium', express.static(path.join(__dirname, 'dist')));
app.get('/', (req, res) => res.redirect('/personal-finance-premium/'));

const server = app.listen(port, async () => {
  console.log(`Server running at http://localhost:${port}/personal-finance-premium/`);
  
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    page.on('pageerror', err => console.error('BROWSER ERROR:', err.message));
    page.on('requestfailed', req => console.error('FAILED REQ:', req.url()));

    await page.goto(`http://localhost:${port}/personal-finance-premium/`, { waitUntil: 'networkidle0', timeout: 10000 });
    
    // Wait a sec to ensure React mounts
    await new Promise(r => setTimeout(r, 2000));
    
    console.log("App rendered successfully.");
    
    await browser.close();
  } catch (err) {
    console.error("Puppeteer Script Error:", err);
  } finally {
    server.close();
  }
});

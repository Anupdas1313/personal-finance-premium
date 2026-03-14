const fs = require('fs');
const https = require('https');

const logos = [
  { name: 'hdfc.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/2/28/HDFC_Bank_Logo.svg' },
  { name: 'icici.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/1/12/ICICI_Bank_Logo.svg' },
  { name: 'axis.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/a/ae/Axis_Bank_logo.svg' },
  { name: 'kotak.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/5/52/Kotak_Mahindra_Bank_logo.svg' },
  { name: 'union.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/6/62/Union_Bank_of_India_Logo.svg' },
  { name: 'idfc.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/3/36/IDFC_First_Bank_logo.svg' },
  { name: 'pnb.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/2/2a/Punjab_National_Bank_logo.svg' },
  { name: 'bob.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/5/5b/Bank_of_Baroda_Logo.svg' },
  { name: 'sbi.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/c/cc/State_Bank_of_India_logo.svg' },
  { name: 'canara.png', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Canara_Bank_Logo.svg/512px-Canara_Bank_Logo.svg.png' },
  { name: 'indusind.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/8/87/IndusInd_Bank_logo.svg' },
  { name: 'yes.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/a/a1/Yes_Bank_SVG_Logo.svg' }
];

if (!fs.existsSync('./public/banks')) {
  fs.mkdirSync('./public/banks', { recursive: true });
}

logos.forEach(logo => {
  https.get(logo.url, { headers: { 'User-Agent': 'Mozilla/5.0 ExpenseTracker/1.0' } }, (res) => {
    if (res.statusCode === 301 || res.statusCode === 302) {
      https.get(res.headers.location, { headers: { 'User-Agent': 'Mozilla/5.0 ExpenseTracker/1.0' } }, (redirectRes) => {
         const file = fs.createWriteStream(`./public/banks/${logo.name}`);
         redirectRes.pipe(file);
      });
    } else {
      const file = fs.createWriteStream(`./public/banks/${logo.name}`);
      res.pipe(file);
    }
  }).on('error', (err) => {
    console.error(`Error downloading ${logo.name}: ${err.message}`);
  });
});

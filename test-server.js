// Simple test server to serve the Cloudflare Worker HTML
const http = require('http');
const fs = require('fs');
const path = require('path');

// Function to extract HTML from worker.js (reads fresh on each call)
function extractHtmlFromWorker() {
  // Read the worker.js file to extract the HTML
  const workerCode = fs.readFileSync('./src/worker.js', 'utf8');
  
  // Extract the HTML from the handlePhoenixFrontend function (more precise regex)
  const phoenixFunctionStart = workerCode.indexOf('async function handlePhoenixFrontend');
  const htmlStartIndex = workerCode.indexOf('const html = `', phoenixFunctionStart);
  
  // Find the correct ending - look for the pattern that ends the handlePhoenixFrontend function
  let htmlEndIndex = -1;
  if (htmlStartIndex !== -1) {
    // Look for the end pattern: `;\n\n  return new Response(html
    const returnPattern = ';\n\n  return new Response(html';
    htmlEndIndex = workerCode.indexOf(returnPattern, htmlStartIndex);
    if (htmlEndIndex !== -1) {
      // Adjust to find the actual end of the template literal
      htmlEndIndex = workerCode.lastIndexOf('`', htmlEndIndex);
    }
  }
  
  let html = '<h1>HTML not found</h1>';
  
  if (htmlStartIndex !== -1 && htmlEndIndex !== -1) {
    const rawHtml = workerCode.substring(htmlStartIndex + 14, htmlEndIndex); // Skip 'const html = `'
    // Process escaped characters in the template literal
    html = rawHtml
      .replace(/\\`/g, '`')
      .replace(/\\\$/g, '$')
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t');
    console.log('✅ Successfully extracted HTML from worker.js');
    console.log(`📏 Extracted ${html.length} characters of HTML`);
  } else {
    console.error('❌ Failed to extract HTML from worker.js');
    console.log('📍 htmlStartIndex:', htmlStartIndex, 'htmlEndIndex:', htmlEndIndex);
  }
  
  return html;
}

// Extract initial HTML
let html = extractHtmlFromWorker();

const server = http.createServer((req, res) => {
  const url = req.url;
  
  // Handle Phoenix frontend
  if (url === '/' || url === '/okr-phoenix-live.html') {
    res.writeHead(200, { 
      'Content-Type': 'text/html',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    // Extract fresh HTML on each request for development
    const freshHtml = extractHtmlFromWorker();
    res.end(freshHtml);
    return;
  }
  
  // Handle login page
  if (url === '/okr-login.html') {
    // Extract login HTML from worker
    const loginMatch = workerCode.match(/const loginHtml = `([\s\S]*?)`;/);
    const loginHtml = loginMatch ? loginMatch[1] : '<h1>Login page not found</h1>';
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(loginHtml);
    return;
  }
  
  // Handle test auth page
  if (url === '/test-auth.html') {
    const testAuthHtml = fs.readFileSync('./test-auth.html', 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(testAuthHtml);
    return;
  }
  
  // Handle config.js
  if (url === '/config.js') {
    const configJs = `
window.CONFIG = {
    APP: { NAME: 'Phoenix OKR Project', VERSION: '2.0.0', CACHE_DURATION: 300000 },
    GOOGLE_SHEETS: { BASE_URL: 'https://sheets.googleapis.com/v4/spreadsheets', API_KEY: 'demo-api-key' },
    API: { BASE_URL: '${req.headers.host ? `https://${req.headers.host}` : 'https://localhost:8787'}' }
};
    `;
    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    res.end(configJs);
    return;
  }
  
  // Handle google-sheets-api.js
  if (url === '/google-sheets-api.js') {
    const googleSheetsJs = `
class GoogleSheetsAPI {
    constructor() { this.cache = new Map(); }
    async loadOutletCredentials() {
        return {
            'TBTMR': { password: 'demo123', outletName: 'APOTEK ALPRO TEBET TIMUR', am: 'JESIKA SILISTIANI' },
            'VTRYA': { password: 'demo123', outletName: 'APOTEK ALPRO VETERAN RAYA', am: 'HANNA DWI KARJAN' },
            'TOMNG': { password: 'demo123', outletName: 'APOTEK ALPRO TOMANG', am: 'DWI KRIZAWAN' },
            'BELLZ': { password: 'demo123', outletName: 'APOTEK ALPRO BELLEZA', am: 'DWI SAMARKANDI' },
            'GOLDV': { password: 'demo123', outletName: 'APOTEK ALPRO GOLDEN VIENNA', am: 'SYSTEM AM' }
        };
    }
    async getAvailableOutlets() {
        const credentials = await this.loadOutletCredentials();
        return Object.keys(credentials).map(code => ({ code, name: credentials[code].outletName, am: credentials[code].am }));
    }
}
window.GoogleSheetsAPI = GoogleSheetsAPI;
    `;
    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    res.end(googleSheetsJs);
    return;
  }
  
  // Handle favicon
  if (url === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  // Handle API endpoints
  if (url === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      status: 'online',
      platform: 'Test Server',
      timestamp: new Date().toISOString()
    }));
    return;
  }
  
  if (url === '/api/phoenix-data') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        data: { 
          outlets: {
            'TBTMR': {
              name: 'APOTEK ALPRO TEBET TIMUR',
              am: 'JESIKA SILISTIANI',
              dateAdded: '2025-08-23T07:00:00Z',
              lastUpdated: '2025-08-23T07:00:00Z',
              okr: {
                objective: 'Increase Monthly Transactions by 15%',
                description: 'Focus on growing customer base and transaction frequency',
                keyResults: [
                  'Achieve 500+ monthly transactions',
                  'Maintain 95%+ customer satisfaction',
                  'Increase average transaction value by 10%'
                ],
                progress: 75,
                dateAssigned: '2025-08-20T00:00:00Z'
              },
              performanceData: {
                term1: { revenue: 125000000, growth: 12.5 },
                term2: { revenue: 140000000, growth: 15.2 },
                term3: { revenue: 155000000, growth: 18.1 }
              },
              medals: ['🥈', '🥇']
            },
            'VTRYA': {
              name: 'APOTEK ALPRO VETERAN RAYA',
              am: 'HANNA DWI KARJAN',
              dateAdded: '2025-08-23T07:00:00Z',
              lastUpdated: '2025-08-23T07:00:00Z',
              okr: {
                objective: 'Enhance Customer Service Excellence',
                description: 'Improve customer experience and service quality',
                keyResults: [
                  'Achieve 98%+ customer satisfaction score',
                  'Reduce average waiting time to <5 minutes',
                  'Complete 100% staff customer service training'
                ],
                progress: 60,
                dateAssigned: '2025-08-21T00:00:00Z'
              },
              performanceData: {
                term1: { revenue: 110000000, growth: 8.5 },
                term2: { revenue: 120000000, growth: 11.2 },
                term3: { revenue: 135000000, growth: 14.8 }
              },
              medals: ['🥉']
            }
          }
        },
        timestamp: new Date().toISOString()
      }));
      return;
    }
    
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          message: 'Data saved successfully (test mode)',
          timestamp: new Date().toISOString()
        }));
      });
      return;
    }
  }
  
  // 404 for everything else
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

const PORT = 8787;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🔥 Phoenix OKR Test Server running on http://0.0.0.0:${PORT}`);
  console.log(`📊 Dashboard URL: http://0.0.0.0:${PORT}/okr-phoenix-live.html`);
});
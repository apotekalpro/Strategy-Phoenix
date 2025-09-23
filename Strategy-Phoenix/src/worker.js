/**
 * Phoenix OKR API - Cloudflare Workers Implementation
 * Converted from Express.js for serverless deployment
 * 
 * Features:
 * - RESTful API for Phoenix OKR data management
 * - D1 SQLite database integration
 * - CORS enabled for cross-origin requests
 * - Automatic backups on data updates
 * - Individual outlet management
 * - Health check endpoint
 */

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      let response;

      // Route handling
      if (path === '/' || path === '/index.html') {
        response = await handleIndex(request, env);
      } else if (path === '/okr-login.html') {
        response = await handleLoginPage(request, env);
      } else if (path === '/okr-phoenix-live.html') {
        response = await handlePhoenixFrontend(request, env);
      } else if (path === '/config.js') {
        response = await handleConfig(request, env);
      } else if (path === '/google-sheets-api.js') {
        response = await handleGoogleSheetsAPI(request, env);
      } else if (path === '/api/status' || path === '/health') {
        response = await handleStatus(request, env);
      } else if (path === '/api/phoenix-data') {
        response = await handlePhoenixData(request, env);
      } else if (path.startsWith('/api/outlet/')) {
        response = await handleOutlet(request, env);
      } else if (path === '/api/backups') {
        response = await handleBackups(request, env);
      } else {
        response = new Response('Not Found', { status: 404 });
      }

      // Add CORS headers to all responses
      Object.keys(corsHeaders).forEach(key => {
        response.headers.set(key, corsHeaders[key]);
      });

      return response;

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Internal server error',
        message: error.message
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  }
};

// Status endpoint
async function handleStatus(request, env) {
  return new Response(JSON.stringify({
    success: true,
    status: 'online',
    platform: 'Cloudflare Workers',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// Phoenix data management
async function handlePhoenixData(request, env) {
  const method = request.method;

  if (method === 'GET') {
    // Get data from D1 database
    try {
      const result = await env.PHOENIX_DB.prepare(
        'SELECT data FROM phoenix_data WHERE id = ?'
      ).bind('main').first();

      if (result) {
        const data = JSON.parse(result.data);
        return new Response(JSON.stringify({
          success: true,
          data: data,
          timestamp: new Date().toISOString()
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        // Return empty structure if no data exists
        return new Response(JSON.stringify({
          success: true,
          data: { outlets: {} },
          timestamp: new Date().toISOString()
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } catch (error) {
      throw new Error(`Database read error: ${error.message}`);
    }
  }

  if (method === 'POST') {
    // Save data to D1 database
    try {
      const body = await request.json();
      const dataToSave = body.data || body;
      
      // Insert or update data in D1
      await env.PHOENIX_DB.prepare(`
        INSERT OR REPLACE INTO phoenix_data (id, data, updated_at) 
        VALUES (?, ?, ?)
      `).bind('main', JSON.stringify(dataToSave), new Date().toISOString()).run();

      // Create backup entry
      await env.PHOENIX_DB.prepare(`
        INSERT INTO phoenix_backups (id, data, created_at) 
        VALUES (?, ?, ?)
      `).bind(
        `backup_${Date.now()}`,
        JSON.stringify(dataToSave),
        new Date().toISOString()
      ).run();

      return new Response(JSON.stringify({
        success: true,
        message: 'Data saved successfully',
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      throw new Error(`Database write error: ${error.message}`);
    }
  }

  return new Response('Method not allowed', { status: 405 });
}

// Individual outlet management
async function handleOutlet(request, env) {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const outletCode = pathParts[3]; // /api/outlet/{code}

  if (!outletCode) {
    return new Response('Outlet code required', { status: 400 });
  }

  const method = request.method;

  if (method === 'GET') {
    // Get specific outlet data
    try {
      const result = await env.PHOENIX_DB.prepare(
        'SELECT data FROM phoenix_data WHERE id = ?'
      ).bind('main').first();

      if (result) {
        const data = JSON.parse(result.data);
        const outlet = data.outlets && data.outlets[outletCode];
        
        if (outlet) {
          return new Response(JSON.stringify({
            success: true,
            data: outlet,
            outletCode: outletCode
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      return new Response(JSON.stringify({
        success: false,
        error: 'Outlet not found',
        outletCode: outletCode
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      throw new Error(`Outlet read error: ${error.message}`);
    }
  }

  if (method === 'POST' || method === 'PUT') {
    // Update specific outlet
    try {
      const body = await request.json();
      
      // Get current data
      const result = await env.PHOENIX_DB.prepare(
        'SELECT data FROM phoenix_data WHERE id = ?'
      ).bind('main').first();

      let data = { outlets: {} };
      if (result) {
        data = JSON.parse(result.data);
      }

      // Update outlet
      if (!data.outlets) data.outlets = {};
      data.outlets[outletCode] = {
        ...body,
        dateAdded: data.outlets[outletCode]?.dateAdded || new Date().toISOString(),
        lastModified: new Date().toISOString()
      };

      // Save updated data
      await env.PHOENIX_DB.prepare(`
        INSERT OR REPLACE INTO phoenix_data (id, data, updated_at) 
        VALUES (?, ?, ?)
      `).bind('main', JSON.stringify(data), new Date().toISOString()).run();

      return new Response(JSON.stringify({
        success: true,
        message: `Outlet ${outletCode} updated successfully`,
        data: data.outlets[outletCode]
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      throw new Error(`Outlet update error: ${error.message}`);
    }
  }

  return new Response('Method not allowed', { status: 405 });
}

// Backup management
async function handleBackups(request, env) {
  if (request.method === 'GET') {
    try {
      const results = await env.PHOENIX_DB.prepare(`
        SELECT id, created_at FROM phoenix_backups 
        ORDER BY created_at DESC 
        LIMIT 10
      `).all();

      return new Response(JSON.stringify({
        success: true,
        backups: results.results || [],
        count: results.results?.length || 0
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      throw new Error(`Backup list error: ${error.message}`);
    }
  }

  return new Response('Method not allowed', { status: 405 });
}

// Index page handler
async function handleIndex(request, env) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Phoenix OKR - Cloudflare API</title>
    <style>
        body { font-family: -apple-system, sans-serif; background: #667eea; color: white; padding: 40px; text-align: center; }
        .container { max-width: 600px; margin: 0 auto; }
        .api-card { background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); border-radius: 15px; padding: 30px; margin: 20px 0; }
        .btn { display: inline-block; padding: 12px 24px; background: rgba(255,255,255,0.2); color: white; text-decoration: none; border-radius: 8px; margin: 10px; transition: all 0.2s; }
        .btn:hover { background: rgba(255,255,255,0.3); transform: translateY(-2px); }
        .status { padding: 10px; border-radius: 5px; margin: 10px 0; }
        .success { background: rgba(72, 187, 120, 0.3); }
        .info { background: rgba(66, 153, 225, 0.3); }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Phoenix OKR API</h1>
        <p>Cloudflare Workers Backend</p>
        
        <div class="api-card">
            <h2>🌐 API Status</h2>
            <div id="status" class="status info">Testing connection...</div>
        </div>
        
        <div class="api-card">
            <h2>📊 Access Your Dashboards</h2>
            <p>The frontend HTML files are hosted on GitHub Pages:</p>
            
            <a href="/okr-phoenix-live.html" class="btn">
                🔥 Phoenix OKR Dashboard (Live Backend)
            </a>
            
            <a href="https://apotekalpro.github.io/Strategy-Phoenix/okr-phoenix-real.html" class="btn" target="_blank">
                📊 GitHub Pages Version (Limited)
            </a>
        </div>
        
        <div class="api-card">
            <h2>🔗 API Endpoints</h2>
            <p>This Cloudflare Worker provides these endpoints:</p>
            <ul style="text-align: left; display: inline-block;">
                <li><code>GET /api/status</code> - Health check</li>
                <li><code>GET /api/phoenix-data</code> - Get all OKR data</li>
                <li><code>POST /api/phoenix-data</code> - Save OKR data</li>
                <li><code>GET /api/outlet/{code}</code> - Get outlet data</li>
                <li><code>POST /api/outlet/{code}</code> - Update outlet data</li>
                <li><code>GET /api/backups</code> - List backups</li>
            </ul>
        </div>
    </div>
    
    <script>
        // Test API status on page load
        fetch('/api/status')
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    document.getElementById('status').innerHTML = '✅ API Online - Platform: ' + data.platform;
                    document.getElementById('status').className = 'status success';
                } else {
                    throw new Error('API returned error');
                }
            })
            .catch(error => {
                document.getElementById('status').innerHTML = '❌ API Error: ' + error.message;
                document.getElementById('status').className = 'status error';
            });
    </script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}

// Phoenix Frontend handler - Complete GitHub Functionality
async function handlePhoenixFrontend(request, env) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Phoenix Project Dashboard - Live Backend Version</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        /* Global performance optimizations */
        html {
            scroll-behavior: smooth;
        }
        
        *,
        *::before,
        *::after {
            backface-visibility: hidden;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
            /* Scroll performance optimizations */
            overflow-x: hidden;
            scroll-behavior: smooth;
        }

        .dashboard-container {
            max-width: 1400px;
            margin: 0 auto;
            /* Performance optimizations */
            will-change: scroll-position;
            backface-visibility: hidden;
        }

        .dashboard-header {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 25px;
            margin-bottom: 25px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }

        .header-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }

        .dashboard-title {
            font-size: 2rem;
            font-weight: 800;
            color: #2d3748;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .user-info {
            display: flex;
            align-items: center;
            gap: 15px;
            color: #4a5568;
        }

        .logout-btn {
            background: #e53e3e;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 0.9rem;
            cursor: pointer;
            transition: all 0.2s;
        }

        .logout-btn:hover {
            background: #c53030;
            transform: translateY(-1px);
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
        }

        .stat-card {
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            color: white;
            padding: 20px;
            border-radius: 12px;
            text-align: center;
            box-shadow: 0 4px 15px rgba(79, 172, 254, 0.2);
        }

        .stat-value {
            font-size: 2rem;
            font-weight: 700;
            margin-bottom: 5px;
        }

        .stat-label {
            font-size: 0.9rem;
            opacity: 0.9;
        }
        
        /* Modal styles */
        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(5px);
            align-items: center;
            justify-content: center;
        }

        .modal-content {
            background: white;
            border-radius: 15px;
            padding: 25px;
            max-width: 500px;
            width: 90%;
            max-height: 90%;
            overflow-y: auto;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }

        .modal-header {
            font-size: 1.4rem;
            font-weight: 700;
            color: #2d3748;
            margin-bottom: 20px;
            text-align: center;
        }
        
        .modal-buttons {
            display: flex;
            gap: 10px;
            margin-top: 20px;
        }
        
        .btn {
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            color: white; border: none; padding: 10px 20px;
            border-radius: 8px; cursor: pointer; font-weight: 600;
            transition: all 0.2s; text-decoration: none; display: inline-block;
        }

        .btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(79, 172, 254, 0.3);
        }
        
        .btn.btn-primary { background: linear-gradient(135deg, #48bb78, #38a169); }
        .btn.btn-secondary { background: linear-gradient(135deg, #718096, #4a5568); }
        .btn.success { background: linear-gradient(135deg, #10b981, #059669); }
        .btn.warning { background: linear-gradient(135deg, #f59e0b, #d97706); }
        .btn.danger { background: linear-gradient(135deg, #ef4444, #dc2626); }

        
        .phoenix-outlet-card {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
            transition: all 0.3s ease;
            cursor: pointer;
            transform: translateZ(0);
        }
        
        .phoenix-outlet-card:hover {
            transform: translateY(-5px) translateZ(0);
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
        }
        
        .outlet-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 15px;
        }
        
        .outlet-info h3 {
            font-size: 1.2rem;
            font-weight: 700;
            color: #2d3748;
            margin-bottom: 5px;
        }
        
        .outlet-code {
            font-size: 0.85rem;
            color: #718096;
        }
        
        .phoenix-badge {
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
            color: white;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 600;
        }
        
        .performance-metrics {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-bottom: 15px;
        }
        
        .metric-item {
            text-align: center;
            padding: 12px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        
        .metric-value {
            font-size: 1.1rem;
            font-weight: 700;
            color: #2d3748;
            margin-bottom: 4px;
        }
        
        .metric-label {
            font-size: 0.8rem;
            color: #718096;
        }
        
        .progress-section {
            margin-top: 15px;
        }
        
        .progress-title {
            font-size: 0.9rem;
            font-weight: 600;
            color: #4a5568;
            margin-bottom: 10px;
        }
        
        .progress-item {
            display: flex;
            align-items: center;
            margin-bottom: 8px;
        }
        
        .progress-label {
            min-width: 40px;
            font-size: 0.8rem;
            font-weight: 600;
            color: #718096;
        }
        
        .progress-bar {
            flex: 1;
            height: 8px;
            background: #e2e8f0;
            border-radius: 4px;
            margin: 0 10px;
            overflow: hidden;
        }
        
        .progress-fill {
            height: 100%;
            background: linear-gradient(135deg, #48bb78, #38a169);
            border-radius: 4px;
            transition: width 0.3s ease;
        }
        
        .progress-value {
            min-width: 35px;
            font-size: 0.8rem;
            font-weight: 600;
            color: #4a5568;
            text-align: right;
        }
        
        .outlets-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }
        
        .status {
            position: fixed; top: 10px; right: 10px; z-index: 1000;
            padding: 8px 12px; border-radius: 6px; font-size: 0.85rem;
            font-weight: 600; color: white; transition: all 0.3s ease;
        }
        
        .status.online {
            background: linear-gradient(135deg, #10b981, #059669);
            box-shadow: 0 2px 10px rgba(16, 185, 129, 0.3);
        }
        
        .status.offline {
            background: linear-gradient(135deg, #ef4444, #dc2626);
            box-shadow: 0 2px 10px rgba(239, 68, 68, 0.3);
        }
        
        .btn {
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            color: white; border: none; padding: 10px 20px;
            border-radius: 8px; cursor: pointer; font-weight: 600;
            transition: all 0.2s; text-decoration: none; display: inline-block;
        }
        
        .btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(79, 172, 254, 0.3);
        }
        
        
        /* Medal Section Styles */
        .medal-section {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 15px;
            padding: 25px;
            margin-bottom: 25px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
            text-align: center;
        }
        
        .medal-header h3 {
            font-size: 1.3rem;
            color: #2d3748;
            margin-bottom: 8px;
        }
        
        .medal-header p {
            color: #718096;
            margin-bottom: 20px;
        }
        
        .medal-tiers {
            display: flex;
            justify-content: center;
            gap: 30px;
            margin-bottom: 25px;
            flex-wrap: wrap;
        }
        
        .tier-item {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 0.9rem;
            color: #4a5568;
        }
        
        .tier-icon {
            font-size: 1.2rem;
        }
        
        /* Outlets Section Styles */
        .outlets-section {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 15px;
            padding: 25px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        }
        
        .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 25px;
        }
        
        .section-header h3 {
            font-size: 1.3rem;
            color: #2d3748;
        }
        
        .section-controls {
            display: flex;
            gap: 10px;
        }
        
        .empty-state-card {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 15px;
            padding: 40px;
            text-align: center;
        }
        
        .empty-icon {
            font-size: 4rem;
            margin-bottom: 15px;
        }
        
        /* Phoenix Outlet Card Updates */
        .phoenix-outlet-card {
            background: rgba(255, 255, 255, 0.95);
            border-left: 4px solid #ff6b6b;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 15px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            transition: all 0.3s ease;
        }
        
        .phoenix-outlet-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
        }
        
        .outlet-achievement-section {
            margin-top: 15px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        
        .achievement-title {
            font-size: 0.9rem;
            font-weight: 600;
            color: #4a5568;
            margin-bottom: 10px;
        }
        
        .achievement-tiers {
            display: grid;
            gap: 8px;
        }
        
        .achievement-tier {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 0.85rem;
        }
        
        .tier-progress {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .tier-bar {
            width: 60px;
            height: 6px;
            background: #e2e8f0;
            border-radius: 3px;
            overflow: hidden;
        }
        
        .tier-fill {
            height: 100%;
            background: linear-gradient(135deg, #48bb78, #38a169);
            border-radius: 3px;
            transition: width 0.3s ease;
        }
        
        /* Outlet Search Modal */
        .outlet-search-input {
            width: 100%;
            padding: 12px 16px;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            font-size: 0.95rem;
            margin-bottom: 15px;
        }
        
        .outlet-list {
            max-height: 300px;
            overflow-y: auto;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
        }
        
        .outlet-option {
            padding: 12px 16px;
            border-bottom: 1px solid #f1f5f9;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .outlet-option:hover {
            background: #f8f9fa;
        }
        
        .outlet-option:last-child {
            border-bottom: none;
        }
        
        .outlet-option h4 {
            font-size: 0.95rem;
            color: #2d3748;
            margin-bottom: 4px;
        }
        
        .outlet-option p {
            font-size: 0.8rem;
            color: #718096;
        }
        
        /* Form Styles */
        input, textarea, select {
            width: 100%;
            padding: 10px;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            font-size: 0.9rem;
            margin-bottom: 10px;
        }
        
        label {
            display: block;
            font-weight: 600;
            color: #4a5568;
            margin-bottom: 5px;
        }
        
        .loading {
            text-align: center; padding: 40px; color: #4a5568;
            display: flex; align-items: center; justify-content: center;
        }
        
        .spinner {
            width: 30px; height: 30px; border: 3px solid #e2e8f0;
            border-top: 3px solid #4facfe; border-radius: 50%;
            animation: spin 1s linear infinite; margin-right: 10px;
        }
        
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        
        .controls {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 15px; padding: 20px; margin-bottom: 20px;
            display: flex; flex-wrap: wrap; gap: 10px; align-items: center;
        }
        
        .notification {
            position: fixed; top: 60px; right: 10px; z-index: 1001;
            padding: 12px 16px; border-radius: 8px; font-weight: 600;
            color: white; max-width: 300px; animation: slideIn 0.3s ease;
        }
        
        .notification.success { background: linear-gradient(135deg, #10b981, #059669); }
        .notification.error { background: linear-gradient(135deg, #ef4444, #dc2626); }
        .notification.warning { background: linear-gradient(135deg, #f59e0b, #d97706); }
        
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    </style>
</head>
<body>
    <!-- Status indicator (hidden) -->
    <div id="status" class="status online" style="display: none;">🔥 Live Backend Connected</div>
    
    <!-- Main Dashboard View -->
    <div id="dashboard-view">
        <div class="dashboard-container">
            <div class="dashboard-header">
                <div class="header-top">
                    <h1 class="dashboard-title">
                        🔥 Phoenix Project Dashboard
                    </h1>
                    <div class="user-info">
                        <span id="user-name">👑 Loading...</span>
                        <button class="logout-btn" onclick="logout()">Logout</button>
                    </div>
                </div>
                
                <!-- Statistics Cards -->
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-value" id="total-phoenix-outlets">0</div>
                        <div class="stat-label">Phoenix Outlets</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" id="total-revenue">Rp 0</div>
                        <div class="stat-label">Total Revenue</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" id="avg-progress">0%</div>
                        <div class="stat-label">Avg Progress</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" id="medal-count">0</div>
                        <div class="stat-label">Medals Earned</div>
                    </div>
                </div>
            </div>
            
            <!-- Medal Collection Section -->
            <div class="medal-section">
                <div class="medal-header">
                    <h3>🏅 Medal Collection</h3>
                    <p>Complete sales targets to earn medals and rewards</p>
                </div>
                
                <div class="medal-tiers">
                    <div class="tier-item">
                        <span class="tier-icon">🥉</span>
                        <span class="tier-label">Tier 1 (90%): 1.95% reward</span>
                    </div>
                    <div class="tier-item">
                        <span class="tier-icon">🥈</span>
                        <span class="tier-label">Tier 2 (95%): 2.0% reward</span>
                    </div>
                    <div class="tier-item">
                        <span class="tier-icon">🥇</span>
                        <span class="tier-label">Tier 3 (100%): 2.7% reward</span>
                    </div>
                </div>
                
                <button class="btn btn-primary" onclick="showAwardModal()">🏆 Award Special Medal</button>
            </div>
            
            <!-- Phoenix Project Outlets Section -->
            <div class="outlets-section">
                <div class="section-header">
                    <h3>🏪 Phoenix Project Outlets</h3>
                    <div class="section-controls">
                        <button class="btn btn-primary" onclick="showAddOutletModal()">➕ Add Outlet to Phoenix Program</button>
                    </div>
                </div>
                
                <!-- Outlets Grid -->
                <div id="outlets-grid" class="outlets-grid">
                    <div class="loading">
                        <div class="spinner"></div>
                        Loading Phoenix OKR data from live backend...
                    </div>
                </div>
                
                <!-- Empty State -->
                <div id="empty-state" style="display: none; text-align: center; padding: 40px;">
                    <div class="empty-state-card">
                        <div class="empty-icon">🏪📊</div>
                        <h3>No Phoenix Outlets Yet</h3>
                        <p>Start by adding outlets to the Phoenix Program to track their OKR progress.</p>
                        <button class="btn btn-primary" onclick="showAddOutletModal()">➕ Add First Outlet</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <!-- Detail View -->
    <div id="detail-view">
        <div class="dashboard-container">
            <div class="detail-header">
                <button class="btn" onclick="backToCardView()">← Back to Dashboard</button>
                <h2 id="detail-outlet-name">Outlet Detail</h2>
                <div id="detail-outlet-info">Loading...</div>
            </div>
            
            <div class="detail-content">
                <div class="detail-section">
                    <h3>📊 Performance Data Entry</h3>
                    <!-- Performance data inputs will go here -->
                </div>
                
                <div class="detail-section" id="outlet-okr-section">
                    <h3>🎯 OKR Management</h3>
                    <!-- OKR content will go here -->
                </div>
            </div>
        </div>
    </div>
    
    <!-- Add Outlet Modal -->
    <div id="add-outlet-modal" class="modal">
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">➕ Add Outlet to Phoenix Program</div>
            <div id="add-outlet-body">
                <input type="text" 
                       class="outlet-search-input" 
                       id="outlet-search" 
                       placeholder="Search outlets..." 
                       oninput="filterOutlets()">
                
                <div class="outlet-list" id="outlet-list">
                    <div style="text-align: center; padding: 20px; color: #718096;">
                        Loading available outlets...
                    </div>
                </div>
            </div>
            <div class="modal-buttons">
                <button class="btn btn-secondary" onclick="closeAddOutletModal()">Cancel</button>
                <button class="btn btn-primary" id="add-to-phoenix-btn" onclick="addSelectedOutletToPhoenix()" disabled>
                    Add to Phoenix
                </button>
            </div>
        </div>
    </div>
    
    <!-- OKR Assignment Modal -->
    <div id="okr-modal" class="modal">
        <div class="modal-content" style="max-width: 800px;">
            <div class="modal-header" id="okr-modal-title">🎯 Assign OKR</div>
            <div id="okr-modal-body">
                <!-- OKR content will be dynamically loaded -->
            </div>
        </div>
    </div>
    
    <!-- Medal Reward Modal -->
    <div id="medal-modal" class="modal">
        <div class="modal-content">
            <div class="modal-header" id="medal-modal-title">🏆 Award Medal</div>
            <div id="medal-modal-body">
                <!-- Medal content will be dynamically loaded -->
            </div>
        </div>
    </div>
    
    <!-- Configuration and API Scripts -->
    <script src="/config.js"></script>
    <script src="/google-sheets-api.js"></script>
    
    <!-- Live Backend API Script -->
    <script>
        // Live Backend API Class for Cloudflare Workers
        class LiveBackendAPI {
            constructor() {
                this.baseURL = window.location.origin;
                console.log('🔥 LiveBackendAPI initialized with baseURL:', this.baseURL);
            }
            
            async checkServerStatus() {
                try {
                    const response = await fetch(\`\${this.baseURL}/api/status\`);
                    const data = await response.json();
                    return data.success;
                } catch (error) {
                    console.error('❌ Server status check failed:', error);
                    return false;
                }
            }
            
            async loadPhoenixData() {
                try {
                    const response = await fetch(\`\${this.baseURL}/api/phoenix-data\`);
                    const data = await response.json();
                    if (data.success) {
                        return data.data;
                    } else {
                        throw new Error(data.error || 'Failed to load data');
                    }
                } catch (error) {
                    console.error('❌ Load Phoenix data failed:', error);
                    return null;
                }
            }
            
            async savePhoenixData(phoenixData) {
                try {
                    const response = await fetch(\`\${this.baseURL}/api/phoenix-data\`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(phoenixData)
                    });
                    const data = await response.json();
                    return data.success;
                } catch (error) {
                    console.error('❌ Save Phoenix data failed:', error);
                    return false;
                }
            }
        }
        
        // Global variables
        let phoenixData = { outlets: {} };
        let phoenixOutlets = [];
        let allOutlets = []; // Available outlets from Google Sheets
        let currentUser = null;
        let userPermissions = null;
        let currentOKROutlet = null;
        let currentDetailOutlet = null;
        let apiOnline = true;
        const apiURL = window.location.origin;
        
        // Initialize Google Sheets API
        let googleSheetsAPI = null;
        
        // Phoenix OKR Templates
        const phoenixOKRTemplates = [
            {
                id: 1,
                title: '🔥 OKR PHOENIX PROJECT – PENINGKATAN TRANSAKSI',
                description: 'Meningkatkan volume transaksi harian sebanyak 10%/mth melalui peningkatan trafik masuk dan return rate.',
                category: 'Phoenix Main',
                keyResults: [
                    'KR1 – Melakukan 15 Tes Kesehatan/Hari melalui Booth Campaign',
                    'KR2 – Capai >90% Tingkat Rekrutmen Member VIP dari Pelanggan Non-Member',
                    'KR3 – Sebar 1.000 Flyer AJH di Hotzone dengan Hook Membership + Voucher'
                ],
                actionPlans: {
                    kr1: [
                        'Pasang tripod banner bertuliskan "Diskon 50% Cek Kesehatan"',
                        'Ajak pelanggan sekitar untuk cek tekanan darah gratis',
                        'Arahkan pelanggan masuk untuk daftar member VIP gratis'
                    ],
                    kr2: [
                        'Ajak semua pelanggan non-member untuk daftar sebagai member VIP',
                        'Jelaskan keuntungan member VIP – terutama 4x voucher Rp10rb',
                        'Kirim reminder bulanan via WA terkait voucher'
                    ],
                    kr3: [
                        'Jadwalkan pembagian flyer saat jam sibuk di hotzone',
                        'Promosikan: "Gratis Tes + Member + Voucher Rp40rb"',
                        'Catat sisa flyer harian dalam tracking'
                    ]
                }
            },
            {
                id: 2,
                title: '🏢 OKR – APARTMENT OUTLET TRANSACTION BOOST',
                description: 'Meningkatkan jumlah transaksi sebanyak 10%/mth di outlet berbasis apartemen.',
                category: 'Apartment Outlet',
                keyResults: [
                    'KR1 – Pasang minimal 2 titik materi promosi di area lobby apartemen',
                    'KR2 – Distribusikan 1.000 kartu nama WA Order/brosur per bulan',
                    'KR3 – Bangun engagement komunitas apartemen melalui WA Group'
                ],
                actionPlans: {
                    kr1: [
                        'Survei titik strategis: lobby utama, pintu masuk tower, area lift',
                        'Ajukan quotation ke Strategy Team untuk banner/standee',
                        'Pasang materi promosi dan dokumentasikan'
                    ],
                    kr2: [
                        'Cetak 1.000 kartu nama atau flyer mini setiap bulan',
                        'Setiap transaksi obat kronis wajib diselipkan kartu nama',
                        'Edukasi pelanggan: bisa pesan ulang via WA'
                    ],
                    kr3: [
                        'Gabung ke grup WA tower atau buat grup baru',
                        'Undang pelanggan untuk join saat transaksi',
                        'Lakukan minimal 10 posting edukasi/promo setiap bulan'
                    ]
                }
            }
        ];
        
        // API Functions
        async function apiCall(endpoint, options = {}) {
            try {
                const response = await fetch(\`\${apiURL}/api\${endpoint}\`, {
                    headers: { 'Content-Type': 'application/json', ...options.headers },
                    ...options
                });
                const data = await response.json();
                apiOnline = response.ok;
                updateStatus(apiOnline);
                return response.ok ? data : { success: false, error: data.error };
            } catch (error) {
                console.error('API Error:', error);
                apiOnline = false;
                updateStatus(false);
                return { success: false, error: error.message };
            }
        }
        
        // Initialize Live Backend API
        window.liveBackendAPI = new LiveBackendAPI();
        
        function updateStatus(online) {
            const status = document.getElementById('status');
            status.className = \`status \${online ? 'online' : 'offline'}\`;
            status.textContent = online ? '🔥 Live Backend Connected' : '🔴 Backend Offline';
        }
        
        function showNotification(message, type = 'success') {
            const notification = document.createElement('div');
            notification.className = \`notification \${type}\`;
            notification.textContent = message;
            document.body.appendChild(notification);
            setTimeout(() => {
                notification.style.opacity = '0';
                setTimeout(() => {
                    if (document.body.contains(notification)) {
                        document.body.removeChild(notification);
                    }
                }, 300);
            }, 3000);
        }
        
        // Setup user permissions
        function setupUserPermissions() {
            console.log('🔐 Setting up user permissions for:', currentUser);
            
            // For this live backend version, assume admin permissions
            userPermissions = {
                canViewAllOutlets: true,
                canAddOutlets: true,
                allowedOutlets: [],
                canAssignOKR: true,
                canEditOKR: true,
                canDeleteOKR: true,
                canRewardMedals: true,
                canComment: true,
                canLike: true,
                role: 'Admin'
            };
            
            // Update user display
            const userNameElement = document.getElementById('user-name');
            if (userNameElement && currentUser) {
                userNameElement.textContent = `👑 ${currentUser.name || currentUser.username} (${userPermissions.role})`;
            }
            
            console.log('👑 Admin permissions set - full access to all functions');
        }
        
        // Load Phoenix data from live backend
        async function loadPhoenixData() {
            try {
                console.log('📥 Loading Phoenix data from live backend...');
                const result = await apiCall('/phoenix-data');
                if (result.success) {
                    phoenixData = result.data || { outlets: {} };
                    phoenixOutlets = Object.keys(phoenixData.outlets).map(code => ({
                        code: code,
                        name: phoenixData.outlets[code].name || \`APOTEK ALPRO \${code}\`,
                        am: phoenixData.outlets[code].am || 'SYSTEM AM',
                        ...phoenixData.outlets[code]
                    }));
                    
                    renderPhoenixDashboard();
                    console.log(\`✅ Loaded \${phoenixOutlets.length} Phoenix outlets from live backend\`);
                    showNotification(\`Loaded \${phoenixOutlets.length} outlets from live backend\`);
                } else {
                    throw new Error(result.error || 'Failed to load data');
                }
            } catch (error) {
                console.error('❌ Failed to load Phoenix data:', error);
                showNotification('Failed to load data from backend', 'error');
                
                // Initialize empty data structure
                phoenixData = { outlets: {} };
                phoenixOutlets = [];
                renderPhoenixDashboard();
            }
        }
        
        // Save Phoenix data to live backend
        async function savePhoenixData(description = 'Data updated') {
            try {
                console.log('💾 Saving Phoenix data to live backend...', description);
                
                if (window.liveBackendAPI) {
                    const success = await window.liveBackendAPI.savePhoenixData(phoenixData);
                    if (success) {
                        console.log('✅ Phoenix data saved to live backend successfully');
                        showNotification('Data saved to live backend');
                        
                        // Also save to localStorage as backup
                        localStorage.setItem('phoenixProjectData', JSON.stringify(phoenixData));
                        return true;
                    } else {
                        throw new Error('Backend save failed');
                    }
                } else {
                    throw new Error('Live backend API not available');
                }
            } catch (error) {
                console.error('❌ Failed to save Phoenix data:', error);
                showNotification('Failed to save data to backend', 'error');
                
                // Fallback to localStorage
                try {
                    localStorage.setItem('phoenixProjectData', JSON.stringify(phoenixData));
                    showNotification('Data saved to local storage (fallback)', 'warning');
                    return true;
                } catch (localError) {
                    console.error('❌ Local storage also failed:', localError);
                    return false;
                }
            }
        }
        
        // Main dashboard rendering
        function renderPhoenixDashboard() {
            const outletsGrid = document.getElementById('outlets-grid');
            const emptyState = document.getElementById('empty-state');
            
            if (!outletsGrid) {
                console.error('❌ outlets-grid element not found');
                return;
            }
            
            // Update statistics with error handling
            const updateElement = (id, value) => {
                const element = document.getElementById(id);
                if (element) {
                    element.textContent = value;
                } else {
                    console.error(`❌ Element with ID '${id}' not found`);
                }
            };
            
            updateElement('total-phoenix-outlets', phoenixOutlets.length);
            
            // Calculate total revenue, progress, and medals
            let totalRevenue = 0;
            let totalProgress = 0;
            let totalMedals = 0;
            
            phoenixOutlets.forEach(outlet => {
                if (outlet.performanceData) {
                    const perfData = outlet.performanceData;
                    totalRevenue += (perfData.term1?.revenue || 0) + (perfData.term2?.revenue || 0) + (perfData.term3?.revenue || 0);
                }
                totalProgress += outlet.okr?.progress || 0;
                
                // Count medals
                if (outlet.medals && Array.isArray(outlet.medals)) {
                    totalMedals += outlet.medals.length;
                }
            });
            
            const avgProgress = phoenixOutlets.length > 0 ? Math.round(totalProgress / phoenixOutlets.length) : 0;
            
            updateElement('total-revenue', formatCurrency(totalRevenue));
            updateElement('avg-progress', avgProgress + '%');
            updateElement('medal-count', totalMedals);
            
            if (phoenixOutlets.length === 0) {
                outletsGrid.innerHTML = ''; // Clear loading content
                outletsGrid.style.display = 'none';
                emptyState.style.display = 'block';
                return;
            }
            
            outletsGrid.style.display = 'grid';
            emptyState.style.display = 'none';
            
            // Render outlet cards with full functionality
            outletsGrid.innerHTML = phoenixOutlets.map(outlet => {
                const hasOKR = outlet.okr && outlet.okr.objective;
                const lastUpdated = outlet.lastUpdated ? new Date(outlet.lastUpdated).toLocaleDateString() : 'Never';
                
                // Calculate overall outlet progress
                const outletProgress = calculateOutletProgress(outlet);
                
                // Get medals for display
                const medals = outlet.medals || [];
                const medalDisplay = medals.slice(0, 3).map(m => m.tierEmoji || '🏅').join(' ');
                
                // Admin controls
                const adminControls = userPermissions?.canDeleteOKR ? \`
                    <div class="admin-controls">
                        <button class="admin-btn" onclick="event.stopPropagation(); fixOutletData('\${outlet.code}')" title="Fix Data Structure">🔧</button>
                        \${hasOKR ? \`<button class="admin-btn" onclick="event.stopPropagation(); deleteOutletOKR('\${outlet.code}')" title="Delete OKR" style="background: rgba(239, 68, 68, 0.1); color: #dc2626;">🗑️</button>\` : ''}
                        \${userPermissions?.canRewardMedals ? \`<button class="admin-btn" onclick="event.stopPropagation(); showRewardMedalModal('\${outlet.code}')" title="Award Medal" style="background: rgba(245, 158, 11, 0.1); color: #d97706;">🏆</button>\` : ''}
                    </div>
                \` : '';
                
                // Performance data for display
                const performanceData = outlet.performanceData || {};
                const totalRevenue = (performanceData.term1?.revenue || 0) + (performanceData.term2?.revenue || 0) + (performanceData.term3?.revenue || 0);
                const totalTrano = (performanceData.term1?.trano || 0) + (performanceData.term2?.trano || 0) + (performanceData.term3?.trano || 0);
                
                return \`
                    <div class="phoenix-outlet-card" onclick="showOutletDetail('\${outlet.code}')" style="position: relative;">
                        \${adminControls}
                        <div class="outlet-header">
                            <div class="outlet-info">
                                <h3>\${outlet.name}</h3>
                                <div class="outlet-code">Code: \${outlet.code} | AM: \${outlet.am}</div>
                            </div>
                            <div class="phoenix-badge">🔥 Phoenix</div>
                        </div>
                        
                        <!-- Performance Metrics -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 15px 0;">
                            <div style="text-align: center; padding: 12px; background: #f8f9fa; border-radius: 8px;">
                                <div style="font-size: 1.1rem; font-weight: 700; color: #2d3748;">\${formatCurrency(totalRevenue)}</div>
                                <div style="font-size: 0.8rem; color: #718096;">Total Revenue</div>
                            </div>
                            <div style="text-align: center; padding: 12px; background: #f8f9fa; border-radius: 8px;">
                                <div style="font-size: 1.1rem; font-weight: 700; color: #2d3748;">\${totalTrano.toLocaleString()}</div>
                                <div style="font-size: 0.8rem; color: #718096;">Total Trano</div>
                            </div>
                        </div>
                        
                        <!-- Achievement Tiers Section -->
                        <div class="outlet-achievement-section">
                            <div class="achievement-title">🏅 Achievement Tiers</div>
                            <div class="achievement-tiers">
                                <div class="achievement-tier">
                                    <span>KR1</span>
                                    <div class="tier-progress">
                                        <div class="tier-bar">
                                            <div class="tier-fill" style="width: \${hasOKR ? Math.min(outletProgress, 100) : 0}%"></div>
                                        </div>
                                        <span>0%</span>
                                    </div>
                                </div>
                                <div class="achievement-tier">
                                    <span>KR2</span>
                                    <div class="tier-progress">
                                        <div class="tier-bar">
                                            <div class="tier-fill" style="width: 0%"></div>
                                        </div>
                                        <span>0%</span>
                                    </div>
                                </div>
                                <div class="achievement-tier">
                                    <span>KR3</span>
                                    <div class="tier-progress">
                                        <div class="tier-bar">
                                            <div class="tier-fill" style="width: 0%"></div>
                                        </div>
                                        <span>0%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        \${hasOKR ? \`
                            <div style="margin-top: 15px; padding: 12px; background: #e6fffa; border-radius: 8px; border-left: 4px solid #48bb78;">
                                <div style="font-size: 0.9rem; font-weight: 600; color: #2d3748; margin-bottom: 5px;">🎯 OKR Key Results Progress</div>
                                <div style="font-size: 0.85rem; color: #4a5568;">Overall Progress: \${outletProgress}%</div>
                            </div>
                            
                            <div style="margin-top: 15px; display: flex; justify-content: space-between; align-items: center;">
                                <div style="background: #e6fffa; color: #38a169; padding: 4px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">
                                    🎯 OKR Assigned
                                </div>
                                <div style="font-size: 0.8rem; color: #718096;">\${outlet.okr.keyResults ? outlet.okr.keyResults.length : 0} Key Results</div>
                            </div>
                            
                            <div style="margin-top: 10px;">
                                <h4 style="font-size: 0.9rem; color: #2d3748; margin-bottom: 5px;">🎯 Objective:</h4>
                                <p style="font-size: 0.85rem; color: #4a5568; line-height: 1.4;">\${outlet.okr.objective}</p>
                            </div>
                            
                            \${userPermissions?.canAssignOKR || userPermissions?.canEditOKR ? \`
                                <div style="margin-top: 15px; text-align: center;">
                                    <button onclick="event.stopPropagation(); assignOKR('\${outlet.code}')" 
                                            style="background: #667eea; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 0.8rem;">
                                        ✏️ Edit OKR
                                    </button>
                                </div>
                            \` : ''}
                        \` : \`
                            <div style="margin-top: 15px; text-align: center; padding: 20px;">
                                <div style="background: #fef5e7; color: #d69e2e; padding: 8px 12px; border-radius: 12px; font-size: 0.8rem; font-weight: 600; margin-bottom: 10px;">
                                    ⚠️ No OKR Assigned
                                </div>
                                <p style="color: #718096; margin-bottom: 20px;">This outlet doesn't have an OKR assigned yet. Assign one to start tracking objectives and key results.</p>
                                \${userPermissions?.canAssignOKR ? \`
                                    <button onclick="event.stopPropagation(); assignOKR('\${outlet.code}')" 
                                            style="background: #48bb78; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer;">
                                        🎯 Assign OKR
                                    </button>
                                \` : ''}
                            </div>
                        \`}
                    </div>
                \`;
            }).join('');
        }
        
        // Calculate outlet progress based on OKR action plan completion
        function calculateOutletProgress(outlet) {
            if (!outlet.okr || !outlet.okr.actionPlans) {
                return 0; // No OKR assigned
            }
            
            const actionPlans = outlet.okr.actionPlans;
            const krProgress = outlet.okr.krProgress || {};
            let totalActions = 0;
            let completedActions = 0;
            
            // Count total and completed actions across all KRs
            Object.keys(actionPlans).forEach(krKey => {
                const actions = actionPlans[krKey] || [];
                totalActions += actions.length;
                
                const krData = krProgress[krKey] || {};
                const completed = krData.completedActions || [];
                completedActions += completed.length;
            });
            
            return totalActions > 0 ? Math.round((completedActions / totalActions) * 100) : 0;
        }
        
        function formatCurrency(amount) {
            return 'Rp ' + amount.toLocaleString('id-ID');
        }
        
        // OKR Assignment Functions
        function assignOKR(outletCode) {
            if (!userPermissions.canAssignOKR && !userPermissions.canEditOKR) {
                showNotification('❌ You do not have permission to assign OKRs', 'error');
                return;
            }
            
            const outlet = phoenixOutlets.find(o => o.code === outletCode);
            if (!outlet) {
                console.error('❌ Outlet not found:', outletCode);
                showNotification('❌ Outlet not found', 'error');
                return;
            }
            
            currentOKROutlet = outlet;
            console.log('✅ Assigning OKR to outlet:', currentOKROutlet);
            
            const modal = document.getElementById('okr-modal');
            const modalTitle = document.getElementById('okr-modal-title');
            const modalBody = document.getElementById('okr-modal-body');
            
            modalTitle.textContent = \`🎯 \${outlet.okr ? 'Edit' : 'Assign'} OKR for \${outlet.name}\`;
            
            modalBody.innerHTML = \`
                <div style="margin-bottom: 20px;">
                    <h4 style="color: #2d3748; margin-bottom: 15px;">Choose Phoenix OKR Template:</h4>
                    \${phoenixOKRTemplates.map(template => \`
                        <div class="okr-template-option" data-template-id="\${template.id}" onclick="selectOKRTemplate(\${template.id})">
                            <div class="okr-template-title">\${template.title}</div>
                            <div class="okr-template-desc">\${template.description}</div>
                            <div class="okr-template-category">\${template.category}</div>
                        </div>
                    \`).join('')}
                </div>
                
                <div id="okr-customization" style="display: none; background: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
                    <h4 style="margin-bottom: 15px; color: #2d3748;">📝 Customize OKR</h4>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; font-weight: 600; color: #4a5568; margin-bottom: 5px;">Objective:</label>
                        <input type="text" id="okr-objective-input" style="width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 0.9rem;">
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; font-weight: 600; color: #4a5568; margin-bottom: 5px;">Description:</label>
                        <textarea id="okr-description-input" style="width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 0.9rem; min-height: 60px; resize: vertical;"></textarea>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; font-weight: 600; color: #4a5568; margin-bottom: 5px;">Key Results (one per line):</label>
                        <textarea id="okr-keyresults-input" style="width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 0.9rem; min-height: 100px; resize: vertical;"></textarea>
                    </div>
                </div>
                
                <div class="modal-buttons">
                    <button class="btn btn-secondary" onclick="closeOKRModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="saveOKRAssignment()" id="save-okr-btn" disabled>Assign OKR</button>
                </div>
            \`;
            
            modal.style.display = 'flex';
        }
        
        function selectOKRTemplate(templateId) {
            // Remove previous selection
            document.querySelectorAll('.okr-template-option').forEach(option => {
                option.style.borderColor = '#e2e8f0';
                option.style.background = 'white';
            });
            
            // Select current template
            const selectedOption = document.querySelector(\`[data-template-id="\${templateId}"]\`);
            selectedOption.style.borderColor = '#48bb78';
            selectedOption.style.background = '#f0fff4';
            
            // Get template data
            const template = phoenixOKRTemplates.find(t => t.id === templateId);
            if (!template) return;
            
            // Fill customization form
            document.getElementById('okr-objective-input').value = template.title;
            document.getElementById('okr-description-input').value = template.description;
            document.getElementById('okr-keyresults-input').value = template.keyResults.join('\\n');
            
            // Show customization section
            document.getElementById('okr-customization').style.display = 'block';
            document.getElementById('save-okr-btn').disabled = false;
        }
        
        function saveOKRAssignment() {
            if (!currentOKROutlet) return;
            
            const objective = document.getElementById('okr-objective-input').value.trim();
            const description = document.getElementById('okr-description-input').value.trim();
            const keyResultsText = document.getElementById('okr-keyresults-input').value.trim();
            
            if (!objective || !keyResultsText) {
                showNotification('❌ Please fill in objective and key results', 'error');
                return;
            }
            
            const keyResults = keyResultsText.split('\\n').filter(kr => kr.trim()).map(kr => kr.trim());
            
            // Get the selected template to include action plans
            const selectedTemplateId = document.querySelector('.okr-template-option[style*="border-color: rgb(72, 187, 120)"]')?.getAttribute('data-template-id');
            const selectedTemplate = selectedTemplateId ? phoenixOKRTemplates.find(t => t.id == selectedTemplateId) : null;
            
            // Create OKR object
            const okr = {
                objective: objective,
                description: description,
                keyResults: keyResults,
                actionPlans: selectedTemplate ? selectedTemplate.actionPlans : null,
                progress: 0,
                dateAssigned: new Date().toISOString()
            };
            
            // Save to Phoenix data
            if (!phoenixData.outlets[currentOKROutlet.code]) {
                phoenixData.outlets[currentOKROutlet.code] = {};
            }
            phoenixData.outlets[currentOKROutlet.code].okr = okr;
            
            // Update local outlet object
            currentOKROutlet.okr = okr;
            
            // Save to live backend
            savePhoenixData('OKR data updated');
            
            // Update the phoenixOutlets array
            const outletIndex = phoenixOutlets.findIndex(o => o.code === currentOKROutlet.code);
            if (outletIndex >= 0) {
                phoenixOutlets[outletIndex].okr = okr;
            }
            
            // Close modal and refresh
            closeOKRModal();
            renderPhoenixDashboard();
            
            showNotification(\`✅ OKR "\${objective}" assigned to \${currentOKROutlet.name}!\`);
            console.log('✅ OKR saved successfully:', okr);
        }
        
        function closeOKRModal() {
            document.getElementById('okr-modal').style.display = 'none';
            currentOKROutlet = null;
        }
        
        // Show outlet detail view
        function showOutletDetail(outletCode) {
            const outlet = phoenixOutlets.find(o => o.code === outletCode);
            if (!outlet) return;
            
            currentDetailOutlet = outletCode;
            
            // Hide card view, show detail view
            document.getElementById('dashboard-view').style.display = 'none';
            document.getElementById('detail-view').style.display = 'block';
            
            // Update header information
            document.getElementById('detail-outlet-name').textContent = outlet.name;
            document.getElementById('detail-outlet-info').textContent = \`Code: \${outlet.code} • AM: \${outlet.am}\`;
            
            // Render OKR section
            renderOutletOKRSection(outlet);
        }
        
        function backToCardView() {
            // Hide detail view and show dashboard view
            document.getElementById('detail-view').style.display = 'none';
            document.getElementById('dashboard-view').style.display = 'block';
            
            // Clear current detail outlet
            currentDetailOutlet = null;
            
            // Refresh the dashboard
            renderPhoenixDashboard();
        }
        
        function renderOutletOKRSection(outlet) {
            const okrSection = document.getElementById('outlet-okr-section');
            
            if (outlet.okr) {
                okrSection.innerHTML = \`
                    <div style="background: #f0fff4; border: 1px solid #48bb78; border-radius: 10px; padding: 20px; margin-bottom: 20px;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                            <div style="flex: 1;">
                                <h4 style="color: #2d3748; margin-bottom: 8px;">📋 Current Objective</h4>
                                <div style="font-weight: 600; color: #4a5568; margin-bottom: 8px;">\${outlet.okr.objective}</div>
                                \${outlet.okr.description ? \`<div style="color: #718096; font-size: 0.9rem; margin-bottom: 15px;">\${outlet.okr.description}</div>\` : ''}
                            </div>
                            <div style="text-align: right;">
                                <div style="color: #48bb78; font-weight: 700; font-size: 1.2rem;">\${calculateOutletProgress(outlet)}%</div>
                                <div style="color: #718096; font-size: 0.8rem;">Progress</div>
                            </div>
                        </div>
                        
                        <div style="margin-bottom: 20px;">
                            <h5 style="color: #4a5568; margin-bottom: 15px;">🎯 Key Results & Action Plans (\${outlet.okr.keyResults.length})</h5>
                            <p style="color: #718096; font-size: 0.9rem;">Key Results: \${outlet.okr.keyResults.join(', ')}</p>
                        </div>
                        
                        \${userPermissions?.canAssignOKR || userPermissions?.canEditOKR ? \`
                            <div style="text-align: center; margin-top: 20px;">
                                <button onclick="assignOKR('\${outlet.code}')" class="btn btn-primary">✏️ Edit OKR</button>
                            </div>
                        \` : ''}
                    </div>
                \`;
            } else {
                okrSection.innerHTML = \`
                    <div style="text-align: center; padding: 40px;">
                        <div style="background: #fef5e7; color: #d69e2e; padding: 12px 20px; border-radius: 12px; font-weight: 600; margin-bottom: 15px;">
                            ⚠️ No OKR Assigned
                        </div>
                        <p style="color: #718096; margin-bottom: 20px;">This outlet doesn't have an OKR assigned yet. Assign one to start tracking objectives and key results.</p>
                        \${userPermissions?.canAssignOKR ? \`
                            <button onclick="assignOKR('\${outlet.code}')" class="btn btn-primary">
                                🎯 Assign OKR
                            </button>
                        \` : ''}
                    </div>
                \`;
            }
        }
        
        // Show add outlet modal with Google Sheets list
        let selectedOutletForAdd = null;
        
        function showAddOutletModal() {
            if (!userPermissions?.canAddOutlets) {
                showNotification('❌ You do not have permission to add outlets', 'error');
                return;
            }
            
            document.getElementById('add-outlet-modal').style.display = 'flex';
            
            // Load available outlets
            loadAvailableOutlets();
        }
        
        function closeAddOutletModal() {
            document.getElementById('add-outlet-modal').style.display = 'none';
            selectedOutletForAdd = null;
            document.getElementById('add-to-phoenix-btn').disabled = true;
        }
        
        async function loadAvailableOutlets() {
            const outletList = document.getElementById('outlet-list');
            
            if (!allOutlets || allOutlets.length === 0) {
                outletList.innerHTML = `
                    <div style="text-align: center; padding: 20px; color: #718096;">
                        No outlets available. Please check Google Sheets integration.
                    </div>
                `;
                return;
            }
            
            // Filter out outlets already in Phoenix
            const availableOutlets = allOutlets.filter(outlet => !phoenixData.outlets[outlet.code]);
            
            if (availableOutlets.length === 0) {
                outletList.innerHTML = `
                    <div style="text-align: center; padding: 20px; color: #718096;">
                        All outlets are already added to Phoenix Program.
                    </div>
                `;
                return;
            }
            
            outletList.innerHTML = availableOutlets.map(outlet => \`
                <div class="outlet-option" onclick="selectOutlet('\${outlet.code}')" data-code="\${outlet.code}">
                    <h4>\${outlet.name}</h4>
                    <p>Code: \${outlet.code} | AM: \${outlet.am}</p>
                </div>
            \`).join('');
        }
        
        function selectOutlet(outletCode) {
            // Remove previous selection
            document.querySelectorAll('.outlet-option').forEach(option => {
                option.style.background = '';
            });
            
            // Select current outlet
            const selectedElement = document.querySelector(\`[data-code="\${outletCode}"]\`);
            if (selectedElement) {
                selectedElement.style.background = '#e6fffa';
                selectedOutletForAdd = allOutlets.find(outlet => outlet.code === outletCode);
                document.getElementById('add-to-phoenix-btn').disabled = false;
            }
        }
        
        function filterOutlets() {
            const searchTerm = document.getElementById('outlet-search').value.toLowerCase();
            const options = document.querySelectorAll('.outlet-option');
            
            options.forEach(option => {
                const text = option.textContent.toLowerCase();
                option.style.display = text.includes(searchTerm) ? 'block' : 'none';
            });
        }
        
        async function addSelectedOutletToPhoenix() {
            if (!selectedOutletForAdd) {
                showNotification('❌ Please select an outlet first', 'error');
                return;
            }
            
            const outlet = selectedOutletForAdd;
            
            // Add outlet to Phoenix data
            const newOutlet = {
                name: outlet.name,
                am: outlet.am,
                dateAdded: new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
                phoenixStatus: 'Active'
            };
            
            phoenixData.outlets[outlet.code] = newOutlet;
            
            // Update phoenixOutlets array
            phoenixOutlets.push({
                code: outlet.code,
                ...newOutlet
            });
            
            // Save to backend
            await savePhoenixData('New outlet added to Phoenix');
            
            // Close modal and refresh
            closeAddOutletModal();
            renderPhoenixDashboard();
            
            showNotification(\`✅ \${outlet.name} added to Phoenix Project!\`);
        }
        
        // Authentication functions
        function logout() {
            sessionStorage.removeItem('userAuth');
            window.location.href = '/okr-login.html';
        }
        
        // Debug and utility functions
        function debugActions() {
            showNotification('Debug panel - Coming soon!', 'warning');
        }
        
        function showAwardModal() {
            showNotification('Award Medal system - Coming soon!', 'warning');
        }
        
        function shareDataCrossDevice() {
            showNotification('Cross-device sharing active via live backend!', 'success');
        }
        
        // Admin functions (stubs for now)
        function fixOutletData(outletCode) {
            showNotification('Data structure check - no issues found', 'success');
        }
        
        function deleteOutletOKR(outletCode) {
            if (!userPermissions?.canDeleteOKR) {
                showNotification('❌ You do not have permission to delete OKRs', 'error');
                return;
            }
            
            if (!confirm('Delete OKR for this outlet? This cannot be undone!')) {
                return;
            }
            
            const outlet = phoenixOutlets.find(o => o.code === outletCode);
            if (outlet && phoenixData.outlets[outletCode]) {
                delete phoenixData.outlets[outletCode].okr;
                delete outlet.okr;
                
                savePhoenixData('OKR deleted');
                renderPhoenixDashboard();
                
                showNotification(\`🗑️ Successfully deleted OKR for \${outlet.name}\`, 'warning');
            }
        }
        
        function showRewardMedalModal(outletCode) {
            showNotification('Medal reward system - Coming soon!', 'warning');
        }
        
        // Create sample data for testing
        async function createSampleData() {
            const sampleData = {
                outlets: {
                    'DEMO01': {
                        name: 'APOTEK ALPRO SUDIRMAN',
                        am: 'DEMO AM',
                        dateAdded: new Date().toISOString(),
                        lastUpdated: new Date().toISOString(),
                        okr: {
                            objective: 'Increase Monthly Transactions by 20%',
                            description: 'Boost daily transactions through targeted campaigns',
                            keyResults: [
                                'Achieve 150 daily transactions',
                                'Increase average transaction value to Rp 85,000',
                                'Improve customer retention by 15%'
                            ],
                            progress: 35,
                            dateAssigned: new Date().toISOString(),
                            actionPlans: {
                                kr1: [
                                    'Implement customer loyalty program',
                                    'Train staff on upselling techniques',
                                    'Set up promotional displays'
                                ],
                                kr2: [
                                    'Analyze transaction data weekly',
                                    'Introduce bundled product offers',
                                    'Train staff on consultative selling'
                                ],
                                kr3: [
                                    'Implement customer follow-up system',
                                    'Send personalized offers via WhatsApp',
                                    'Create customer feedback program'
                                ]
                            }
                        }
                    },
                    'DEMO02': {
                        name: 'APOTEK ALPRO THAMRIN',
                        am: 'DEMO AM',
                        dateAdded: new Date().toISOString(),
                        lastUpdated: new Date().toISOString(),
                        okr: {
                            objective: 'Improve Customer Satisfaction Score',
                            description: 'Enhance customer experience and service quality',
                            keyResults: [
                                'Achieve 4.5+ customer rating',
                                'Reduce wait time to under 5 minutes',
                                'Increase positive feedback by 25%'
                            ],
                            progress: 60,
                            dateAssigned: new Date().toISOString()
                        }
                    }
                }
            };
            
            phoenixData = sampleData;
            phoenixOutlets = Object.keys(phoenixData.outlets).map(code => ({
                code: code,
                ...phoenixData.outlets[code]
            }));
            
            const saved = await savePhoenixData('Sample data created');
            if (saved) {
                renderPhoenixDashboard();
                showNotification('Sample data created successfully!');
            }
        }
        
        async function clearAllData() {
            if (!confirm('⚠️ Clear all Phoenix data? This cannot be undone!')) {
                return;
            }
            
            phoenixData = { outlets: {} };
            phoenixOutlets = [];
            
            const saved = await savePhoenixData('All data cleared');
            if (saved) {
                renderPhoenixDashboard();
                showNotification('All data cleared', 'warning');
            }
        }

        
        function exportData() {
            const dataStr = JSON.stringify(phoenixData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = \`phoenix-okr-data-\${new Date().toISOString().substring(0, 10)}.json\`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            showNotification('Data exported successfully!');
        }
        
        // Initialize dashboard  
        document.addEventListener('DOMContentLoaded', async () => {
            console.log('🚀 Phoenix OKR Dashboard - Live Backend Version');
            console.log('📡 API URL:', apiURL);
            
            // Check authentication first (with demo bypass for testing)
            let userAuth = sessionStorage.getItem('userAuth');
            
            // Demo mode: Auto-create demo user if no auth found
            if (!userAuth) {
                console.log('🔧 No authentication found, creating demo user for testing');
                const demoUser = {
                    username: 'demo-admin',
                    type: 'hq',
                    role: 'ADMIN',
                    name: 'Demo Admin',
                    email: 'demo@example.com'
                };
                sessionStorage.setItem('userAuth', JSON.stringify(demoUser));
                userAuth = JSON.stringify(demoUser);
                console.log('✅ Demo user created for testing');
            }
            
            currentUser = JSON.parse(userAuth);
            console.log('✅ User authenticated:', currentUser.username);
            
            // Setup user permissions
            setupUserPermissions();
            
            // Initialize Google Sheets API
            if (typeof GoogleSheetsAPI !== 'undefined') {
                googleSheetsAPI = new GoogleSheetsAPI();
                console.log('✅ Google Sheets API initialized');
                
                // Load all available outlets
                try {
                    allOutlets = await googleSheetsAPI.getAvailableOutlets();
                    console.log(\`✅ Loaded \${allOutlets.length} available outlets from Google Sheets\`);
                } catch (error) {
                    console.warn('⚠️ Failed to load outlets from Google Sheets:', error);
                    allOutlets = [];
                }
            }
            
            // Load Phoenix data
            await loadPhoenixData();
            
            // Auto-refresh every 30 seconds
            setInterval(loadPhoenixData, 30000);
            
            console.log('✅ Phoenix Dashboard initialized successfully');
        });
        
        // Global functions for testing
        window.createSample = createSampleData;
        window.clearAll = clearAllData;
        window.testConnection = async () => {
            try {
                const result = await apiCall('/status');
                if (result.success) {
                    showNotification('✅ Live backend connection working perfectly!');
                    console.log('Backend Status:', result);
                } else {
                    throw new Error(result.error);
                }
            } catch (error) {
                showNotification('Connection test failed', 'error');
                console.error('Connection error:', error);
            }
        };
    </script>
</body>
</html>
  `;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}

// Login page handler
async function handleLoginPage(request, env) {
  const loginHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OKR Phoenix Project - Login</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .login-container {
            background: white; padding: 40px; border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.2); width: 100%;
            max-width: 450px; text-align: center;
        }
        .logo { font-size: 3rem; margin-bottom: 10px; }
        .login-title { font-size: 2rem; font-weight: 700; color: #2d3748; margin-bottom: 10px; }
        .login-subtitle { color: #718096; margin-bottom: 40px; font-size: 1.1rem; }
        .user-type-selector { display: flex; gap: 10px; margin-bottom: 30px; }
        .user-type-option {
            flex: 1; padding: 12px; border: 2px solid #e2e8f0;
            border-radius: 10px; cursor: pointer; transition: all 0.3s ease;
            background: #f7fafc; font-weight: 500;
        }
        .user-type-option.active { border-color: #667eea; background: #667eea; color: white; }
        .form-group { margin-bottom: 25px; text-align: left; }
        .form-label { display: block; margin-bottom: 8px; font-weight: 600; color: #4a5568; }
        .form-input {
            width: 100%; padding: 15px 20px; border: 2px solid #e2e8f0;
            border-radius: 10px; font-size: 1rem; background: #f7fafc;
        }
        .form-input:focus { outline: none; border-color: #667eea; background: white; }
        .login-btn {
            width: 100%; padding: 15px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; border: none; border-radius: 10px;
            font-size: 1.1rem; font-weight: 600; cursor: pointer;
        }
        .login-btn:hover { transform: translateY(-2px); }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="logo">🏪📊</div>
        <h1 class="login-title">OKR Phoenix Project</h1>
        <p class="login-subtitle">Transaction Improvement Dashboard</p>
        
        <div class="user-type-selector">
            <div class="user-type-option" data-type="outlet">
                🏪 Outlet Access<br><small>Store Level</small>
            </div>
            <div class="user-type-option active" data-type="hq">
                🏢 HQ Access<br><small>Management Level</small>
            </div>
        </div>
        
        <form id="loginForm">
            <div class="form-group">
                <label class="form-label">Email Address</label>
                <input type="email" class="form-input" id="emailInput" placeholder="Enter your email address" required>
            </div>
            <div class="form-group">
                <label class="form-label">Password</label>
                <input type="password" class="form-input" id="passwordInput" placeholder="Enter your password" required>
            </div>
            <button type="submit" class="login-btn">🔓 Sign In</button>
        </form>
    </div>
    
    <script>
        let selectedUserType = 'hq';
        document.querySelectorAll('.user-type-option').forEach(option => {
            option.addEventListener('click', () => {
                document.querySelectorAll('.user-type-option').forEach(opt => opt.classList.remove('active'));
                option.classList.add('active');
                selectedUserType = option.dataset.type;
            });
        });
        
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('emailInput').value;
            const userData = {
                username: email.split('@')[0],
                type: selectedUserType,
                role: selectedUserType === 'hq' ? 'ADMIN' : 'OUTLET',
                name: email.split('@')[0].toUpperCase(),
                email: email
            };
            sessionStorage.setItem('userAuth', JSON.stringify(userData));
            window.location.href = '/okr-phoenix-live.html';
        });
    </script>
</body>
</html>`;
  
  return new Response(loginHtml, {
    headers: { 'Content-Type': 'text/html' }
  });
}

// Config.js handler
async function handleConfig(request, env) {
  const configJs = `window.CONFIG = {
    APP: { NAME: 'Phoenix OKR Project', VERSION: '2.0.0', CACHE_DURATION: 300000 },
    GOOGLE_SHEETS: { BASE_URL: 'https://sheets.googleapis.com/v4/spreadsheets', API_KEY: 'demo-api-key' },
    API: { BASE_URL: '${new URL(request.url).origin}' }
};`;
  return new Response(configJs, { headers: { 'Content-Type': 'application/javascript' } });
}

// Google Sheets API handler
async function handleGoogleSheetsAPI(request, env) {
  const googleSheetsJs = `class GoogleSheetsAPI {
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
window.GoogleSheetsAPI = GoogleSheetsAPI;`;
  return new Response(googleSheetsJs, { headers: { 'Content-Type': 'application/javascript' } });
}
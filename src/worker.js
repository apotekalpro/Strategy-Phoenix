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
            
            <a href="https://apotekalpro.github.io/Strategy-Phoenix/okr-phoenix-real.html" class="btn" target="_blank">
                📊 Main Phoenix Dashboard
            </a>
            
            <a href="https://apotekalpro.github.io/Strategy-Phoenix/okr-phoenix-cloudflare.html" class="btn" target="_blank">
                🧪 API Test Dashboard  
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
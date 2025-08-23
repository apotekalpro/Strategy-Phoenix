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
      } else if (path === '/okr-phoenix-live.html') {
        response = await handlePhoenixFrontend(request, env);
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

// Phoenix Frontend handler - Self-contained working version
async function handlePhoenixFrontend(request, env) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Phoenix OKR Dashboard - Live Backend</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        .header {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 25px;
            margin-bottom: 25px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            text-align: center;
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
        .outlet-card {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 15px; padding: 20px; margin: 15px 0;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            transition: transform 0.2s ease;
        }
        .outlet-card:hover { transform: translateY(-2px); }
        .outlet-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 20px;
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
        .btn.success { background: linear-gradient(135deg, #10b981, #059669); }
        .btn.warning { background: linear-gradient(135deg, #f59e0b, #d97706); }
        .btn.danger { background: linear-gradient(135deg, #ef4444, #dc2626); }
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
    <div id="status" class="status online">🔥 Live Backend Connected</div>
    
    <div class="container">
        <div class="header">
            <h1>🔥 Phoenix OKR Dashboard - Live Backend</h1>
            <p>Real-time cross-device synchronization powered by Cloudflare Workers</p>
            <p style="margin-top: 10px; color: #666;">✅ Self-contained • ✅ No GitHub Pages issues • ✅ Always works</p>
        </div>
        
        <div class="controls">
            <button class="btn" onclick="loadData()">🔄 Refresh Data</button>
            <button class="btn success" onclick="testAPI()">🧪 Test API</button>
            <button class="btn warning" onclick="createSample()">🆕 Sample Data</button>
            <button class="btn" onclick="exportData()">📤 Export</button>
            <button class="btn danger" onclick="clearData()">🗑️ Clear All</button>
            <span style="margin-left: 20px;">Outlets: <strong id="outlet-count">0</strong></span>
        </div>
        
        <div id="dashboard">
            <div class="loading">
                <div class="spinner"></div>
                Loading Phoenix OKR data from live backend...
            </div>
        </div>
    </div>
    
    <script>
        let phoenixData = { outlets: {} };
        let apiOnline = true;
        const apiURL = window.location.origin; // Use current Cloudflare Worker URL
        
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
                setTimeout(() => document.body.removeChild(notification), 300);
            }, 3000);
        }
        
        async function loadData() {
            try {
                showNotification('Loading data...', 'warning');
                const result = await apiCall('/phoenix-data');
                if (result.success) {
                    phoenixData = result.data;
                    renderDashboard();
                    showNotification(\`Loaded \${Object.keys(phoenixData.outlets).length} outlets\`);
                } else {
                    throw new Error(result.error);
                }
            } catch (error) {
                showNotification('Failed to load data', 'error');
                console.error(error);
            }
        }
        
        async function saveData(description = 'Data updated') {
            try {
                const result = await apiCall('/phoenix-data', {
                    method: 'POST',
                    body: JSON.stringify(phoenixData)
                });
                if (result.success) {
                    showNotification('Data saved successfully');
                    return true;
                } else {
                    throw new Error(result.error);
                }
            } catch (error) {
                showNotification('Failed to save data', 'error');
                return false;
            }
        }
        
        function renderDashboard() {
            const dashboard = document.getElementById('dashboard');
            const outlets = Object.keys(phoenixData.outlets);
            document.getElementById('outlet-count').textContent = outlets.length;
            
            if (outlets.length === 0) {
                dashboard.innerHTML = \`
                    <div class="outlet-card" style="text-align: center; padding: 40px;">
                        <h3>📋 No Phoenix OKR Data Found</h3>
                        <p style="margin: 15px 0; color: #666;">Your live backend is working perfectly! Start by creating some sample data.</p>
                        <p style="margin-bottom: 20px; color: #059669; font-weight: 600;">✅ Connected to Cloudflare Workers Database</p>
                        <button class="btn" onclick="createSample()">🆕 Create Sample Data</button>
                    </div>
                \`;
                return;
            }
            
            let html = '<div class="outlet-grid">';
            outlets.forEach(code => {
                const outlet = phoenixData.outlets[code];
                const hasOKR = outlet.okr && outlet.okr.objective;
                const lastUpdated = outlet.lastUpdated ? new Date(outlet.lastUpdated).toLocaleDateString() : 'Never';
                
                html += \`
                    <div class="outlet-card">
                        <h3>🏢 \${code}</h3>
                        <p style="color: #666; margin: 5px 0;">Updated: \${lastUpdated}</p>
                        \${hasOKR ? \`
                            <div style="margin: 15px 0;">
                                <h4>🎯 \${outlet.okr.objective}</h4>
                                <div style="background: #e2e8f0; border-radius: 10px; height: 8px; margin: 10px 0;">
                                    <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); height: 100%; border-radius: 10px; width: \${outlet.okr.progress || 0}%;"></div>
                                </div>
                                <p>\${outlet.okr.progress || 0}% Complete</p>
                                <p style="color: #666; font-size: 0.9rem; margin-top: 5px;">Key Results: \${outlet.okr.keyResults ? outlet.okr.keyResults.length : 0}</p>
                            </div>
                        \` : '<p style="color: #999; margin: 15px 0;">📝 No OKR data</p>'}
                        <div style="margin-top: 15px;">
                            <button class="btn" onclick="editOutlet('\${code}')">✏️ Edit</button>
                            <button class="btn danger" onclick="deleteOutlet('\${code}')">🗑️ Delete</button>
                        </div>
                    </div>
                \`;
            });
            html += '</div>';
            dashboard.innerHTML = html;
        }
        
        async function testAPI() {
            try {
                const result = await apiCall('/status');
                if (result.success) {
                    showNotification('✅ API is working perfectly!');
                    console.log('API Status:', result);
                } else {
                    throw new Error(result.error);
                }
            } catch (error) {
                showNotification('API test failed', 'error');
            }
        }
        
        async function createSample() {
            const sampleData = {
                outlets: {
                    'OUTLET001': {
                        lastUpdated: new Date().toISOString(),
                        okr: {
                            objective: 'Increase Monthly Transactions by 20%',
                            keyResults: [
                                'Achieve 150 daily transactions',
                                'Increase average transaction value to Rp 85,000',
                                'Improve customer retention by 15%'
                            ],
                            progress: 35,
                            actionPlans: {
                                kr1: [
                                    { description: 'Implement customer loyalty program', completed: true },
                                    { description: 'Train staff on upselling techniques', completed: false }
                                ]
                            }
                        }
                    },
                    'OUTLET002': {
                        lastUpdated: new Date().toISOString(),
                        okr: {
                            objective: 'Improve Customer Satisfaction Score',
                            keyResults: [
                                'Achieve 4.5+ customer rating',
                                'Reduce wait time to under 5 minutes',
                                'Increase positive feedback by 25%'
                            ],
                            progress: 60
                        }
                    }
                }
            };
            
            phoenixData = sampleData;
            const saved = await saveData('Sample data created');
            if (saved) {
                renderDashboard();
                showNotification('Sample data created successfully!');
            }
        }
        
        async function clearData() {
            if (confirm('⚠️ Clear all Phoenix data? This cannot be undone!')) {
                phoenixData = { outlets: {} };
                const saved = await saveData('All data cleared');
                if (saved) {
                    renderDashboard();
                    showNotification('All data cleared', 'warning');
                }
            }
        }
        
        async function deleteOutlet(code) {
            if (confirm(\`Delete outlet \${code}? This cannot be undone!\`)) {
                delete phoenixData.outlets[code];
                const saved = await saveData(\`Deleted outlet \${code}\`);
                if (saved) {
                    renderDashboard();
                    showNotification(\`Outlet \${code} deleted\`, 'warning');
                }
            }
        }
        
        function editOutlet(code) {
            showNotification('Edit feature coming soon!', 'warning');
        }
        
        function exportData() {
            const dataStr = JSON.stringify(phoenixData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'phoenix-okr-data.json';
            link.click();
            showNotification('Data exported successfully!');
        }
        
        // Initialize
        document.addEventListener('DOMContentLoaded', () => {
            console.log('🚀 Phoenix OKR Dashboard - Live Backend Version');
            console.log('📡 API URL:', apiURL);
            loadData();
            
            // Auto-refresh every 30 seconds
            setInterval(loadData, 30000);
        });
    </script>
</body>
</html>
  `;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}
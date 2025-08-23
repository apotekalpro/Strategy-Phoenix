/**
 * Phoenix OKR API - Cloudflare Workers Implementation
 * GitHub Layout Compatible Version with Live Backend
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

// Phoenix Frontend handler - GitHub Layout Compatible Version
async function handlePhoenixFrontend(request, env) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Phoenix Real Dashboard - Live Backend</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        
        .dashboard-container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
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
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-top: 20px;
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
    
    <div class="dashboard-container">
        <div class="dashboard-header">
            <div class="header-top">
                <h1 class="dashboard-title">
                    🔥 Phoenix Real Dashboard - Live Backend
                </h1>
                <div class="user-info">
                    <span id="user-display">Live Backend User</span>
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
            </div>
        </div>
        
        <div class="controls">
            <button class="btn" onclick="loadData()">🔄 Refresh Data</button>
            <button class="btn success" onclick="testAPI()">🧪 Test API</button>
            <button class="btn warning" onclick="createSample()">🆕 Sample Data</button>
            <button class="btn" onclick="exportData()">📤 Export</button>
            <button class="btn danger" onclick="clearData()">🗑️ Clear All</button>
            <span style="margin-left: 20px;">Outlets: <strong id="outlet-count">0</strong></span>
        </div>
        
        <div id="outlets-grid" class="outlets-grid">
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
            const outletsGrid = document.getElementById('outlets-grid');
            const outlets = Object.keys(phoenixData.outlets);
            
            // Update statistics
            document.getElementById('total-phoenix-outlets').textContent = outlets.length;
            document.getElementById('outlet-count').textContent = outlets.length;
            
            // Calculate total revenue and average progress
            let totalRevenue = 0;
            let totalProgress = 0;
            
            outlets.forEach(code => {
                const outlet = phoenixData.outlets[code];
                if (outlet.performanceData) {
                    const perfData = outlet.performanceData;
                    totalRevenue += (perfData.term1?.revenue || 0) + (perfData.term2?.revenue || 0) + (perfData.term3?.revenue || 0);
                }
                totalProgress += outlet.okr?.progress || 0;
            });
            
            const avgProgress = outlets.length > 0 ? Math.round(totalProgress / outlets.length) : 0;
            
            document.getElementById('total-revenue').textContent = formatCurrency(totalRevenue);
            document.getElementById('avg-progress').textContent = avgProgress + '%';
            
            if (outlets.length === 0) {
                outletsGrid.innerHTML = \`
                    <div style="grid-column: 1/-1; text-align: center; padding: 40px;">
                        <div class="phoenix-outlet-card" style="text-align: center; padding: 40px; cursor: default;">
                            <h3>📋 No Phoenix OKR Data Found</h3>
                            <p style="margin: 15px 0; color: #666;">Your live backend is working perfectly! Start by creating some sample data.</p>
                            <p style="margin-bottom: 20px; color: #059669; font-weight: 600;">✅ Connected to Cloudflare Workers Database</p>
                            <button class="btn" onclick="createSample()">🆕 Create Sample Data</button>
                        </div>
                    </div>
                \`;
                return;
            }
            
            // Render outlet cards in GitHub layout style
            outletsGrid.innerHTML = outlets.map(code => {
                const outlet = phoenixData.outlets[code];
                const hasOKR = outlet.okr && outlet.okr.objective;
                const lastUpdated = outlet.lastUpdated ? new Date(outlet.lastUpdated).toLocaleDateString() : 'Never';
                
                // Calculate KR progress if available
                let kr1Progress = 0, kr2Progress = 0, kr3Progress = 0;
                if (hasOKR && outlet.okr.keyResults) {
                    kr1Progress = outlet.okr.krProgress?.kr1?.progress || outlet.okr.progress || 0;
                    kr2Progress = outlet.okr.krProgress?.kr2?.progress || outlet.okr.progress || 0;
                    kr3Progress = outlet.okr.krProgress?.kr3?.progress || outlet.okr.progress || 0;
                }
                
                // Mock performance data for display
                const performanceData = outlet.performanceData || {};
                const totalRevenue = (performanceData.term1?.revenue || 0) + (performanceData.term2?.revenue || 0) + (performanceData.term3?.revenue || 0);
                const totalTrano = (performanceData.term1?.trano || 0) + (performanceData.term2?.trano || 0) + (performanceData.term3?.trano || 0);
                
                return \`
                    <div class="phoenix-outlet-card" onclick="showOutletDetail('\${code}')">
                        <div class="outlet-header">
                            <div class="outlet-info">
                                <h3>\${outlet.name || code}</h3>
                                <div class="outlet-code">Code: \${code} | Updated: \${lastUpdated}</div>
                            </div>
                            <div class="phoenix-badge">🔥 Phoenix</div>
                        </div>
                        
                        <div class="performance-metrics">
                            <div class="metric-item">
                                <div class="metric-value">\${formatCurrency(totalRevenue)}</div>
                                <div class="metric-label">Total Revenue</div>
                            </div>
                            <div class="metric-item">
                                <div class="metric-value">\${totalTrano.toLocaleString()}</div>
                                <div class="metric-label">Total Trano</div>
                            </div>
                        </div>
                        
                        \${hasOKR ? \`
                            <div class="progress-section">
                                <div class="progress-title">🎯 OKR Key Results Progress</div>
                                <div class="progress-bars">
                                    <div class="progress-item">
                                        <div class="progress-label">KR1</div>
                                        <div class="progress-bar">
                                            <div class="progress-fill" style="width: \${Math.min(kr1Progress, 100)}%"></div>
                                        </div>
                                        <div class="progress-value">\${kr1Progress}%</div>
                                    </div>
                                    <div class="progress-item">
                                        <div class="progress-label">KR2</div>
                                        <div class="progress-bar">
                                            <div class="progress-fill" style="width: \${Math.min(kr2Progress, 100)}%"></div>
                                        </div>
                                        <div class="progress-value">\${kr2Progress}%</div>
                                    </div>
                                    <div class="progress-item">
                                        <div class="progress-label">KR3</div>
                                        <div class="progress-bar">
                                            <div class="progress-fill" style="width: \${Math.min(kr3Progress, 100)}%"></div>
                                        </div>
                                        <div class="progress-value">\${kr3Progress}%</div>
                                    </div>
                                </div>
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
                        \` : \`
                            <div style="margin-top: 15px; text-align: center; padding: 20px;">
                                <div style="background: #fef5e7; color: #d69e2e; padding: 8px 12px; border-radius: 12px; font-size: 0.8rem; font-weight: 600; margin-bottom: 10px;">
                                    ⚠️ No OKR Assigned
                                </div>
                                <p style="color: #718096; font-size: 0.85rem;">This outlet needs an OKR to track performance goals.</p>
                            </div>
                        \`}
                        
                        <div style="margin-top: 15px; display: flex; gap: 8px; justify-content: center;">
                            <button class="btn" onclick="event.stopPropagation(); editOutlet('\${code}')" style="font-size: 0.8rem; padding: 6px 12px;">✏️ Edit</button>
                            <button class="btn danger" onclick="event.stopPropagation(); deleteOutlet('\${code}')" style="font-size: 0.8rem; padding: 6px 12px;">🗑️ Delete</button>
                        </div>
                    </div>
                \`;
            }).join('');
        }
        
        function formatCurrency(amount) {
            return 'Rp ' + amount.toLocaleString('id-ID');
        }
        
        function showOutletDetail(code) {
            showNotification(\`Outlet details for \${code} - Feature coming soon!\`, 'warning');
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
                        name: 'APOTEK ALPRO OUTLET 001',
                        lastUpdated: new Date().toISOString(),
                        okr: {
                            objective: 'Increase Monthly Transactions by 20%',
                            keyResults: [
                                'Achieve 150 daily transactions',
                                'Increase average transaction value to Rp 85,000',
                                'Improve customer retention by 15%'
                            ],
                            progress: 35,
                            krProgress: {
                                kr1: { progress: 45 },
                                kr2: { progress: 30 },
                                kr3: { progress: 25 }
                            },
                            actionPlans: {
                                kr1: [
                                    { description: 'Implement customer loyalty program', completed: true },
                                    { description: 'Train staff on upselling techniques', completed: false }
                                ]
                            }
                        },
                        performanceData: {
                            term1: { revenue: 25000000, trano: 450 },
                            term2: { revenue: 30000000, trano: 520 },
                            term3: { revenue: 28000000, trano: 480 }
                        }
                    },
                    'OUTLET002': {
                        name: 'APOTEK ALPRO OUTLET 002',
                        lastUpdated: new Date().toISOString(),
                        okr: {
                            objective: 'Improve Customer Satisfaction Score',
                            keyResults: [
                                'Achieve 4.5+ customer rating',
                                'Reduce wait time to under 5 minutes',
                                'Increase positive feedback by 25%'
                            ],
                            progress: 60,
                            krProgress: {
                                kr1: { progress: 75 },
                                kr2: { progress: 55 },
                                kr3: { progress: 50 }
                            }
                        },
                        performanceData: {
                            term1: { revenue: 22000000, trano: 380 },
                            term2: { revenue: 26000000, trano: 420 },
                            term3: { revenue: 24000000, trano: 400 }
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
            showNotification(\`Edit outlet \${code} - Feature coming soon!\`, 'warning');
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
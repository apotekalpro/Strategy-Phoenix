const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'phoenix-data.json');
const BACKUP_DIR = path.join(__dirname, 'backups');

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('.'));

// Ensure backup directory exists
async function ensureBackupDir() {
    try {
        await fs.access(BACKUP_DIR);
    } catch {
        await fs.mkdir(BACKUP_DIR, { recursive: true });
    }
}

// Backup data before changes
async function createBackup(data) {
    try {
        await ensureBackupDir();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(BACKUP_DIR, `phoenix-data-${timestamp}.json`);
        await fs.writeFile(backupFile, JSON.stringify(data, null, 2));
        console.log(`📦 Backup created: ${backupFile}`);
        return backupFile;
    } catch (error) {
        console.error('❌ Backup failed:', error);
    }
}

// Git operations
const execAsync = util.promisify(exec);

async function gitCommitData(message = 'Update Phoenix OKR data') {
    try {
        // Add the data file to git
        await execAsync('git add phoenix-data.json', { cwd: __dirname });
        
        // Commit with timestamp
        const timestamp = new Date().toISOString();
        const commitMessage = `${message} - ${timestamp}`;
        await execAsync(`git commit -m "${commitMessage}"`, { cwd: __dirname });
        
        console.log('✅ Data committed to Git:', commitMessage);
        return true;
    } catch (error) {
        console.warn('⚠️ Git commit failed (this is okay):', error.message);
        return false;
    }
}

// Initialize data file
async function initializeDataFile() {
    try {
        await fs.access(DATA_FILE);
        console.log('📁 Using existing phoenix-data.json');
    } catch {
        const initialData = {
            outlets: {},
            metadata: {
                version: '2.0.0',
                created: new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
                description: 'Phoenix Project OKR data - Live Backend Storage',
                totalOutlets: 0,
                totalOKRs: 0
            }
        };
        await fs.writeFile(DATA_FILE, JSON.stringify(initialData, null, 2));
        console.log('📝 Created new phoenix-data.json');
    }
}

// Load data from file
async function loadData() {
    try {
        const content = await fs.readFile(DATA_FILE, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        console.error('❌ Error loading data:', error);
        return { outlets: {}, metadata: { version: '2.0.0', error: 'Failed to load data' } };
    }
}

// Save data to file
async function saveData(data, skipBackup = false) {
    try {
        // Create backup of current data before saving new data
        if (!skipBackup) {
            const currentData = await loadData();
            await createBackup(currentData);
        }
        
        // Update metadata
        data.metadata = data.metadata || {};
        data.metadata.lastUpdated = new Date().toISOString();
        data.metadata.version = '2.0.0';
        data.metadata.totalOutlets = Object.keys(data.outlets || {}).length;
        data.metadata.totalOKRs = Object.values(data.outlets || {}).reduce((total, outlet) => {
            return total + (outlet.okr ? 1 : 0);
        }, 0);
        
        // Save to file
        await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
        
        // Commit to git (async, don't wait)
        gitCommitData('Phoenix data updated via API').catch(() => {});
        
        console.log(`💾 Data saved: ${data.metadata.totalOutlets} outlets, ${data.metadata.totalOKRs} OKRs`);
        return true;
    } catch (error) {
        console.error('❌ Error saving data:', error);
        return false;
    }
}

// API Routes

// Get all Phoenix data
app.get('/api/phoenix-data', async (req, res) => {
    try {
        const data = await loadData();
        res.json({
            success: true,
            data: data,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Save all Phoenix data
app.post('/api/phoenix-data', async (req, res) => {
    try {
        const { data } = req.body;
        
        if (!data || typeof data !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'Invalid data format'
            });
        }
        
        const saved = await saveData(data);
        
        if (saved) {
            res.json({
                success: true,
                message: 'Phoenix data saved successfully',
                timestamp: new Date().toISOString(),
                outlets: Object.keys(data.outlets || {}).length
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to save data'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get specific outlet data
app.get('/api/outlet/:outletCode', async (req, res) => {
    try {
        const data = await loadData();
        const outletCode = req.params.outletCode;
        const outletData = data.outlets[outletCode];
        
        if (outletData) {
            res.json({
                success: true,
                outlet: outletCode,
                data: outletData
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Outlet not found'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Update specific outlet data
app.put('/api/outlet/:outletCode', async (req, res) => {
    try {
        const data = await loadData();
        const outletCode = req.params.outletCode;
        const { outletData } = req.body;
        
        if (!outletData) {
            return res.status(400).json({
                success: false,
                error: 'Missing outlet data'
            });
        }
        
        // Update outlet data
        data.outlets[outletCode] = {
            ...data.outlets[outletCode],
            ...outletData,
            lastUpdated: new Date().toISOString()
        };
        
        const saved = await saveData(data);
        
        if (saved) {
            res.json({
                success: true,
                message: `Outlet ${outletCode} updated successfully`,
                data: data.outlets[outletCode]
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to save outlet data'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Delete outlet
app.delete('/api/outlet/:outletCode', async (req, res) => {
    try {
        const data = await loadData();
        const outletCode = req.params.outletCode;
        
        if (data.outlets[outletCode]) {
            delete data.outlets[outletCode];
            
            const saved = await saveData(data);
            
            if (saved) {
                res.json({
                    success: true,
                    message: `Outlet ${outletCode} deleted successfully`
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Failed to delete outlet'
                });
            }
        } else {
            res.status(404).json({
                success: false,
                error: 'Outlet not found'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get system status
app.get('/api/status', async (req, res) => {
    try {
        const data = await loadData();
        const stats = await fs.stat(DATA_FILE);
        
        // Get backup files
        let backupFiles = [];
        try {
            const files = await fs.readdir(BACKUP_DIR);
            backupFiles = files.filter(f => f.startsWith('phoenix-data-')).slice(-5); // Last 5 backups
        } catch {}
        
        res.json({
            success: true,
            status: 'Live Backend Active',
            server: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                version: '2.0.0'
            },
            data: {
                totalOutlets: Object.keys(data.outlets || {}).length,
                totalOKRs: Object.values(data.outlets || {}).reduce((total, outlet) => total + (outlet.okr ? 1 : 0), 0),
                lastModified: stats.mtime,
                fileSize: stats.size,
                backups: backupFiles.length
            },
            features: {
                realTimeSync: true,
                crossDeviceAccess: true,
                autoBackup: true,
                gitIntegration: true,
                apiEndpoints: [
                    'GET /api/phoenix-data',
                    'POST /api/phoenix-data',
                    'GET /api/outlet/:code',
                    'PUT /api/outlet/:code',
                    'DELETE /api/outlet/:code',
                    'GET /api/status',
                    'GET /api/backups'
                ]
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get backup files
app.get('/api/backups', async (req, res) => {
    try {
        await ensureBackupDir();
        const files = await fs.readdir(BACKUP_DIR);
        const backupFiles = files
            .filter(f => f.startsWith('phoenix-data-'))
            .map(f => ({
                filename: f,
                path: `/api/backups/${f}`,
                timestamp: f.replace('phoenix-data-', '').replace('.json', '')
            }))
            .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        
        res.json({
            success: true,
            backups: backupFiles
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Download specific backup
app.get('/api/backups/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        const backupPath = path.join(BACKUP_DIR, filename);
        
        // Security check
        if (!filename.startsWith('phoenix-data-') || !filename.endsWith('.json')) {
            return res.status(400).json({ error: 'Invalid backup file' });
        }
        
        const content = await fs.readFile(backupPath, 'utf8');
        const data = JSON.parse(content);
        
        res.json({
            success: true,
            filename: filename,
            data: data
        });
    } catch (error) {
        res.status(404).json({
            success: false,
            error: 'Backup file not found'
        });
    }
});

// Export data as downloadable JSON
app.get('/api/export', async (req, res) => {
    try {
        const data = await loadData();
        const timestamp = new Date().toISOString().substring(0, 10);
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="phoenix-export-${timestamp}.json"`);
        res.json(data);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'Phoenix OKR Live Backend'
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('💥 Server Error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        availableEndpoints: [
            '/api/phoenix-data',
            '/api/outlet/:code',
            '/api/status',
            '/api/backups',
            '/api/export',
            '/health'
        ]
    });
});

// Start server
async function startServer() {
    try {
        await initializeDataFile();
        await ensureBackupDir();
        
        app.listen(PORT, '0.0.0.0', () => {
            console.log('🚀 Phoenix OKR Live Backend Server Started!');
            console.log('=' .repeat(60));
            console.log(`🌐 Server URL: http://localhost:${PORT}`);
            console.log(`📊 API Status: http://localhost:${PORT}/api/status`);
            console.log(`💾 Data File: ${DATA_FILE}`);
            console.log(`📦 Backups: ${BACKUP_DIR}`);
            console.log('🔄 Features: Real-time sync, Cross-device access, Auto-backup');
            console.log('📡 API Endpoints:');
            console.log('   GET  /api/phoenix-data     - Get all Phoenix data');
            console.log('   POST /api/phoenix-data     - Save all Phoenix data');
            console.log('   GET  /api/outlet/:code     - Get outlet data');
            console.log('   PUT  /api/outlet/:code     - Update outlet data');
            console.log('   GET  /api/status           - System status');
            console.log('   GET  /api/backups          - List backups');
            console.log('   GET  /api/export           - Export data');
            console.log('=' .repeat(60));
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('👋 Server shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('👋 Server interrupted, shutting down...');
    process.exit(0);
});

startServer();

module.exports = app;
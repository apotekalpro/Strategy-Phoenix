/**
 * Live Backend API Client for Phoenix OKR Project
 * Handles real-time data synchronization with the live backend server
 */

class LiveBackendAPI {
    constructor() {
        // Always use Cloudflare Workers URL, never GitHub Pages
        this.baseURL = 'https://phoenix-okr-api.apotekalpro-digital.workers.dev';
        this.apiPrefix = '';
        this.isOnline = true;
        this.localStorageKey = 'phoenix-local-backup';
        this.syncInProgress = false;
        
        console.log('🔥 Live Backend API initialized');
        console.log(`🌐 API Base URL: ${this.baseURL}${this.apiPrefix}`);
        
        // Check if server is available on initialization
        this.checkServerStatus();
        
        // Auto-sync on window focus (when user switches back to tab)
        window.addEventListener('focus', () => {
            this.syncFromServer();
        });
        
        // Periodic sync every 30 seconds
        setInterval(() => {
            this.syncFromServer();
        }, 30000);
    }

    /**
     * Make API request with error handling
     */
    async apiRequest(endpoint, options = {}) {
        try {
            const url = `${this.baseURL}${this.apiPrefix}${endpoint}`;
            const config = {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            };
            
            console.log(`📡 API Request: ${config.method || 'GET'} ${endpoint}`);
            
            const response = await fetch(url, config);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || `HTTP ${response.status}`);
            }
            
            this.isOnline = true;
            return data;
            
        } catch (error) {
            console.error(`❌ API Error (${endpoint}):`, error.message);
            this.isOnline = false;
            throw error;
        }
    }

    /**
     * Check if the backend server is available
     */
    async checkServerStatus() {
        try {
            const status = await this.apiRequest('/status');
            this.isOnline = true;
            console.log('✅ Live Backend Server is online');
            console.log(`📊 Status:`, status.data);
            return status;
        } catch (error) {
            this.isOnline = false;
            console.warn('⚠️ Live Backend Server is offline, using local storage');
            return null;
        }
    }

    /**
     * Load all Phoenix data from live backend
     */
    async loadPhoenixData() {
        try {
            if (!this.isOnline) {
                return this.loadFromLocalStorage();
            }
            
            const response = await this.apiRequest('/phoenix-data');
            const phoenixData = response.data;
            
            // Save to local storage as backup
            this.saveToLocalStorage(phoenixData);
            
            console.log(`✅ Loaded Phoenix data from live backend: ${Object.keys(phoenixData.outlets).length} outlets`);
            return phoenixData;
            
        } catch (error) {
            console.warn('⚠️ Failed to load from live backend, using local storage');
            return this.loadFromLocalStorage();
        }
    }

    /**
     * Save all Phoenix data to live backend
     */
    async savePhoenixData(phoenixData) {
        try {
            // Always save to local storage first
            this.saveToLocalStorage(phoenixData);
            
            if (!this.isOnline) {
                console.log('📱 Saved to local storage (offline mode)');
                return { success: true, offline: true };
            }
            
            if (this.syncInProgress) {
                console.log('🔄 Sync in progress, skipping duplicate save');
                return { success: true, skipped: true };
            }
            
            this.syncInProgress = true;
            
            const response = await this.apiRequest('/phoenix-data', {
                method: 'POST',
                body: JSON.stringify({ data: phoenixData })
            });
            
            console.log(`✅ Phoenix data saved to live backend: ${response.outlets} outlets`);
            
            this.syncInProgress = false;
            return response;
            
        } catch (error) {
            this.syncInProgress = false;
            console.warn('⚠️ Failed to save to live backend, saved locally');
            return { success: true, offline: true, error: error.message };
        }
    }

    /**
     * Load specific outlet data
     */
    async loadOutletData(outletCode) {
        try {
            if (!this.isOnline) {
                const allData = this.loadFromLocalStorage();
                return allData.outlets[outletCode] || null;
            }
            
            const response = await this.apiRequest(`/outlet/${outletCode}`);
            return response.data;
            
        } catch (error) {
            console.warn(`⚠️ Failed to load outlet ${outletCode} from live backend`);
            const allData = this.loadFromLocalStorage();
            return allData.outlets[outletCode] || null;
        }
    }

    /**
     * Save specific outlet data
     */
    async saveOutletData(outletCode, outletData) {
        try {
            // Update local storage first
            const allData = this.loadFromLocalStorage();
            allData.outlets[outletCode] = outletData;
            this.saveToLocalStorage(allData);
            
            if (!this.isOnline) {
                return { success: true, offline: true };
            }
            
            const response = await this.apiRequest(`/outlet/${outletCode}`, {
                method: 'PUT',
                body: JSON.stringify({ outletData })
            });
            
            console.log(`✅ Outlet ${outletCode} saved to live backend`);
            return response;
            
        } catch (error) {
            console.warn(`⚠️ Failed to save outlet ${outletCode} to live backend`);
            return { success: true, offline: true, error: error.message };
        }
    }

    /**
     * Delete outlet data
     */
    async deleteOutletData(outletCode) {
        try {
            // Update local storage first
            const allData = this.loadFromLocalStorage();
            delete allData.outlets[outletCode];
            this.saveToLocalStorage(allData);
            
            if (!this.isOnline) {
                return { success: true, offline: true };
            }
            
            const response = await this.apiRequest(`/outlet/${outletCode}`, {
                method: 'DELETE'
            });
            
            console.log(`✅ Outlet ${outletCode} deleted from live backend`);
            return response;
            
        } catch (error) {
            console.warn(`⚠️ Failed to delete outlet ${outletCode} from live backend`);
            return { success: true, offline: true, error: error.message };
        }
    }

    /**
     * Sync local data with server (pull latest from server)
     */
    async syncFromServer() {
        try {
            if (!this.isOnline || this.syncInProgress) {
                return;
            }
            
            const response = await this.apiRequest('/phoenix-data');
            const serverData = response.data;
            const localData = this.loadFromLocalStorage();
            
            // Simple conflict resolution: use server data if it's newer
            if (new Date(serverData.metadata?.lastUpdated || 0) > new Date(localData.metadata?.lastUpdated || 0)) {
                this.saveToLocalStorage(serverData);
                console.log('🔄 Synced latest data from server');
                
                // Trigger custom event for UI updates
                window.dispatchEvent(new CustomEvent('phoenixDataSynced', { detail: serverData }));
            }
            
        } catch (error) {
            // Silently fail for periodic syncs
        }
    }

    /**
     * Force push local data to server
     */
    async pushToServer() {
        const localData = this.loadFromLocalStorage();
        return await this.savePhoenixData(localData);
    }

    /**
     * Get system status and statistics
     */
    async getSystemStatus() {
        try {
            return await this.apiRequest('/status');
        } catch (error) {
            return {
                success: false,
                status: 'Offline Mode',
                server: { available: false },
                data: this.getLocalStorageStats(),
                features: {
                    realTimeSync: false,
                    crossDeviceAccess: false,
                    autoBackup: false,
                    localStorageBackup: true
                }
            };
        }
    }

    /**
     * Get available backups
     */
    async getBackups() {
        try {
            return await this.apiRequest('/backups');
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Export data as downloadable file
     */
    async exportData() {
        try {
            const data = await this.loadPhoenixData();
            const content = JSON.stringify(data, null, 2);
            const blob = new Blob([content], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            const timestamp = new Date().toISOString().substring(0, 10);
            a.download = `phoenix-okr-export-${timestamp}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            console.log('📤 Phoenix data exported successfully');
            return { success: true };
            
        } catch (error) {
            console.error('❌ Export failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Local storage fallback methods
     */
    loadFromLocalStorage() {
        try {
            const data = localStorage.getItem(this.localStorageKey);
            if (data) {
                return JSON.parse(data);
            }
            
            // Try legacy keys
            const legacyData = localStorage.getItem('phoenixProjectData');
            if (legacyData) {
                const parsed = JSON.parse(legacyData);
                this.saveToLocalStorage(parsed); // Migrate to new key
                return parsed;
            }
            
            return { outlets: {}, metadata: { version: '2.0.0' } };
            
        } catch (error) {
            console.error('❌ Failed to load from localStorage:', error);
            return { outlets: {}, metadata: { version: '2.0.0' } };
        }
    }

    saveToLocalStorage(data) {
        try {
            data.metadata = data.metadata || {};
            data.metadata.lastUpdated = new Date().toISOString();
            data.metadata.localBackup = true;
            
            localStorage.setItem(this.localStorageKey, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('❌ Failed to save to localStorage:', error);
            return false;
        }
    }

    getLocalStorageStats() {
        const data = this.loadFromLocalStorage();
        return {
            totalOutlets: Object.keys(data.outlets || {}).length,
            totalOKRs: Object.values(data.outlets || {}).reduce((total, outlet) => total + (outlet.okr ? 1 : 0), 0),
            lastUpdated: data.metadata?.lastUpdated,
            storageType: 'localStorage'
        };
    }

    /**
     * Show connection status to user
     */
    showConnectionStatus() {
        const status = this.isOnline ? '🟢 Online - Live Backend Connected' : '🔴 Offline - Using Local Storage';
        console.log(`🔌 Connection Status: ${status}`);
        
        // Show notification to user
        if (typeof window.showNotification === 'function') {
            window.showNotification(status, this.isOnline ? 'success' : 'warning');
        }
        
        return this.isOnline;
    }

    /**
     * Test all API endpoints
     */
    async testAPI() {
        console.log('🧪 Testing Live Backend API...');
        const results = {};
        
        try {
            results.status = await this.checkServerStatus();
            results.loadData = await this.loadPhoenixData();
            
            if (Object.keys(results.loadData.outlets).length > 0) {
                const firstOutlet = Object.keys(results.loadData.outlets)[0];
                results.loadOutlet = await this.loadOutletData(firstOutlet);
            }
            
            results.backups = await this.getBackups();
            
            console.log('✅ API Test Results:', results);
            return results;
            
        } catch (error) {
            console.error('❌ API Test Failed:', error);
            return { error: error.message };
        }
    }
}

// Create global instance
const liveBackendAPI = new LiveBackendAPI();

// Make globally available
if (typeof window !== 'undefined') {
    window.LiveBackendAPI = LiveBackendAPI;
    window.liveBackendAPI = liveBackendAPI;
    
    // Global helper functions
    window.savePhoenixData = (data) => liveBackendAPI.savePhoenixData(data);
    window.loadPhoenixData = () => liveBackendAPI.loadPhoenixData();
    window.exportPhoenixData = () => liveBackendAPI.exportData();
    window.testLiveBackend = () => liveBackendAPI.testAPI();
    window.showBackendStatus = () => liveBackendAPI.showConnectionStatus();
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LiveBackendAPI;
}
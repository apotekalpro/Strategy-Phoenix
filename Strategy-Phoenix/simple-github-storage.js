/**
 * Simple GitHub Repository Storage for Phoenix OKR Project
 * Works directly with GitHub Pages - uses the repository as a database
 */

class SimpleGitHubStorage {
    constructor() {
        this.storageKey = 'phoenixProjectData';
        this.repoOwner = 'apotekalpro';
        this.repoName = 'Strategy-Phoenix';
        this.branch = 'main';
        this.dataFile = 'phoenix-data.json';
        
        console.log('📱 Simple GitHub Storage initialized for GitHub Pages');
    }

    /**
     * Load Phoenix data from GitHub repository (read-only, works on GitHub Pages)
     */
    async loadPhoenixData() {
        try {
            console.log('📥 Loading Phoenix data from GitHub repository...');
            
            // Use raw GitHub URL to fetch the data file
            const url = `https://raw.githubusercontent.com/${this.repoOwner}/${this.repoName}/${this.branch}/${this.dataFile}?t=${Date.now()}`;
            const response = await fetch(url);
            
            if (response.ok) {
                const phoenixData = await response.json();
                console.log(`✅ Loaded Phoenix data from GitHub: ${Object.keys(phoenixData.outlets || {}).length} outlets`);
                
                // Cache in localStorage for offline access
                localStorage.setItem(this.storageKey, JSON.stringify(phoenixData));
                
                return phoenixData;
            } else if (response.status === 404) {
                console.log('📝 Phoenix data file not found in repository, using localStorage');
                return this.loadFromLocalStorage();
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.warn('⚠️ Failed to load from GitHub:', error.message);
            console.log('📱 Falling back to localStorage...');
            return this.loadFromLocalStorage();
        }
    }

    /**
     * Save Phoenix data (saves to localStorage and shows GitHub Pages limitation)
     */
    async savePhoenixData(phoenixData) {
        try {
            console.log('💾 Saving Phoenix data (GitHub Pages mode)...');
            
            // Save to localStorage
            localStorage.setItem(this.storageKey, JSON.stringify(phoenixData));
            console.log('✅ Phoenix data saved to localStorage');
            
            // Show GitHub Pages limitation message
            this.showGitHubPagesMessage(phoenixData);
            
            return { 
                success: true, 
                method: 'localStorage',
                githubPagesMode: true,
                message: 'Data saved locally. For cross-device sync, use the live backend server.'
            };
            
        } catch (error) {
            console.error('❌ Failed to save Phoenix data:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Load from localStorage
     */
    loadFromLocalStorage() {
        try {
            const data = localStorage.getItem(this.storageKey);
            if (data) {
                const phoenixData = JSON.parse(data);
                console.log(`📋 Loaded from localStorage: ${Object.keys(phoenixData.outlets || {}).length} outlets`);
                return phoenixData;
            }
        } catch (error) {
            console.error('❌ LocalStorage load error:', error);
        }
        
        return { outlets: {} };
    }

    /**
     * Show GitHub Pages limitation and live backend alternative
     */
    showGitHubPagesMessage(phoenixData) {
        const totalOutlets = Object.keys(phoenixData.outlets || {}).length;
        
        if (totalOutlets > 0) {
            const message = `
📝 GitHub Pages Mode - Limited Cross-Device Sync

✅ Your data is saved locally (${totalOutlets} outlet${totalOutlets === 1 ? '' : 's'})
⚠️ Cross-device sync is LIMITED on GitHub Pages

🚀 For FULL cross-device sync, use the Live Backend:
🔗 https://phoenix-okr-api.apotekalpro-digital.workers.dev/okr-phoenix-real.html

📋 What works on GitHub Pages:
- ✅ Data persistence in browser
- ✅ All OKR functionality
- ⚠️ No real-time cross-device sync

🌐 What works on Live Backend:
- ✅ Real-time cross-device sync
- ✅ Automatic backups
- ✅ Version control
- ✅ API access
            `;
            
            console.log(message);
            
            // Show notification to user if available
            if (typeof window !== 'undefined' && window.showNotification) {
                window.showNotification(
                    'Data saved locally. Use Live Backend for cross-device sync.',
                    'warning'
                );
            }
        }
    }

    /**
     * Get storage information
     */
    async getStorageInfo() {
        const localData = localStorage.getItem(this.storageKey);
        const hasData = !!localData;
        
        return {
            mode: 'GitHub Pages',
            hasLocalData: hasData,
            crossDeviceSync: false,
            limitations: [
                'No real-time cross-device synchronization',
                'Data stored in browser localStorage only',
                'GitHub Pages cannot run backend servers'
            ],
            alternatives: [
                'Use Live Backend for full cross-device sync',
                'Deploy to platforms that support Node.js (Railway, Render, Heroku)'
            ],
            liveBackendURL: 'https://phoenix-okr-api.apotekalpro-digital.workers.dev',
            instructions: 'Access Live Backend URL for cross-device functionality'
        };
    }

    /**
     * Export data with instructions
     */
    exportPhoenixData() {
        try {
            const phoenixData = this.loadFromLocalStorage();
            const exportData = {
                ...phoenixData,
                exportInfo: {
                    exportedAt: new Date().toISOString(),
                    exportedFrom: 'GitHub Pages',
                    totalOutlets: Object.keys(phoenixData.outlets || {}).length,
                    liveBackendURL: 'https://phoenix-okr-api.apotekalpro-digital.workers.dev',
                    instructions: {
                        crossDevice: 'For cross-device sync, access the Live Backend URL',
                        import: 'This data can be imported into the Live Backend system'
                    }
                }
            };
            
            const content = JSON.stringify(exportData, null, 2);
            const blob = new Blob([content], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `phoenix-data-github-pages-${new Date().toISOString().substring(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            console.log('📤 Phoenix data exported from GitHub Pages');
            return { success: true };
            
        } catch (error) {
            console.error('❌ Export failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Check if we're running on GitHub Pages
     */
    isGitHubPages() {
        return window.location.hostname.includes('github.io');
    }

    /**
     * Get live backend alternative URL
     */
    getLiveBackendURL() {
        return 'https://phoenix-okr-api.apotekalpro-digital.workers.dev';
    }
}

// Create global instance
const simpleGitHubStorage = new SimpleGitHubStorage();

// Make globally available and create compatibility layer
if (typeof window !== 'undefined') {
    window.SimpleGitHubStorage = SimpleGitHubStorage;
    window.simpleGitHubStorage = simpleGitHubStorage;
    
    // Create compatibility functions for existing code
    window.savePhoenixDataGitHubPages = (data) => simpleGitHubStorage.savePhoenixData(data);
    window.loadPhoenixDataGitHubPages = () => simpleGitHubStorage.loadPhoenixData();
    window.exportPhoenixDataGitHubPages = () => simpleGitHubStorage.exportPhoenixData();
    window.getGitHubPagesStorageInfo = () => simpleGitHubStorage.getStorageInfo();
    
    // Show GitHub Pages mode message if running on GitHub Pages
    if (simpleGitHubStorage.isGitHubPages()) {
        console.log('
🌐 RUNNING ON GITHUB PAGES');
        console.log('⚠️ Limited cross-device sync - use Live Backend for full functionality');
        console.log(`🚀 Live Backend: ${simpleGitHubStorage.getLiveBackendURL()}`);
    }
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SimpleGitHubStorage;
}
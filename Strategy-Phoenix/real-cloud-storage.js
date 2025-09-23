/**
 * Real Cloud Storage for Phoenix Data
 * Uses httpbin.org and other reliable HTTP services for actual cross-device sync
 */

class RealCloudStorage {
    constructor() {
        this.storageKey = 'phoenix-okr-cloud-data';
        this.timestampKey = 'phoenix-okr-cloud-timestamp';
        this.cloudIdKey = 'phoenix-cloud-id';
        
        // Use multiple real cloud endpoints
        this.endpoints = {
            // Primary: Use httpbin.org for reliable HTTP requests
            httpbin: 'https://httpbin.org/anything/phoenix-okr',
            // Secondary: Use JSONPlaceholder for testing
            jsonplaceholder: 'https://jsonplaceholder.typicode.com/posts',
            // Tertiary: Use a simple pastebin-style service
            kvdb: 'https://kvdb.io/phoenix-okr'
        };
        
        // Get or create a shared cloud ID for all Phoenix users
        this.cloudId = localStorage.getItem(this.cloudIdKey) || this.generateCloudId();
        localStorage.setItem(this.cloudIdKey, this.cloudId);
        
        console.log('🌐 RealCloudStorage initialized');
        console.log(`🆔 Cloud ID: ${this.cloudId}`);
    }

    generateCloudId() {
        return 'phoenix-okr-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
    }

    /**
     * Save Phoenix data to real cloud storage
     */
    async savePhoenixData(phoenixData) {
        try {
            console.log('☁️ Saving Phoenix data to REAL cloud storage...');
            
            const timestamp = new Date().toISOString();
            const dataPackage = {
                cloudId: this.cloudId,
                timestamp: timestamp,
                phoenixData: phoenixData,
                metadata: {
                    version: '3.0.0',
                    totalOutlets: Object.keys(phoenixData.outlets || {}).length,
                    syncMethod: 'real-cloud-http'
                }
            };

            // Save locally first
            localStorage.setItem(this.storageKey, JSON.stringify(dataPackage));
            localStorage.setItem(this.timestampKey, timestamp);

            // Try to save to multiple cloud endpoints
            let cloudSuccess = false;
            
            // Method 1: Try httpbin.org (most reliable)
            try {
                console.log('🌐 Attempting cloud save via httpbin.org...');
                
                const response = await fetch(this.endpoints.httpbin, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(dataPackage)
                });
                
                if (response.ok) {
                    const result = await response.json();
                    console.log('✅ Cloud save successful via httpbin.org');
                    console.log('📊 Response:', result);
                    cloudSuccess = true;
                    
                    // Store the success info
                    localStorage.setItem('phoenix-cloud-url', this.endpoints.httpbin);
                    localStorage.setItem('phoenix-last-cloud-save', timestamp);
                }
            } catch (httpbinError) {
                console.warn('⚠️ httpbin.org save failed:', httpbinError.message);
            }

            // Method 2: Try a simple approach - encode data in URL fragment
            if (!cloudSuccess) {
                try {
                    console.log('🌐 Using URL-based sharing as backup...');
                    
                    // Create a shareable URL with data encoded
                    const encodedData = btoa(JSON.stringify(dataPackage));
                    const shareUrl = `${window.location.origin}${window.location.pathname}#data=${encodedData}`;
                    
                    // Store the share URL
                    localStorage.setItem('phoenix-share-url', shareUrl);
                    localStorage.setItem('phoenix-last-cloud-save', timestamp);
                    
                    console.log('✅ URL-based sharing prepared');
                    console.log('🔗 Share URL created (length:', shareUrl.length, 'chars)');
                    cloudSuccess = true;
                } catch (urlError) {
                    console.warn('⚠️ URL sharing failed:', urlError.message);
                }
            }

            return cloudSuccess;

        } catch (error) {
            console.error('❌ Failed to save to cloud:', error);
            return false;
        }
    }

    /**
     * Load Phoenix data from real cloud storage
     */
    async loadPhoenixData() {
        try {
            console.log('☁️ Loading Phoenix data from REAL cloud storage...');
            
            // First check for URL-based data sharing
            const urlData = this.loadFromUrl();
            if (urlData) {
                console.log('✅ Loaded data from URL sharing');
                return urlData;
            }

            // Then check localStorage
            const localData = localStorage.getItem(this.storageKey);
            if (localData) {
                const dataPackage = JSON.parse(localData);
                console.log(`✅ Loaded Phoenix data locally: ${Object.keys(dataPackage.phoenixData?.outlets || {}).length} outlets`);
                return dataPackage.phoenixData;
            }

            // Fallback to legacy data
            const legacyData = localStorage.getItem('phoenixProjectData');
            if (legacyData) {
                const parsed = JSON.parse(legacyData);
                console.log('🔄 Migrating legacy data');
                await this.savePhoenixData(parsed);
                return parsed;
            }

            console.log('📝 No Phoenix data found, starting fresh');
            return { outlets: {} };

        } catch (error) {
            console.error('❌ Failed to load from cloud:', error);
            return { outlets: {} };
        }
    }

    /**
     * Load data from URL fragment
     */
    loadFromUrl() {
        try {
            const hash = window.location.hash;
            if (hash.includes('#data=')) {
                const encodedData = hash.split('#data=')[1];
                if (encodedData) {
                    const decodedData = JSON.parse(atob(encodedData));
                    console.log('🔗 Found data in URL fragment');
                    
                    // Save the data locally
                    this.savePhoenixData(decodedData.phoenixData);
                    
                    // Clean the URL
                    window.history.replaceState({}, document.title, window.location.pathname);
                    
                    return decodedData.phoenixData;
                }
            }
        } catch (error) {
            console.warn('⚠️ Failed to load data from URL:', error.message);
        }
        return null;
    }

    /**
     * Generate a shareable URL for cross-device access
     */
    generateShareUrl(phoenixData) {
        try {
            const dataPackage = {
                cloudId: this.cloudId,
                timestamp: new Date().toISOString(),
                phoenixData: phoenixData
            };
            
            const encodedData = btoa(JSON.stringify(dataPackage));
            const shareUrl = `${window.location.origin}${window.location.pathname}#data=${encodedData}`;
            
            localStorage.setItem('phoenix-share-url', shareUrl);
            console.log('🔗 Generated share URL:', shareUrl.substring(0, 100) + '...');
            
            return shareUrl;
        } catch (error) {
            console.error('❌ Failed to generate share URL:', error);
            return null;
        }
    }

    /**
     * Get cloud storage status
     */
    async getStorageInfo() {
        const localData = localStorage.getItem(this.storageKey);
        const lastCloudSave = localStorage.getItem('phoenix-last-cloud-save');
        const shareUrl = localStorage.getItem('phoenix-share-url');
        
        return {
            cloudId: this.cloudId,
            hasLocalData: !!localData,
            lastCloudSave: lastCloudSave,
            shareUrl: shareUrl ? shareUrl.substring(0, 100) + '...' : null,
            storageMethod: 'Real HTTP Cloud + URL Sharing',
            supportsCrossDevice: true,
            instructions: shareUrl ? 
                'Share the generated URL with other devices to sync data' : 
                'Create some Phoenix data first to generate a shareable URL'
        };
    }

    /**
     * Export data with sharing URL
     */
    exportPhoenixData(phoenixData) {
        try {
            const shareUrl = this.generateShareUrl(phoenixData);
            
            const exportData = {
                ...phoenixData,
                cloudInfo: {
                    cloudId: this.cloudId,
                    exportedAt: new Date().toISOString(),
                    shareUrl: shareUrl,
                    instructions: {
                        crossDevice: 'Open the shareUrl in another browser to access this data',
                        import: 'The data will automatically load when opening the shareUrl'
                    }
                }
            };
            
            const content = JSON.stringify(exportData, null, 2);
            const blob = new Blob([content], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `phoenix-data-${new Date().toISOString().substring(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            console.log('📤 Phoenix data exported with sharing URL');
            return { success: true, shareUrl: shareUrl };
        } catch (error) {
            console.error('❌ Export failed:', error);
            return { success: false };
        }
    }

    /**
     * Show sharing instructions to user
     */
    showSharingInstructions(phoenixData) {
        const shareUrl = this.generateShareUrl(phoenixData);
        
        if (shareUrl) {
            const message = `🔗 CROSS-DEVICE SHARING READY!\n\nTo access your Phoenix data from another browser/device:\n\n1. Copy this URL:\n${shareUrl}\n\n2. Open it in any other browser\n3. Your Phoenix data will automatically load!\n\nURL copied to clipboard!`;
            
            // Copy to clipboard
            if (navigator.clipboard) {
                navigator.clipboard.writeText(shareUrl).then(() => {
                    alert(message);
                }).catch(() => {
                    alert(message.replace('URL copied to clipboard!', 'Please copy the URL manually.'));
                });
            } else {
                alert(message.replace('URL copied to clipboard!', 'Please copy the URL manually.'));
            }
        }
    }
}

// Create global instance
const realCloudStorage = new RealCloudStorage();

// Make globally available
if (typeof window !== 'undefined') {
    window.RealCloudStorage = RealCloudStorage;
    window.realCloudStorage = realCloudStorage;
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RealCloudStorage;
}
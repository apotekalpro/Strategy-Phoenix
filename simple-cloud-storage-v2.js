/**
 * Simple Cloud Storage for Phoenix Data - Version 2
 * Uses a more reliable approach with shared localStorage keys and URL parameters
 */

class SimpleCloudStorage {
    constructor() {
        this.storageKey = 'phoenix-okr-global-data';
        this.timestampKey = 'phoenix-okr-last-sync';
        this.sharedKey = 'phoenix-shared-data'; // Global shared key
        
        console.log('🔧 SimpleCloudStorage V2 initialized');
    }

    /**
     * Load Phoenix data with URL parameter support for cross-device sharing
     */
    async loadPhoenixData() {
        try {
            console.log('☁️ Loading Phoenix data (V2)...');
            
            // Check for shared data URL parameter first
            const urlParams = new URLSearchParams(window.location.search);
            const shareCode = urlParams.get('share') || urlParams.get('data');
            
            if (shareCode) {
                console.log(`🔗 Share code detected: ${shareCode}`);
                try {
                    // Decode shared data
                    const sharedData = JSON.parse(atob(shareCode));
                    console.log(`✅ Loaded shared data: ${Object.keys(sharedData.outlets || {}).length} outlets`);
                    
                    // Save shared data locally
                    await this.savePhoenixData(sharedData);
                    return sharedData;
                } catch (decodeError) {
                    console.warn('⚠️ Failed to decode shared data:', decodeError.message);
                }
            }
            
            // Try multiple storage locations
            const storageLocations = [
                this.storageKey,
                this.sharedKey,
                'phoenixProjectData',
                'phoenix-okr-data' // Legacy fallback
            ];
            
            let bestData = { outlets: {} };
            let bestCount = 0;
            let bestTimestamp = '';
            
            for (const location of storageLocations) {
                try {
                    const data = localStorage.getItem(location);
                    if (data) {
                        const parsed = JSON.parse(data);
                        const outletCount = Object.keys(parsed.outlets || {}).length;
                        const timestamp = parsed.metadata?.lastUpdated || '';
                        
                        console.log(`📦 Found data in ${location}: ${outletCount} outlets (${timestamp})`);
                        
                        // Use the data with the most outlets or newest timestamp
                        if (outletCount > bestCount || 
                            (outletCount === bestCount && timestamp > bestTimestamp)) {
                            bestData = parsed;
                            bestCount = outletCount;
                            bestTimestamp = timestamp;
                        }
                    }
                } catch (e) {
                    console.warn(`⚠️ Could not parse data from ${location}:`, e.message);
                }
            }
            
            console.log(`✅ Best Phoenix data loaded: ${bestCount} outlets (${bestTimestamp})`);
            return bestData;

        } catch (error) {
            console.error('❌ Failed to load Phoenix data:', error);
            return { outlets: {} };
        }
    }

    /**
     * Save Phoenix data to multiple locations for redundancy
     */
    async savePhoenixData(phoenixData) {
        try {
            console.log('💾 Saving Phoenix data (V2)...');

            const timestamp = new Date().toISOString();

            // Add metadata
            const dataWithMetadata = {
                ...phoenixData,
                metadata: {
                    lastUpdated: timestamp,
                    version: '2.0.0',
                    totalOutlets: Object.keys(phoenixData.outlets || {}).length,
                    syncMethod: 'multi-location-storage',
                    deviceId: this.getDeviceId()
                }
            };

            // Save to multiple locations for redundancy
            const saveLocations = [
                this.storageKey,
                this.sharedKey,
                'phoenixProjectData'
            ];

            let saveCount = 0;
            for (const location of saveLocations) {
                try {
                    localStorage.setItem(location, JSON.stringify(dataWithMetadata));
                    localStorage.setItem(location + '_timestamp', timestamp);
                    saveCount++;
                } catch (saveError) {
                    console.warn(`⚠️ Failed to save to ${location}:`, saveError.message);
                }
            }

            // Also save to session storage for cross-tab sync
            try {
                sessionStorage.setItem(this.sharedKey, JSON.stringify(dataWithMetadata));
            } catch (sessionError) {
                console.warn('⚠️ Session storage save failed:', sessionError.message);
            }

            console.log(`✅ Phoenix data saved to ${saveCount} locations successfully`);
            return saveCount > 0;

        } catch (error) {
            console.error('❌ Failed to save Phoenix data:', error);
            return false;
        }
    }

    /**
     * Generate device ID for tracking
     */
    getDeviceId() {
        let deviceId = localStorage.getItem('phoenix-device-id');
        if (!deviceId) {
            deviceId = 'device-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
            localStorage.setItem('phoenix-device-id', deviceId);
        }
        return deviceId;
    }

    /**
     * Generate a shareable URL with encoded data
     */
    generateShareableUrl(phoenixData) {
        try {
            const encodedData = btoa(JSON.stringify(phoenixData));
            const baseUrl = window.location.href.split('?')[0];
            return `${baseUrl}?share=${encodedData}`;
        } catch (error) {
            console.error('❌ Failed to generate shareable URL:', error);
            return null;
        }
    }

    /**
     * Export Phoenix data with sharing options
     */
    exportPhoenixData(phoenixData) {
        try {
            const shareableUrl = this.generateShareableUrl(phoenixData);
            
            const exportData = {
                ...phoenixData,
                exportInfo: {
                    exportedAt: new Date().toISOString(),
                    shareableUrl: shareableUrl,
                    instructions: 'To share data across devices, use the shareableUrl or copy the data to another browser'
                }
            };
            
            const content = JSON.stringify(exportData, null, 2);
            const blob = new Blob([content], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `phoenix-data-backup-${new Date().toISOString().substring(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            console.log('📤 Phoenix data exported');
            console.log('🔗 Shareable URL:', shareableUrl);
            
            return {
                success: true,
                shareableUrl: shareableUrl
            };
        } catch (error) {
            console.error('❌ Failed to export Phoenix data:', error);
            return { success: false };
        }
    }

    /**
     * Get storage info and statistics
     */
    async getStorageInfo() {
        try {
            const locations = [this.storageKey, this.sharedKey, 'phoenixProjectData'];
            const info = {
                deviceId: this.getDeviceId(),
                storageMethod: 'Multi-location + URL sharing',
                supportsCrossDevice: true,
                locations: {}
            };
            
            for (const location of locations) {
                const data = localStorage.getItem(location);
                const timestamp = localStorage.getItem(location + '_timestamp');
                
                info.locations[location] = {
                    hasData: !!data,
                    dataSize: data ? data.length : 0,
                    lastUpdated: timestamp,
                    outletCount: data ? Object.keys(JSON.parse(data).outlets || {}).length : 0
                };
            }
            
            return info;
        } catch (error) {
            return {
                deviceId: null,
                storageMethod: 'Error',
                supportsCrossDevice: false,
                error: error.message
            };
        }
    }

    /**
     * Clear all Phoenix data
     */
    async clearPhoenixData() {
        try {
            const locations = [
                this.storageKey,
                this.sharedKey,
                'phoenixProjectData',
                'phoenix-okr-data'
            ];
            
            for (const location of locations) {
                localStorage.removeItem(location);
                localStorage.removeItem(location + '_timestamp');
                sessionStorage.removeItem(location);
            }
            
            console.log('🧹 All Phoenix data cleared');
            return true;
        } catch (error) {
            console.error('❌ Failed to clear Phoenix data:', error);
            return false;
        }
    }
}

// Create global instance
const simpleCloudStorage = new SimpleCloudStorage();

// Make globally available
if (typeof window !== 'undefined') {
    window.SimpleCloudStorage = SimpleCloudStorage;
    window.simpleCloudStorage = simpleCloudStorage;
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SimpleCloudStorage;
}
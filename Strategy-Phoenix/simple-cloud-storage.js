/**
 * Simple Cloud Storage for Phoenix Data
 * Uses JSON Blob API for true cross-device functionality
 */

class SimpleCloudStorage {
    constructor() {
        this.storageKey = 'phoenix-okr-global-data';
        this.timestampKey = 'phoenix-okr-last-sync';
        this.blobIdKey = 'phoenix-blob-id';
        
        // JSON Blob API configuration
        this.apiBase = 'https://jsonblob.com/api/jsonBlob';
        
        // Get or create a blob ID for this Phoenix installation
        this.blobId = localStorage.getItem(this.blobIdKey);
        
        console.log('🔧 SimpleCloudStorage initialized with JSON Blob API');
        console.log(`📋 Blob ID: ${this.blobId || 'Not created yet'}`);
    }

    /**
     * Load Phoenix data from JSON Blob (true cross-device)
     */
    async loadPhoenixData() {
        try {
            console.log('☁️ Loading Phoenix data from JSON Blob cloud storage...');
            
            // First try local storage for immediate access
            const localData = localStorage.getItem(this.storageKey);
            const localTimestamp = localStorage.getItem(this.timestampKey);
            
            let phoenixData = { outlets: {} };
            
            if (localData) {
                try {
                    phoenixData = JSON.parse(localData);
                    console.log(`📱 Local data found: ${Object.keys(phoenixData.outlets || {}).length} outlets (${localTimestamp})`);
                } catch (e) {
                    console.warn('⚠️ Local data corrupted, will fetch from cloud');
                }
            }

            // Try to fetch from JSON Blob cloud storage
            if (this.blobId) {
                try {
                    console.log(`🌐 Fetching from JSON Blob: ${this.blobId}`);
                    
                    const response = await fetch(`${this.apiBase}/${this.blobId}`, {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    if (response.ok) {
                        const cloudData = await response.json();
                        const cloudTimestamp = cloudData.metadata?.lastUpdated || '';
                        
                        console.log(`☁️ Cloud data found: ${Object.keys(cloudData.outlets || {}).length} outlets (${cloudTimestamp})`);
                        
                        // Use cloud data if it's newer or if local data is empty
                        if (!localTimestamp || 
                            cloudTimestamp > localTimestamp || 
                            Object.keys(cloudData.outlets || {}).length > Object.keys(phoenixData.outlets || {}).length) {
                            
                            phoenixData = cloudData;
                            console.log('✅ Using cloud data (newer or more complete)');
                            
                            // Update local storage with cloud data
                            localStorage.setItem(this.storageKey, JSON.stringify(phoenixData));
                            localStorage.setItem(this.timestampKey, cloudTimestamp);
                        } else {
                            console.log('📱 Local data is current, using local version');
                        }
                    } else if (response.status === 404) {
                        console.log('📝 No cloud data found for this blob ID');
                    } else {
                        console.warn(`⚠️ Cloud fetch failed: ${response.status} ${response.statusText}`);
                    }
                } catch (cloudError) {
                    console.warn('⚠️ Could not access JSON Blob cloud storage:', cloudError.message);
                }
            } else {
                console.log('🆕 No blob ID found, will create one when saving data');
            }

            // Fallback to legacy data for migration
            if (Object.keys(phoenixData.outlets || {}).length === 0) {
                const legacyData = localStorage.getItem('phoenixProjectData');
                if (legacyData) {
                    try {
                        phoenixData = JSON.parse(legacyData);
                        console.log('🔄 Migrated from legacy storage');
                        
                        // Auto-save to cloud storage
                        await this.savePhoenixData(phoenixData);
                    } catch (e) {
                        console.warn('⚠️ Legacy data corrupted');
                    }
                }
            }
            
            console.log(`✅ Final Phoenix data loaded: ${Object.keys(phoenixData.outlets || {}).length} outlets`);
            return phoenixData;

        } catch (error) {
            console.error('❌ Failed to load Phoenix data:', error);
            
            // Return local data as last resort
            try {
                const fallbackData = JSON.parse(localStorage.getItem('phoenixProjectData') || '{"outlets":{}}');
                console.log(`📋 Using fallback data: ${Object.keys(fallbackData.outlets).length} outlets`);
                return fallbackData;
            } catch (fallbackError) {
                return { outlets: {} };
            }
        }
    }

    /**
     * Save Phoenix data to JSON Blob (true cross-device sync)
     */
    async savePhoenixData(phoenixData) {
        try {
            console.log('☁️ Saving Phoenix data to JSON Blob cloud storage...');

            const timestamp = new Date().toISOString();

            // Add metadata
            const dataWithMetadata = {
                ...phoenixData,
                metadata: {
                    lastUpdated: timestamp,
                    version: '2.0.0',
                    totalOutlets: Object.keys(phoenixData.outlets || {}).length,
                    syncMethod: 'json-blob-api',
                    blobId: this.blobId
                }
            };

            // Save to local storage first (immediate access)
            localStorage.setItem(this.storageKey, JSON.stringify(dataWithMetadata));
            localStorage.setItem(this.timestampKey, timestamp);
            localStorage.setItem('phoenixProjectData', JSON.stringify(dataWithMetadata));

            // Save to JSON Blob cloud storage
            let cloudSuccess = false;
            
            if (this.blobId) {
                // Update existing blob
                try {
                    console.log(`🌐 Updating JSON Blob: ${this.blobId}`);
                    
                    const response = await fetch(`${this.apiBase}/${this.blobId}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify(dataWithMetadata)
                    });
                    
                    if (response.ok) {
                        console.log('✅ Data updated in JSON Blob successfully');
                        cloudSuccess = true;
                    } else {
                        console.warn(`⚠️ JSON Blob update failed: ${response.status} ${response.statusText}`);
                    }
                } catch (updateError) {
                    console.error('❌ Failed to update JSON Blob:', updateError.message);
                }
            }
            
            if (!cloudSuccess) {
                // Create new blob
                try {
                    console.log('🆕 Creating new JSON Blob...');
                    
                    const response = await fetch(this.apiBase, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify(dataWithMetadata)
                    });
                    
                    if (response.status === 201) {
                        // Extract blob ID from Location header
                        const location = response.headers.get('Location');
                        if (location) {
                            const blobId = location.split('/').pop();
                            this.blobId = blobId;
                            localStorage.setItem(this.blobIdKey, blobId);
                            
                            // Update metadata with new blob ID
                            dataWithMetadata.metadata.blobId = blobId;
                            localStorage.setItem(this.storageKey, JSON.stringify(dataWithMetadata));
                            
                            console.log(`✅ New JSON Blob created: ${blobId}`);
                            cloudSuccess = true;
                        }
                    } else {
                        console.warn(`⚠️ JSON Blob creation failed: ${response.status} ${response.statusText}`);
                    }
                } catch (createError) {
                    console.error('❌ Failed to create JSON Blob:', createError.message);
                }
            }

            if (cloudSuccess) {
                console.log(`✅ Phoenix data synced to cloud: ${Object.keys(phoenixData.outlets || {}).length} outlets`);
                console.log(`🔗 Access your data from any device using blob ID: ${this.blobId}`);
            } else {
                console.log('📱 Data saved locally only (cloud sync failed)');
            }

            return cloudSuccess;

        } catch (error) {
            console.error('❌ Failed to save Phoenix data:', error);
            return false;
        }
    }

    /**
     * Manually set a blob ID for data sharing
     */
    setBlobId(blobId) {
        if (blobId && blobId.length > 0) {
            this.blobId = blobId;
            localStorage.setItem(this.blobIdKey, blobId);
            console.log(`🔗 Blob ID set: ${blobId}`);
            return true;
        }
        return false;
    }

    /**
     * Get the current blob ID for sharing
     */
    getBlobId() {
        return this.blobId;
    }

    /**
     * Create a shareable URL for the Phoenix data
     */
    getShareableUrl() {
        if (this.blobId) {
            return `https://jsonblob.com/${this.blobId}`;
        }
        return null;
    }

    /**
     * Import data from another blob ID
     */
    async importFromBlobId(blobId) {
        try {
            console.log(`📥 Importing data from blob ID: ${blobId}`);
            
            const response = await fetch(`${this.apiBase}/${blobId}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const importedData = await response.json();
                console.log(`📊 Imported data: ${Object.keys(importedData.outlets || {}).length} outlets`);
                
                // Save imported data locally and to our blob
                await this.savePhoenixData(importedData);
                
                return importedData;
            } else {
                throw new Error(`Failed to import: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            console.error('❌ Failed to import data:', error);
            throw error;
        }
    }

    /**
     * Export Phoenix data for download
     */
    exportPhoenixData(phoenixData) {
        try {
            const exportData = {
                ...phoenixData,
                exportInfo: {
                    exportedAt: new Date().toISOString(),
                    blobId: this.blobId,
                    shareableUrl: this.getShareableUrl()
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
            
            console.log('📤 Phoenix data exported with cloud sharing info');
            return true;
        } catch (error) {
            console.error('❌ Failed to export Phoenix data:', error);
            return false;
        }
    }

    /**
     * Get storage info and statistics
     */
    async getStorageInfo() {
        try {
            const localData = localStorage.getItem(this.storageKey);
            const lastSync = localStorage.getItem(this.timestampKey);
            
            // Try to get cloud status
            let cloudStatus = 'Unknown';
            let cloudDataSize = 0;
            let cloudLastUpdated = null;
            
            if (this.blobId) {
                try {
                    const response = await fetch(`${this.apiBase}/${this.blobId}`, {
                        method: 'GET',
                        headers: { 'Accept': 'application/json' }
                    });
                    
                    if (response.ok) {
                        const cloudData = await response.json();
                        cloudStatus = 'Available';
                        cloudDataSize = JSON.stringify(cloudData).length;
                        cloudLastUpdated = cloudData.metadata?.lastUpdated || null;
                    } else if (response.status === 404) {
                        cloudStatus = 'Not Found';
                    } else {
                        cloudStatus = `Error ${response.status}`;
                    }
                } catch (e) {
                    cloudStatus = 'Connection Failed';
                }
            } else {
                cloudStatus = 'No Blob ID';
            }
            
            return {
                blobId: this.blobId,
                shareableUrl: this.getShareableUrl(),
                hasLocalData: !!localData,
                lastSync: lastSync,
                localDataSize: localData ? localData.length : 0,
                cloudStatus: cloudStatus,
                cloudDataSize: cloudDataSize,
                cloudLastUpdated: cloudLastUpdated,
                storageMethod: 'JSON Blob API',
                supportsCrossDevice: true,
                instructions: this.blobId ? 
                    `Share blob ID "${this.blobId}" with other devices to sync data` :
                    'Save data first to generate a shareable blob ID'
            };
        } catch (error) {
            return {
                blobId: this.blobId,
                hasLocalData: false,
                lastSync: null,
                localDataSize: 0,
                cloudStatus: 'Error',
                cloudDataSize: 0,
                cloudLastUpdated: null,
                storageMethod: 'JSON Blob API (Error)',
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
            // Clear local storage
            localStorage.removeItem(this.storageKey);
            localStorage.removeItem(this.timestampKey);
            localStorage.removeItem('phoenixProjectData');
            
            // Note: We don't delete the blob from JSON Blob as it might be shared
            // We just clear the local reference to it
            
            console.log('🧹 Local Phoenix data cleared (cloud blob preserved)');
            console.log(`ℹ️ To continue syncing, use blob ID: ${this.blobId}`);
            
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
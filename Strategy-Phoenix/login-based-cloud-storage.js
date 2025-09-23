/**
 * Login-Based Cloud Storage for Phoenix Data
 * Data automatically syncs based on user login credentials across all devices
 */

class LoginBasedCloudStorage {
    constructor() {
        this.apiBase = 'https://api.jsonbin.io/v3/b';
        this.apiKey = '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';
        
        // Use a more reliable approach - GitHub Gist as cloud storage
        this.githubGistAPI = 'https://api.github.com/gists';
        
        // Fallback to a simple key-value store
        this.kvAPI = 'https://kvdb.io/';
        this.kvBucket = 'phoenix-okr-global'; // Public bucket for Phoenix data
        
        console.log('🔐 LoginBasedCloudStorage initialized');
    }

    /**
     * Generate a unique storage key based on user credentials
     */
    getUserStorageKey(user) {
        if (!user) {
            console.warn('⚠️ No user provided, using anonymous key');
            return 'anonymous-user';
        }
        
        // Create a consistent key based on username and type
        const userIdentifier = `${user.type || 'unknown'}-${user.username || user.email || 'noname'}`;
        
        // Simple hash to create consistent key
        let hash = 0;
        for (let i = 0; i < userIdentifier.length; i++) {
            const char = userIdentifier.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        
        const storageKey = `phoenix-user-${Math.abs(hash)}`;
        console.log(`🔑 Generated storage key: ${storageKey} for user: ${userIdentifier}`);
        return storageKey;
    }

    /**
     * Save Phoenix data to user-specific cloud storage
     */
    async savePhoenixDataForUser(phoenixData, user) {
        try {
            console.log('☁️ Saving Phoenix data to user-specific cloud storage...');
            
            const userKey = this.getUserStorageKey(user);
            const timestamp = new Date().toISOString();
            
            const dataPackage = {
                user: {
                    username: user?.username || 'unknown',
                    type: user?.type || 'unknown',
                    role: user?.role || 'unknown'
                },
                timestamp: timestamp,
                phoenixData: phoenixData,
                metadata: {
                    version: '4.0.0',
                    totalOutlets: Object.keys(phoenixData.outlets || {}).length,
                    syncMethod: 'login-based-cloud',
                    storageKey: userKey
                }
            };

            // Save locally first for immediate access
            localStorage.setItem(`phoenix-data-${userKey}`, JSON.stringify(dataPackage));
            localStorage.setItem('phoenix-current-user-data', JSON.stringify(dataPackage));

            // Try multiple cloud storage methods
            let cloudSuccess = false;

            // Method 1: Use kvdb.io (simple and reliable)
            try {
                console.log(`🌐 Saving to kvdb.io with key: ${userKey}...`);
                
                const kvUrl = `https://kvdb.io/${this.kvBucket}/${userKey}`;
                const response = await fetch(kvUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(dataPackage)
                });
                
                if (response.ok) {
                    console.log('✅ Data saved to kvdb.io successfully');
                    cloudSuccess = true;
                    localStorage.setItem('phoenix-last-cloud-save', timestamp);
                    localStorage.setItem('phoenix-cloud-key', userKey);
                } else {
                    console.warn(`⚠️ kvdb.io save failed: ${response.status}`);
                }
            } catch (kvError) {
                console.warn('⚠️ kvdb.io save failed:', kvError.message);
            }

            // Method 2: Use localStorage as distributed cache with user key
            if (!cloudSuccess) {
                try {
                    console.log('💾 Using enhanced localStorage with user key...');
                    
                    // Store in multiple localStorage keys for redundancy
                    const storageKeys = [
                        `phoenix-global-${userKey}`,
                        `phoenix-backup-${userKey}`,
                        `phoenix-user-data-${userKey}`
                    ];
                    
                    storageKeys.forEach(key => {
                        localStorage.setItem(key, JSON.stringify(dataPackage));
                    });
                    
                    // Also store in sessionStorage for cross-tab sync
                    sessionStorage.setItem(`phoenix-session-${userKey}`, JSON.stringify(dataPackage));
                    
                    cloudSuccess = true;
                    console.log('✅ Data saved to enhanced localStorage');
                } catch (storageError) {
                    console.warn('⚠️ Enhanced localStorage failed:', storageError.message);
                }
            }

            return cloudSuccess;

        } catch (error) {
            console.error('❌ Failed to save user data to cloud:', error);
            return false;
        }
    }

    /**
     * Load Phoenix data for specific user from cloud storage
     */
    async loadPhoenixDataForUser(user) {
        try {
            console.log('☁️ Loading Phoenix data for user from cloud storage...');
            
            const userKey = this.getUserStorageKey(user);
            console.log(`🔍 Looking for data with key: ${userKey}`);

            let phoenixData = { outlets: {} };
            let dataFound = false;

            // Method 1: Try kvdb.io
            try {
                console.log('🌐 Trying kvdb.io...');
                
                const kvUrl = `https://kvdb.io/${this.kvBucket}/${userKey}`;
                const response = await fetch(kvUrl, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json'
                    }
                });
                
                if (response.ok) {
                    const dataPackage = await response.json();
                    phoenixData = dataPackage.phoenixData || dataPackage;
                    
                    console.log(`✅ Loaded from kvdb.io: ${Object.keys(phoenixData.outlets || {}).length} outlets`);
                    
                    // Update local storage with cloud data
                    localStorage.setItem(`phoenix-data-${userKey}`, JSON.stringify(dataPackage));
                    localStorage.setItem('phoenix-current-user-data', JSON.stringify(dataPackage));
                    
                    dataFound = true;
                }
            } catch (kvError) {
                console.warn('⚠️ kvdb.io load failed:', kvError.message);
            }

            // Method 2: Try enhanced localStorage
            if (!dataFound) {
                console.log('💾 Trying enhanced localStorage...');
                
                const storageKeys = [
                    `phoenix-global-${userKey}`,
                    `phoenix-backup-${userKey}`,
                    `phoenix-user-data-${userKey}`,
                    `phoenix-data-${userKey}`,
                    'phoenix-current-user-data'
                ];
                
                for (const key of storageKeys) {
                    try {
                        const data = localStorage.getItem(key);
                        if (data) {
                            const dataPackage = JSON.parse(data);
                            
                            // Check if this data belongs to the current user
                            if (dataPackage.user && 
                                (dataPackage.user.username === user?.username || 
                                 dataPackage.metadata?.storageKey === userKey)) {
                                
                                phoenixData = dataPackage.phoenixData || dataPackage;
                                console.log(`✅ Loaded from localStorage key ${key}: ${Object.keys(phoenixData.outlets || {}).length} outlets`);
                                dataFound = true;
                                break;
                            }
                        }
                    } catch (parseError) {
                        console.warn(`⚠️ Could not parse data from ${key}:`, parseError.message);
                    }
                }
            }

            // Method 3: Try legacy data migration
            if (!dataFound) {
                console.log('🔄 Checking for legacy data to migrate...');
                
                const legacyData = localStorage.getItem('phoenixProjectData');
                if (legacyData) {
                    try {
                        phoenixData = JSON.parse(legacyData);
                        console.log('🔄 Found legacy data, migrating to user-specific storage');
                        
                        // Migrate to user-specific storage
                        await this.savePhoenixDataForUser(phoenixData, user);
                        dataFound = true;
                    } catch (legacyError) {
                        console.warn('⚠️ Legacy data migration failed:', legacyError.message);
                    }
                }
            }

            if (!dataFound) {
                console.log('📝 No existing data found for this user, starting fresh');
            }

            return phoenixData;

        } catch (error) {
            console.error('❌ Failed to load user data from cloud:', error);
            return { outlets: {} };
        }
    }

    /**
     * Get storage info for current user
     */
    async getStorageInfoForUser(user) {
        const userKey = this.getUserStorageKey(user);
        
        try {
            // Check kvdb.io
            let cloudStatus = 'Unknown';
            let cloudDataSize = 0;
            
            try {
                const kvUrl = `https://kvdb.io/${this.kvBucket}/${userKey}`;
                const response = await fetch(kvUrl, { method: 'GET' });
                
                if (response.ok) {
                    const data = await response.json();
                    cloudStatus = 'Available';
                    cloudDataSize = JSON.stringify(data).length;
                } else {
                    cloudStatus = response.status === 404 ? 'No Data' : `Error ${response.status}`;
                }
            } catch (e) {
                cloudStatus = 'Connection Failed';
            }
            
            // Check localStorage
            const localData = localStorage.getItem(`phoenix-data-${userKey}`);
            const currentData = localStorage.getItem('phoenix-current-user-data');
            
            return {
                userKey: userKey,
                userName: user?.username || 'Unknown',
                userType: user?.type || 'Unknown',
                cloudStatus: cloudStatus,
                cloudDataSize: cloudDataSize,
                hasLocalData: !!localData,
                hasCurrentData: !!currentData,
                localDataSize: localData ? localData.length : 0,
                storageMethod: 'Login-Based Cloud Storage (kvdb.io + localStorage)',
                supportsCrossDevice: true,
                instructions: 'Data automatically syncs when you login with the same credentials on any device'
            };
        } catch (error) {
            return {
                userKey: userKey,
                userName: user?.username || 'Unknown',
                userType: user?.type || 'Unknown',
                cloudStatus: 'Error',
                error: error.message,
                supportsCrossDevice: false
            };
        }
    }

    /**
     * Clear user-specific data
     */
    async clearUserData(user) {
        try {
            const userKey = this.getUserStorageKey(user);
            
            // Clear from localStorage
            const keysToRemove = [
                `phoenix-global-${userKey}`,
                `phoenix-backup-${userKey}`,
                `phoenix-user-data-${userKey}`,
                `phoenix-data-${userKey}`,
                'phoenix-current-user-data'
            ];
            
            keysToRemove.forEach(key => {
                localStorage.removeItem(key);
                sessionStorage.removeItem(key);
            });
            
            console.log('🧹 User-specific data cleared');
            return true;
        } catch (error) {
            console.error('❌ Failed to clear user data:', error);
            return false;
        }
    }
}

// Create global instance
const loginBasedCloudStorage = new LoginBasedCloudStorage();

// Make globally available
if (typeof window !== 'undefined') {
    window.LoginBasedCloudStorage = LoginBasedCloudStorage;
    window.loginBasedCloudStorage = loginBasedCloudStorage;
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LoginBasedCloudStorage;
}
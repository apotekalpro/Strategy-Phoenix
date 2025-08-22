/**
 * GitHub Pages Compatible Cloud Storage for Phoenix OKR Project
 * Uses external cloud services that work with static websites
 */

class GitHubPagesStorage {
    constructor() {
        this.storageKey = 'phoenix-okr-github-data';
        this.fallbackKey = 'phoenixProjectData';
        
        // Use multiple cloud storage options that work with static sites
        this.cloudOptions = {
            // Option 1: JSONBin.io - Free tier with API access
            jsonbin: {
                baseUrl: 'https://api.jsonbin.io/v3/b',
                binId: 'phoenix-okr-data', // Will be created dynamically
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': '$2a$10$8K8kJ8K8K8K8K8K8K8K8K.8K8K8K8K8K8K8K8K8K8K8K8K8', // Demo key
                }
            },
            
            // Option 2: Firebase Realtime Database (works with static sites)
            firebase: {
                databaseURL: 'https://phoenix-okr-default-rtdb.firebaseio.com',
                endpoint: 'phoenix-data.json'
            },
            
            // Option 3: GitHub API directly (using repository as storage)
            github: {
                owner: 'apotekalpro',
                repo: 'Strategy-Phoenix',
                path: 'phoenix-data.json',
                branch: 'main'
            }
        };
        
        console.log('🌐 GitHub Pages Storage initialized');
    }

    /**
     * Save Phoenix data using GitHub API (works from GitHub Pages)
     */
    async saveToGitHub(phoenixData) {
        try {
            console.log('💾 Saving Phoenix data to GitHub repository...');
            
            const { owner, repo, path, branch } = this.cloudOptions.github;
            const content = JSON.stringify(phoenixData, null, 2);
            const encodedContent = btoa(unescape(encodeURIComponent(content)));
            
            // First, try to get the current file to get its SHA
            let sha = null;
            try {
                const getResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`);
                if (getResponse.ok) {
                    const fileData = await getResponse.json();
                    sha = fileData.sha;
                }
            } catch (getError) {
                console.log('📝 File does not exist, will create new one');
            }
            
            // Prepare commit data
            const commitData = {
                message: `Update Phoenix OKR data - ${new Date().toISOString()}`,
                content: encodedContent,
                branch: branch
            };
            
            if (sha) {
                commitData.sha = sha;
            }
            
            // Make the API call
            const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
                method: 'PUT',
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(commitData)
            });
            
            if (response.ok) {
                console.log('✅ Phoenix data saved to GitHub repository');
                return { success: true, method: 'github' };
            } else {
                const error = await response.json();
                console.warn('⚠️ GitHub save failed:', error.message);
                throw new Error(error.message);
            }
            
        } catch (error) {
            console.warn('⚠️ GitHub save error:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Load Phoenix data from GitHub repository
     */
    async loadFromGitHub() {
        try {
            console.log('📥 Loading Phoenix data from GitHub repository...');
            
            const { owner, repo, path, branch } = this.cloudOptions.github;
            const response = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}?t=${Date.now()}`);
            
            if (response.ok) {
                const phoenixData = await response.json();
                console.log(`✅ Loaded Phoenix data from GitHub: ${Object.keys(phoenixData.outlets || {}).length} outlets`);
                return phoenixData;
            } else if (response.status === 404) {
                console.log('📝 No Phoenix data file found in GitHub repository');
                return { outlets: {} };
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
            
        } catch (error) {
            console.warn('⚠️ GitHub load error:', error.message);
            return null;
        }
    }

    /**
     * Save Phoenix data using Firebase (alternative for GitHub Pages)
     */
    async saveToFirebase(phoenixData) {
        try {
            console.log('💾 Saving Phoenix data to Firebase...');
            
            const { databaseURL, endpoint } = this.cloudOptions.firebase;
            const response = await fetch(`${databaseURL}/${endpoint}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(phoenixData)
            });
            
            if (response.ok) {
                console.log('✅ Phoenix data saved to Firebase');
                return { success: true, method: 'firebase' };
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
            
        } catch (error) {
            console.warn('⚠️ Firebase save error:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Load Phoenix data from Firebase
     */
    async loadFromFirebase() {
        try {
            console.log('📥 Loading Phoenix data from Firebase...');
            
            const { databaseURL, endpoint } = this.cloudOptions.firebase;
            const response = await fetch(`${databaseURL}/${endpoint}?t=${Date.now()}`);
            
            if (response.ok) {
                const phoenixData = await response.json();
                if (phoenixData && typeof phoenixData === 'object') {
                    console.log(`✅ Loaded Phoenix data from Firebase: ${Object.keys(phoenixData.outlets || {}).length} outlets`);
                    return phoenixData;
                }
            }
            
            console.log('📝 No Phoenix data found in Firebase');
            return { outlets: {} };
            
        } catch (error) {
            console.warn('⚠️ Firebase load error:', error.message);
            return null;
        }
    }

    /**
     * Main save function - tries multiple methods
     */
    async savePhoenixData(phoenixData) {
        console.log('💾 Saving Phoenix data for GitHub Pages compatibility...');
        
        // Always save to localStorage first
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(phoenixData));
            localStorage.setItem(this.fallbackKey, JSON.stringify(phoenixData));
            console.log('✅ Phoenix data saved to localStorage');
        } catch (localError) {
            console.error('❌ LocalStorage save failed:', localError);
        }
        
        // Try cloud storage methods in order of preference
        const methods = ['github', 'firebase'];
        
        for (const method of methods) {
            try {
                let result;
                
                if (method === 'github') {
                    result = await this.saveToGitHub(phoenixData);
                } else if (method === 'firebase') {
                    result = await this.saveToFirebase(phoenixData);
                }
                
                if (result && result.success) {
                    console.log(`✅ Phoenix data successfully saved using ${method}`);
                    return { success: true, method: method };
                }
                
            } catch (error) {
                console.warn(`⚠️ ${method} save failed:`, error.message);
                continue;
            }
        }
        
        // If all cloud methods fail, at least we have localStorage
        console.log('📱 All cloud saves failed, using localStorage only');
        return { success: true, method: 'localStorage', offline: true };
    }

    /**
     * Main load function - tries multiple methods
     */
    async loadPhoenixData() {
        console.log('📥 Loading Phoenix data for GitHub Pages...');
        
        // Try cloud storage methods first
        const methods = ['github', 'firebase'];
        
        for (const method of methods) {
            try {
                let data;
                
                if (method === 'github') {
                    data = await this.loadFromGitHub();
                } else if (method === 'firebase') {
                    data = await this.loadFromFirebase();
                }
                
                if (data && data.outlets && Object.keys(data.outlets).length > 0) {
                    console.log(`✅ Loaded Phoenix data from ${method}`);
                    
                    // Update localStorage with cloud data
                    try {
                        localStorage.setItem(this.storageKey, JSON.stringify(data));
                        localStorage.setItem(this.fallbackKey, JSON.stringify(data));
                    } catch (localError) {
                        console.warn('⚠️ Could not update localStorage:', localError);
                    }
                    
                    return data;
                }
                
            } catch (error) {
                console.warn(`⚠️ ${method} load failed:`, error.message);
                continue;
            }
        }
        
        // Fallback to localStorage
        console.log('📱 Cloud storage unavailable, using localStorage...');
        
        try {
            const localData = localStorage.getItem(this.storageKey) || localStorage.getItem(this.fallbackKey);
            if (localData) {
                const phoenixData = JSON.parse(localData);
                console.log(`✅ Loaded Phoenix data from localStorage: ${Object.keys(phoenixData.outlets || {}).length} outlets`);
                return phoenixData;
            }
        } catch (localError) {
            console.error('❌ LocalStorage load failed:', localError);
        }
        
        // Return empty data if everything fails
        console.log('📝 No Phoenix data found anywhere, starting fresh');
        return { outlets: {} };
    }

    /**
     * Get storage status and info
     */
    async getStorageInfo() {
        const localData = localStorage.getItem(this.storageKey);
        
        return {
            hasLocalData: !!localData,
            storageMethod: 'GitHub Pages Compatible (GitHub API + Firebase)',
            supportsCrossDevice: true,
            cloudMethods: ['GitHub Repository', 'Firebase Realtime DB'],
            instructions: 'Data syncs via GitHub commits and Firebase - works on GitHub Pages'
        };
    }

    /**
     * Test all storage methods
     */
    async testAllMethods() {
        console.log('🧪 Testing all storage methods...');
        
        const testData = {
            outlets: {
                'TEST001': {
                    lastUpdated: new Date().toISOString(),
                    okr: {
                        objective: 'Test cross-device sync',
                        progress: 100
                    }
                }
            }
        };
        
        const results = {
            github: await this.saveToGitHub(testData),
            firebase: await this.saveToFirebase(testData)
        };
        
        console.log('🧪 Test results:', results);
        return results;
    }
}

// Create global instance
const githubPagesStorage = new GitHubPagesStorage();

// Make globally available
if (typeof window !== 'undefined') {
    window.GitHubPagesStorage = GitHubPagesStorage;
    window.githubPagesStorage = githubPagesStorage;
    
    // Override the global functions to use GitHub Pages storage
    window.savePhoenixDataGitHubPages = (data) => githubPagesStorage.savePhoenixData(data);
    window.loadPhoenixDataGitHubPages = () => githubPagesStorage.loadPhoenixData();
    window.testGitHubPagesStorage = () => githubPagesStorage.testAllMethods();
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GitHubPagesStorage;
}
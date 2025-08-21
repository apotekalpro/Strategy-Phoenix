/**
 * GitHub API Integration for Phoenix Project Data Storage
 * Provides cross-device data persistence using GitHub repositories
 */

class GitHubAPI {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes cache
        this.repo = CONFIG.GOOGLE_SHEETS.GITHUB_DATA_REPO || 'apotekalpro/Strategy-Phoenix';
        this.branch = CONFIG.GOOGLE_SHEETS.GITHUB_DATA_BRANCH || 'main';
        this.baseURL = CONFIG.GOOGLE_SHEETS.GITHUB_API_URL || 'https://api.github.com';
        
        // Use the existing Strategy-Phoenix repository for immediate functionality
        this.dataFileName = 'phoenix-data.json';
        this.rawURL = `https://raw.githubusercontent.com/${this.repo}/${this.branch}/${this.dataFileName}`;
    }

    /**
     * Get GitHub API headers with authentication
     */
    getHeaders() {
        const headers = {
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        };
        
        // Use GitHub token if available (from environment or git config)
        if (window.GITHUB_TOKEN) {
            headers['Authorization'] = `token ${window.GITHUB_TOKEN}`;
        }
        
        return headers;
    }

    /**
     * Load Phoenix data from GitHub repository using raw URL (no auth required)
     */
    async loadPhoenixData() {
        try {
            console.log('🐙 Loading Phoenix data from GitHub (raw URL)...');
            
            const cacheKey = 'phoenix-data';
            
            // Check cache first
            if (this.cache.has(cacheKey)) {
                const cached = this.cache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.cacheTimeout) {
                    console.log('📋 Using cached Phoenix data from GitHub');
                    return cached.data;
                }
            }

            // Try to load from raw GitHub URL (no authentication required)
            console.log('🔗 Fetching from:', this.rawURL);
            const response = await fetch(this.rawURL, {
                method: 'GET',
                cache: 'no-cache'  // Always get fresh data
            });

            if (response.status === 404) {
                console.log('📝 No Phoenix data file found in GitHub repository, starting fresh');
                return { outlets: {} };
            }

            if (!response.ok) {
                throw new Error(`GitHub raw file error: ${response.status} ${response.statusText}`);
            }

            const phoenixData = await response.json();
            
            // Cache the result
            this.cache.set(cacheKey, {
                data: phoenixData,
                timestamp: Date.now()
            });
            
            console.log(`✅ Loaded Phoenix data from GitHub: ${Object.keys(phoenixData.outlets).length} outlets`);
            return phoenixData;

        } catch (error) {
            console.error('❌ Failed to load Phoenix data from GitHub:', error);
            console.log('📋 Falling back to localStorage...');
            
            // Fallback to localStorage
            const localData = JSON.parse(localStorage.getItem('phoenixProjectData')) || { outlets: {} };
            console.log(`📊 LocalStorage fallback: ${Object.keys(localData.outlets).length} outlets`);
            return localData;
        }
    }

    /**
     * Save Phoenix data to GitHub repository
     */
    async savePhoenixData(phoenixData) {
        try {
            console.log('💾 Saving Phoenix data to GitHub...');

            // First, get the current file (if it exists) to get the SHA
            let sha = null;
            const cacheKey = 'phoenix-data';
            
            if (this.cache.has(cacheKey)) {
                sha = this.cache.get(cacheKey).sha;
            } else {
                // Try to get current file SHA
                try {
                    const url = `${this.baseURL}/repos/${this.repo}/contents/phoenix-data.json?ref=${this.branch}`;
                    const response = await fetch(url, {
                        method: 'GET',
                        headers: this.getHeaders()
                    });
                    
                    if (response.ok) {
                        const fileData = await response.json();
                        sha = fileData.sha;
                    }
                } catch (getError) {
                    console.log('📝 File does not exist yet, will create new one');
                }
            }

            // Prepare the content
            const content = JSON.stringify(phoenixData, null, 2);
            const encodedContent = btoa(unescape(encodeURIComponent(content)));

            // Prepare the commit data
            const commitData = {
                message: `Update Phoenix data - ${new Date().toISOString()}`,
                content: encodedContent,
                branch: this.branch
            };

            // Include SHA if updating existing file
            if (sha) {
                commitData.sha = sha;
            }

            // Make the API call to create/update the file
            const url = `${this.baseURL}/repos/${this.repo}/contents/phoenix-data.json`;
            const response = await fetch(url, {
                method: 'PUT',
                headers: this.getHeaders(),
                body: JSON.stringify(commitData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`GitHub API error: ${response.status} - ${errorData.message}`);
            }

            const result = await response.json();
            
            // Update cache with new SHA
            this.cache.set(cacheKey, {
                data: phoenixData,
                timestamp: Date.now(),
                sha: result.content.sha
            });

            console.log('✅ Phoenix data saved to GitHub successfully');
            return true;

        } catch (error) {
            console.error('❌ Failed to save Phoenix data to GitHub:', error);
            
            // Always save to localStorage as fallback
            try {
                localStorage.setItem('phoenixProjectData', JSON.stringify(phoenixData));
                console.log('📋 Fallback: Data saved to localStorage');
            } catch (localError) {
                console.error('❌ Critical: Failed to save to localStorage:', localError);
            }
            
            return false;
        }
    }

    /**
     * Get commit history for Phoenix data (version control)
     */
    async getDataHistory() {
        try {
            const url = `${this.baseURL}/repos/${this.repo}/commits?path=phoenix-data.json&per_page=10`;
            
            const response = await fetch(url, {
                method: 'GET',
                headers: this.getHeaders()
            });

            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status}`);
            }

            const commits = await response.json();
            
            return commits.map(commit => ({
                sha: commit.sha,
                message: commit.commit.message,
                date: commit.commit.author.date,
                author: commit.commit.author.name
            }));

        } catch (error) {
            console.error('❌ Failed to get data history:', error);
            return [];
        }
    }

    /**
     * Load Phoenix data from a specific commit (version)
     */
    async loadPhoenixDataFromCommit(commitSha) {
        try {
            const url = `${this.baseURL}/repos/${this.repo}/contents/phoenix-data.json?ref=${commitSha}`;
            
            const response = await fetch(url, {
                method: 'GET',
                headers: this.getHeaders()
            });

            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status}`);
            }

            const fileData = await response.json();
            const content = atob(fileData.content.replace(/\s/g, ''));
            const phoenixData = JSON.parse(content);
            
            console.log(`✅ Loaded Phoenix data from commit ${commitSha.substring(0, 8)}`);
            return phoenixData;

        } catch (error) {
            console.error('❌ Failed to load Phoenix data from commit:', error);
            return null;
        }
    }

    /**
     * Export Phoenix data as downloadable JSON
     */
    exportPhoenixData(phoenixData) {
        const content = JSON.stringify(phoenixData, null, 2);
        const blob = new Blob([content], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `phoenix-data-export-${new Date().toISOString().substring(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        console.log('📤 Phoenix data exported as JSON');
    }

    /**
     * Check GitHub API rate limits
     */
    async checkRateLimit() {
        try {
            const response = await fetch(`${this.baseURL}/rate_limit`, {
                headers: this.getHeaders()
            });
            
            if (response.ok) {
                const rateLimit = await response.json();
                console.log('📊 GitHub API Rate Limit:', rateLimit.rate);
                return rateLimit.rate;
            }
        } catch (error) {
            console.warn('⚠️ Could not check GitHub rate limit:', error);
        }
        return null;
    }

    /**
     * Refresh cache
     */
    refreshCache() {
        console.log('🔄 Refreshing GitHub API cache');
        this.cache.clear();
    }
}

// Create global instance
const gitHubAPI = new GitHubAPI();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GitHubAPI;
}

// Make GitHubAPI globally available for browser environments
if (typeof window !== 'undefined') {
    window.GitHubAPI = GitHubAPI;
    window.gitHubAPI = gitHubAPI;
}
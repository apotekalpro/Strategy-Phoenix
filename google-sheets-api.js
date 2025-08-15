/**
 * Google Sheets API Integration for OKR Phoenix Project
 * Handles real-time data synchronization with Google Sheets
 */

class GoogleSheetsAPI {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = CONFIG.APP.CACHE_DURATION;
    }

    /**
     * Fetch data from Google Sheets using the Sheets API
     * @param {string} spreadsheetId - The Google Sheets ID
     * @param {string} range - The range to fetch (e.g., 'Sheet1!A:D')
     * @returns {Promise<Array>} Array of rows
     */
    async fetchSheetData(spreadsheetId, range) {
        const cacheKey = `${spreadsheetId}_${range}`;
        
        // Check cache first
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                console.log('📋 Using cached data for:', range);
                return cached.data;
            }
        }

        try {
            // For now, we'll use a CORS proxy to access Google Sheets
            // In production, you'd want to use Google Sheets API with proper authentication
            const url = this.buildSheetURL(spreadsheetId, range);
            
            console.log('🔄 Fetching fresh data from Google Sheets:', range);
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            const rows = data.values || [];
            
            // Cache the result
            this.cache.set(cacheKey, {
                data: rows,
                timestamp: Date.now()
            });
            
            return rows;
            
        } catch (error) {
            console.error('❌ Error fetching Google Sheets data:', error);
            
            // Return cached data if available, otherwise return empty array
            if (this.cache.has(cacheKey)) {
                console.log('📋 Falling back to cached data');
                return this.cache.get(cacheKey).data;
            }
            
            throw error;
        }
    }

    /**
     * Build Google Sheets API URL
     */
    buildSheetURL(spreadsheetId, range) {
        const baseUrl = CONFIG.GOOGLE_SHEETS.BASE_URL;
        const apiKey = CONFIG.GOOGLE_SHEETS.API_KEY;
        return `${baseUrl}/${spreadsheetId}/values/${range}?key=${apiKey}`;
    }

    /**
     * Parse outlet credentials from Google Sheets data
     * Expected format: Column A = outlet code, Column D = password
     */
    parseOutletCredentials(rows) {
        const credentials = {};
        
        // Skip header row (index 0)
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (row.length >= 4) {
                const outletCode = row[0]?.toString().trim();
                const outletName = row[1]?.toString().trim() || '';
                const am = row[2]?.toString().trim() || '';
                const password = row[3]?.toString().trim();
                
                if (outletCode && password) {
                    credentials[outletCode.toUpperCase()] = {
                        password: password,
                        outletName: outletName,
                        am: am
                    };
                }
            }
        }
        
        console.log(`✅ Parsed ${Object.keys(credentials).length} outlet credentials`);
        return credentials;
    }

    /**
     * Parse HQ credentials from Google Sheets data
     * Expected format: Column B = email, Column H = password
     */
    parseHQCredentials(rows) {
        const credentials = {};
        
        // Skip header row (index 0)
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (row.length >= 8) {
                const email = row[1]?.toString().trim().toLowerCase();
                const name = row[2]?.toString().trim() || '';
                const role = row[3]?.toString().trim() || 'AM';
                const outlets = row[4]?.toString().trim().split(',').map(o => o.trim()) || [];
                const password = row[7]?.toString().trim();
                
                if (email && password) {
                    credentials[email] = {
                        password: password,
                        name: name,
                        role: role.toUpperCase(),
                        outlets: outlets
                    };
                }
            }
        }
        
        console.log(`✅ Parsed ${Object.keys(credentials).length} HQ credentials`);
        return credentials;
    }

    /**
     * Load outlet credentials from Google Sheets
     */
    async loadOutletCredentials() {
        try {
            const rows = await this.fetchSheetData(
                CONFIG.GOOGLE_SHEETS.OUTLET_LOGIN_SHEET_ID,
                CONFIG.GOOGLE_SHEETS.OUTLET_LOGIN_RANGE
            );
            
            return this.parseOutletCredentials(rows);
            
        } catch (error) {
            console.error('❌ Failed to load outlet credentials:', error);
            
            // Fallback to hardcoded credentials for critical functionality
            return this.getFallbackOutletCredentials();
        }
    }

    /**
     * Load HQ credentials from Google Sheets
     */
    async loadHQCredentials() {
        try {
            const rows = await this.fetchSheetData(
                CONFIG.GOOGLE_SHEETS.HQ_LOGIN_SHEET_ID,
                CONFIG.GOOGLE_SHEETS.HQ_LOGIN_RANGE
            );
            
            const credentials = this.parseHQCredentials(rows);
            
            // Merge with default HQ users
            return { ...CONFIG.DEFAULT_HQ_USERS, ...credentials };
            
        } catch (error) {
            console.error('❌ Failed to load HQ credentials, using defaults:', error);
            return CONFIG.DEFAULT_HQ_USERS;
        }
    }

    /**
     * Get fallback outlet credentials (from our known list)
     */
    getFallbackOutletCredentials() {
        console.log('📋 Using fallback outlet credentials');
        
        const outletCodes = [
            'JKJSTT1', 'JKJSVR1', 'JKJBTM1', 'JKJSBZ1', 'BTTSGV1', 'BTTSSU1', 'JKJUSK1', 'BTTSB91', 'BTTSVS1', 'BTTGBI1',
            'BTTSGR1', 'JKJSTB1', 'JKJSKC1', 'JKJBGV1', 'JKJPMB1', 'BTTGBW1', 'BTTSB21', 'JKJSRR1', 'JKJSGH1', 'JBBSOC1',
            'JBBGCV1', 'JBDPAU1', 'JBDPMR1', 'JBBSMT1', 'BTTGEK1', 'JBDPSW1', 'JKJTTH1', 'JKJSRD1', 'JKJBRS1', 'JBBGCC1',
            'JKJBKB1', 'JKJPDA1', 'JBBSJB1', 'BTTSRF1', 'JKJUSI1', 'JBBGRC1', 'JKJSTS1', 'JBBSTR1', 'BTTSRG1', 'BTTGSG1',
            'JKJPMS1', 'JKJBDK1', 'BTTSRC1', 'JKJUBR1', 'JBBGBR1', 'JKJSPI1', 'JKJTPL1', 'JKJTLB1', 'JKJUTG1', 'JKJSRS1',
            'BTTGBR1', 'JBBSSR1', 'JBBGWU1', 'JKJSRM1', 'BTTSBB1', 'JBBSKP1', 'JKJBHI1', 'JBBSGI1', 'BTTGPS1', 'JKJUWB1',
            'JBBSGW1', 'BTTGPP1', 'JKJSKR1', 'JKJPSB1', 'JKJBHL1', 'JKJSBI1', 'JBBGLW1', 'JKJUPI1', 'JKJBCS1', 'JBBSCC1',
            'BTTGCR1', 'JKJSMP1', 'JKJUGK1', 'JKJPTR1', 'JKJSTM1', 'JKJTPD1', 'JBBGWC1', 'BTTGGB1', 'JKJUGB1', 'JKJUGN1',
            'JKJPMP1', 'JBBSLH1', 'BTTGKS1', 'JBBGBD1', 'JBBSJM1', 'JKJBSC1', 'JKJBPL1', 'BTTSWS1', 'BTTGPB1', 'JKJSKB1',
            'JKJSPR1', 'JBBGPS1', 'JBBGTC1', 'JBDPRK1', 'JKJTMM1', 'JBBSKH1', 'BTTGLK1', 'BTTSDL1', 'JKJUMJ1'
        ];

        const credentials = {};
        outletCodes.forEach(code => {
            credentials[code] = {
                password: 'Alpro@123',
                outletName: `APOTEK ALPRO ${code}`,
                am: 'SYSTEM AM'
            };
        });

        return credentials;
    }

    /**
     * Refresh all cached data
     */
    refreshCache() {
        console.log('🔄 Refreshing all cached data');
        this.cache.clear();
    }

    /**
     * Setup automatic cache refresh
     */
    setupAutoRefresh() {
        setInterval(() => {
            console.log('🕒 Auto-refreshing cached data');
            this.refreshCache();
        }, CONFIG.APP.DATA_REFRESH_INTERVAL);
    }
}

// Create global instance
const googleSheetsAPI = new GoogleSheetsAPI();

// Setup auto-refresh if in browser environment
if (typeof window !== 'undefined') {
    googleSheetsAPI.setupAutoRefresh();
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GoogleSheetsAPI;
}
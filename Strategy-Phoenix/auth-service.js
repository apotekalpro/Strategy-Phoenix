/**
 * Authentication Service for OKR Phoenix Project
 * Handles login, session management, and permission validation
 */

class AuthService {
    constructor() {
        this.currentUser = null;
        this.userPermissions = null;
        this.outletCredentials = {};
        this.hqCredentials = {};
        this.initialized = false;
    }

    /**
     * Initialize authentication service with Google Sheets data
     */
    async initialize() {
        try {
            console.log('🔐 Initializing Authentication Service...');
            
            // Load credentials from Google Sheets
            try {
                this.outletCredentials = await googleSheetsAPI.loadOutletCredentials();
                console.log(`✅ Loaded ${Object.keys(this.outletCredentials).length} outlet credentials`);
            } catch (outletError) {
                console.error('❌ Failed to load outlet credentials:', outletError);
                this.outletCredentials = {};
            }
            
            try {
                this.hqCredentials = await googleSheetsAPI.loadHQCredentials();
                console.log(`✅ Loaded ${Object.keys(this.hqCredentials).length} HQ credentials`);
                console.log(`📋 Available HQ users:`, Object.keys(this.hqCredentials));
            } catch (hqError) {
                console.error('❌ Failed to load HQ credentials:', hqError);
                // Use just the defaults from config
                this.hqCredentials = CONFIG.DEFAULT_HQ_USERS;
                console.log(`📋 Using default HQ users:`, Object.keys(this.hqCredentials));
            }
            
            // Check for existing session
            await this.checkExistingSession();
            
            this.initialized = true;
            console.log('✅ Authentication Service initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize Authentication Service:', error);
            // Don't throw - allow the app to work with limited functionality
            this.initialized = false;
            console.log('⚠️ Authentication Service running in fallback mode');
        }
    }

    /**
     * Check for existing user session
     */
    async checkExistingSession() {
        const userAuth = sessionStorage.getItem(CONFIG.AUTH.STORAGE_KEY);
        if (userAuth) {
            try {
                const userData = JSON.parse(userAuth);
                
                // Validate session timestamp
                const sessionAge = Date.now() - (userData.timestamp || 0);
                if (sessionAge > CONFIG.AUTH.SESSION_TIMEOUT) {
                    console.log('⏰ Session expired, clearing authentication');
                    this.logout();
                    return false;
                }
                
                this.currentUser = userData;
                this.setupUserPermissions();
                console.log('✅ Restored user session:', userData.type, userData.identifier);
                return true;
                
            } catch (error) {
                console.error('❌ Invalid session data, clearing authentication');
                this.logout();
                return false;
            }
        }
        return false;
    }

    /**
     * Authenticate user with credentials
     */
    async authenticate(username, password, userType) {
        if (!this.initialized) {
            throw new Error('Authentication service not initialized');
        }

        try {
            if (userType === 'outlet') {
                return await this.authenticateOutletUser(username, password);
            } else if (userType === 'hq') {
                return await this.authenticateHQUser(username, password);
            } else {
                throw new Error('Invalid user type');
            }
        } catch (error) {
            console.error('❌ Authentication failed:', error);
            throw error;
        }
    }

    /**
     * Authenticate outlet user
     */
    async authenticateOutletUser(outletCode, password) {
        const code = outletCode.toUpperCase().trim();
        const outlet = this.outletCredentials[code];
        
        if (!outlet) {
            throw new Error('Invalid outlet code');
        }
        
        if (outlet.password !== password) {
            throw new Error('Invalid password');
        }
        
        // Find outlet ID from our outlets list (you might need to implement this mapping)
        const outletId = this.findOutletIdByCode(code);
        
        const userData = {
            type: 'outlet',
            username: code,
            outletName: outlet.outletName,
            outletId: outletId,
            am: outlet.am,
            accessibleOutlets: [code],
            timestamp: Date.now()
        };
        
        this.currentUser = userData;
        this.setupUserPermissions();
        this.saveSession();
        
        console.log('✅ Outlet user authenticated:', code);
        return { success: true, user: userData };
    }

    /**
     * Authenticate HQ user
     */
    async authenticateHQUser(email, password) {
        const emailLower = email.toLowerCase().trim();
        const hqUser = this.hqCredentials[emailLower];
        
        if (!hqUser) {
            throw new Error('Invalid email address');
        }
        
        if (hqUser.password !== password) {
            throw new Error('Invalid password');
        }
        
        const userData = {
            type: 'hq',
            email: emailLower,
            name: hqUser.name,
            role: hqUser.role,
            accessibleOutlets: hqUser.role === 'ADMIN' ? 'ALL' : hqUser.outlets,
            timestamp: Date.now()
        };
        
        this.currentUser = userData;
        this.setupUserPermissions();
        this.saveSession();
        
        console.log('✅ HQ user authenticated:', emailLower, hqUser.role);
        return { success: true, user: userData };
    }

    /**
     * Setup user permissions based on role
     */
    setupUserPermissions() {
        if (!this.currentUser) return;

        if (this.currentUser.type === 'outlet') {
            this.userPermissions = {
                canViewAllOutlets: false,
                accessibleOutlets: this.currentUser.accessibleOutlets,
                canManageOKRs: true,
                canEditBaseline: true,
                userType: 'outlet',
                displayName: this.currentUser.outletName,
                identifier: this.currentUser.username
            };
        } else if (this.currentUser.type === 'hq') {
            this.userPermissions = {
                canViewAllOutlets: this.currentUser.accessibleOutlets === 'ALL',
                accessibleOutlets: this.currentUser.accessibleOutlets === 'ALL' ? [] : this.currentUser.accessibleOutlets,
                canManageOKRs: true,
                canEditBaseline: this.currentUser.role === 'ADMIN',
                userType: 'hq',
                displayName: this.currentUser.name,
                identifier: this.currentUser.email,
                role: this.currentUser.role
            };
        }

        console.log('🔑 User permissions set:', this.userPermissions);
    }

    /**
     * Save session to storage
     */
    saveSession() {
        if (this.currentUser) {
            sessionStorage.setItem(CONFIG.AUTH.STORAGE_KEY, JSON.stringify(this.currentUser));
        }
    }

    /**
     * Logout user
     */
    logout() {
        this.currentUser = null;
        this.userPermissions = null;
        sessionStorage.removeItem(CONFIG.AUTH.STORAGE_KEY);
        console.log('👋 User logged out');
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return this.currentUser !== null;
    }

    /**
     * Get current user
     */
    getCurrentUser() {
        return this.currentUser;
    }

    /**
     * Get user permissions
     */
    getUserPermissions() {
        return this.userPermissions;
    }

    /**
     * Check if user has permission to access outlet
     */
    canAccessOutlet(outletCode) {
        if (!this.userPermissions) return false;
        
        if (this.userPermissions.canViewAllOutlets) return true;
        
        return this.userPermissions.accessibleOutlets.includes(outletCode);
    }

    /**
     * Filter outlets based on user permissions
     */
    filterOutletsByPermission(outlets) {
        if (!this.userPermissions) return [];
        
        if (this.userPermissions.canViewAllOutlets) {
            return outlets; // Admin sees all
        }
        
        return outlets.filter(outlet => 
            this.userPermissions.accessibleOutlets.includes(outlet.code)
        );
    }

    /**
     * Validate session and redirect if needed
     */
    validateSessionOrRedirect() {
        if (!this.isAuthenticated()) {
            window.location.href = 'okr-login.html';
            return false;
        }
        return true;
    }

    /**
     * Find outlet ID by code (helper method)
     */
    findOutletIdByCode(code) {
        // This is a simple mapping - in production you might want to load this from Google Sheets too
        const outletCodes = [
            'JKJSTT1', 'JKJSVR1', 'JKJBTM1', 'JKJSBZ1', 'BTTSGV1', 'BTTSSU1', 'JKJUSK1', 'BTTSB91', 'BTTSVS1', 'BTTGBI1',
            'BTTSGR1', 'JKJSTB1', 'JKJSKC1', 'JKJBGV1', 'JKJPMB1', 'BTTGBW1', 'BTTSB21', 'JKJSRR1', 'JKJSGH1', 'JBBSOC1'
            // ... add more as needed
        ];
        
        const index = outletCodes.findIndex(c => c === code);
        return index >= 0 ? index + 1 : Math.floor(Math.random() * 1000) + 1;
    }

    /**
     * Refresh credentials from Google Sheets
     */
    async refreshCredentials() {
        console.log('🔄 Refreshing authentication credentials');
        googleSheetsAPI.refreshCache();
        this.outletCredentials = await googleSheetsAPI.loadOutletCredentials();
        this.hqCredentials = await googleSheetsAPI.loadHQCredentials();
        console.log('✅ Credentials refreshed');
    }
}

// Create global instance
const authService = new AuthService();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthService;
}
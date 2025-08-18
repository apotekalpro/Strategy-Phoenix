// Configuration for OKR Phoenix Project
const CONFIG = {
    // Google Sheets Configuration
    GOOGLE_SHEETS: {
        // Main login credentials sheet
        OUTLET_LOGIN_SHEET_ID: '1wCvZ1WAlHAn-B8UPP5AUEPzQ5Auf84BJFeG48Hlo9wE',
        OUTLET_LOGIN_RANGE: 'Sheet1!A1:D300', // Column A: outlet codes, Column D: passwords (fetches up to row 300 to ensure all data)
        
        // HQ login sheet (if separate sheet exists)
        HQ_LOGIN_SHEET_ID: '1wCvZ1WAlHAn-B8UPP5AUEPzQ5Auf84BJFeG48Hlo9wE',
        HQ_LOGIN_RANGE: 'HQLogin!B:H', // Column B: emails, Column H: passwords
        
        // API key for Google Sheets API (public read-only)
        // IMPORTANT: Replace 'YOUR_GOOGLE_SHEETS_API_KEY_HERE' with your actual Google Sheets API key
        // to enable live data integration. Get it from: https://console.cloud.google.com/
        API_KEY: 'AIzaSyCzDDSYZPknm2MOZIp5nLvfkmKBHCj8xEY', // Replace with actual API key
        
        // Alternative CSV export URLs for fallback
        OUTLET_CSV_URL: 'https://docs.google.com/spreadsheets/d/1wCvZ1WAlHAn-B8UPP5AUEPzQ5Auf84BJFeG48Hlo9wE/export?format=csv'
        
        // Base URL for Google Sheets API
        BASE_URL: 'https://sheets.googleapis.com/v4/spreadsheets'
    },
    
    // Application Settings
    APP: {
        NAME: 'OKR Phoenix Project',
        VERSION: '2.0.0',
        DESCRIPTION: 'Transaction Improvement Dashboard',
        
        // Data refresh intervals (in milliseconds)
        DATA_REFRESH_INTERVAL: 5 * 60 * 1000, // 5 minutes
        CACHE_DURATION: 10 * 60 * 1000, // 10 minutes
        
        // UI Settings
        CARDS_PER_ROW: {
            MIN_WIDTH: 280,
            MAX_WIDTH: 320,
            GAP: 20
        }
    },
    
    // Authentication Settings
    AUTH: {
        SESSION_TIMEOUT: 8 * 60 * 60 * 1000, // 8 hours
        STORAGE_KEY: 'userAuth',
        PERFORMANCE_DATA_KEY: 'outletPerformanceData'
    },
    
    // Phoenix Project OKR Templates
    OKR_TEMPLATES: [
        {
            id: 1,
            title: 'Peningkatan Transaksi - Trafik Baru',
            description: 'Meningkatkan jumlah transaksi melalui penambahan trafik pelanggan baru',
            category: 'traffic',
            keyResults: [
                {
                    id: 1,
                    title: 'KR1: Peningkatan Jumlah Pelanggan Baru',
                    description: 'Meningkatkan jumlah pelanggan baru sebesar 20%',
                    target: 20,
                    unit: 'percent',
                    actionPlans: [
                        'Implementasi program welcome offer untuk pelanggan baru',
                        'Kampanye digital marketing di media sosial lokal',
                        'Partnership dengan komunitas sekitar (RT/RW, klinik)',
                        'Program referral dengan reward untuk pelanggan existing'
                    ]
                },
                {
                    id: 2,
                    title: 'KR2: Program Referral',
                    description: 'Implementasi program referral yang efektif',
                    target: 100,
                    unit: 'setup',
                    actionPlans: [
                        'Desain sistem poin reward untuk referral',
                        'Training staff untuk menjelaskan program referral',
                        'Buat material promosi program referral',
                        'Tracking dan monitoring efektivitas program'
                    ]
                },
                {
                    id: 3,
                    title: 'KR3: Digital Marketing',
                    description: 'Kampanye marketing digital yang efektif',
                    target: 100,
                    unit: 'setup',
                    actionPlans: [
                        'Setup dan optimasi Google My Business',
                        'Konten marketing di Instagram dan Facebook',
                        'Program WhatsApp Business untuk customer service',
                        'Review dan testimoni management'
                    ]
                }
            ]
        },
        {
            id: 2,
            title: 'Peningkatan Transaksi - Return Rate',
            description: 'Meningkatkan frekuensi kunjungan pelanggan existing',
            category: 'retention',
            keyResults: [
                {
                    id: 1,
                    title: 'KR1: Customer Loyalty Program',
                    description: 'Implementasi program loyalitas pelanggan',
                    target: 100,
                    unit: 'setup',
                    actionPlans: [
                        'Desain dan implementasi membership card system',
                        'Setup point reward system untuk repeat purchase',
                        'Training staff untuk promosi membership',
                        'Tracking customer visit frequency'
                    ]
                },
                {
                    id: 2,
                    title: 'KR2: Follow-up System',
                    description: 'Sistem follow-up otomatis untuk pelanggan',
                    target: 100,
                    unit: 'setup',
                    actionPlans: [
                        'Setup WhatsApp Business API untuk follow-up',
                        'Buat template pesan follow-up untuk berbagai kondisi',
                        'Training staff untuk customer relationship management',
                        'Monthly review dan optimasi follow-up strategy'
                    ]
                }
            ]
        },
        {
            id: 3,
            title: 'Optimalisasi Operasional',
            description: 'Meningkatkan efisiensi operasional dan kualitas layanan',
            category: 'operational',
            keyResults: [
                {
                    id: 1,
                    title: 'KR1: Reduce Waiting Time',
                    description: 'Mengurangi waktu tunggu pelayanan sebesar 25%',
                    target: 25,
                    unit: 'percent',
                    actionPlans: [
                        'Implementasi queue management system',
                        'Optimasi layout counter dan waiting area',
                        'Staff scheduling optimization pada peak hours',
                        'Express lane untuk resep sederhana'
                    ]
                },
                {
                    id: 2,
                    title: 'KR2: Service Quality Improvement',
                    description: 'Peningkatan rating kepuasan pelanggan',
                    target: 90,
                    unit: 'percent',
                    actionPlans: [
                        'Staff training untuk customer service excellence',
                        'Implementasi feedback system dari pelanggan',
                        'Standard operating procedure untuk pelayanan',
                        'Monthly service quality assessment'
                    ]
                }
            ]
        }
    ],
    
    // Default HQ users (fallback if Google Sheets HQ data not available)
    DEFAULT_HQ_USERS: {
        'khoo.ziyu@apotekalpro.id': { 
            password: 'Alpro@123', 
            name: 'KHOO ZI YU', 
            role: 'ADMIN',
            outlets: [] // empty means access to all outlets
        },
        'admin@alpro.com': { 
            password: 'AdminPass123', 
            name: 'SYSTEM ADMIN', 
            role: 'ADMIN',
            outlets: []
        }
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}

// Make CONFIG globally available for browser environments
if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
    window.APP_CONFIG = CONFIG; // Alternative name for compatibility
}

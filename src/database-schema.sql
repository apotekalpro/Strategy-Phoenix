-- Phoenix OKR Database Schema for Cloudflare D1
-- This creates the necessary tables for storing OKR data

-- Main data table (stores all phoenix data as JSON)
CREATE TABLE IF NOT EXISTS phoenix_data (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Backup table (stores historical versions)
CREATE TABLE IF NOT EXISTS phoenix_backups (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Outlets table (normalized structure for better queries)
CREATE TABLE IF NOT EXISTS outlets (
    code TEXT PRIMARY KEY,
    name TEXT,
    objective TEXT,
    description TEXT,
    key_results TEXT, -- JSON array
    action_plans TEXT, -- JSON object
    performance_data TEXT, -- JSON object
    comments TEXT, -- JSON array
    date_added TEXT NOT NULL,
    last_modified TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Performance tracking table
CREATE TABLE IF NOT EXISTS performance_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    outlet_code TEXT NOT NULL,
    term TEXT NOT NULL, -- 'baseline', 'term1', 'term2', 'term3'
    revenue INTEGER,
    trano INTEGER,
    recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (outlet_code) REFERENCES outlets (code)
);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    outlet_code TEXT NOT NULL,
    comment TEXT NOT NULL,
    author TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (outlet_code) REFERENCES outlets (code)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_outlets_last_modified ON outlets(last_modified);
CREATE INDEX IF NOT EXISTS idx_performance_outlet ON performance_logs(outlet_code);
CREATE INDEX IF NOT EXISTS idx_comments_outlet ON comments(outlet_code);
CREATE INDEX IF NOT EXISTS idx_backups_created ON phoenix_backups(created_at);

-- Insert default/sample data if needed
INSERT OR IGNORE INTO phoenix_data (id, data, updated_at) 
VALUES ('main', '{"outlets":{}}', CURRENT_TIMESTAMP);
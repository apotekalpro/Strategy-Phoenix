module.exports = {
  apps: [{
    name: 'phoenix-live-backend',
    script: 'api-server.js',
    cwd: '/home/user/webapp',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development',
      PORT: 3000,
      NAME: 'Phoenix Live Backend'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
      NAME: 'Phoenix Live Backend Production'
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    time: true
  }]
};

module.exports = {
  apps: [{
    name: 'wayahe-backend',
    cwd: '/home/ubuntu/wayahetopup1/backend',
    script: 'dist/index.js',
    exec_mode: 'fork',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: { NODE_ENV: 'production', PORT: 4000 }
  }]
};

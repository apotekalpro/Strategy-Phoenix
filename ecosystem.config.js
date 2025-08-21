module.exports = {
  apps: [{
    name: "phoenix-test-server",
    script: "python3",
    args: "-m http.server 8080",
    cwd: "/home/user/webapp",
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: "1G"
  }]
}

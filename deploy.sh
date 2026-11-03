#!/bin/bash

# Gym Tracker Deployment Helper Script
# Usage: ./deploy.sh [check|setup-nginx|setup-cloudflare|backup]

PROJECT_DIR="/home/muthi/Documents/001. Pribadi/4. Project/gym-asistant"
NGINX_CONF="/etc/nginx/sites-available/gym-tracker"

function check_environment() {
    echo "🔍 Checking Gym Tracker Environment..."
    echo "===================================="
    
    # Check project files
    echo "📁 Project Files:"
    ls -la "$PROJECT_DIR" | grep -E "(index.html|README.md|DEPLOYMENT.md)" && echo "✓ Core files present"
    
    # Check if nginx is installed
    echo -n "🌐 Nginx: "
    if command -v nginx >/dev/null 2>&1; then
        echo "✓ Installed"
        nginx -t 2>/dev/null && echo "✓ Configuration valid" || echo "✗ Configuration invalid"
    else
        echo "✗ Not installed"
    fi
    
    # Check cloudflared
    echo -n "🔗 Cloudflare Tunnel: "
    if command -v cloudflared >/dev/null 2>&1; then
        echo "✓ Installed"
        
        # Check if tunnel is running
        if pgrep -f cloudflared >/dev/null; then
            echo "✓ Running"
        else
            echo "✗ Not running"
        fi
    else
        echo "✗ Not installed"
    fi
    
    # Check current day auto-selection
    echo -n "📅 Auto-day selection: "
    if grep -q "getTodayDayNumber" "$PROJECT_DIR/index.html"; then
        echo "✓ Implemented"
    else
        echo "✗ Missing"
    fi
    
    # Check fun mode
    echo -n "🎨 Fun mode: "
    if grep -q "Ctrl\+Shift\+F" "$PROJECT_DIR/index.html" || grep -q "Ctrl+Shift+F" "$PROJECT_DIR/index.html" || grep -q "fun-mode" "$PROJECT_DIR/index.html"; then
        echo "✓ Implemented"
    else
        echo "✗ Missing"
    fi
    
    # Check responsiveness
    echo -n "📱 Mobile responsive: "
    if grep -q "@media (max-width: 480px)" "$PROJECT_DIR/index.html"; then
        echo "✓ Implemented"
    else
        echo "✗ Missing"
    fi
}

function setup_nginx() {
    echo "🌐 Setting up Nginx..."
    
    # Install nginx if not present
    if ! command -v nginx >/dev/null 2>&1; then
        echo "Installing nginx..."
        sudo apt update
        sudo apt install nginx -y
    fi
    
    # Create nginx configuration
    sudo tee "$NGINX_CONF" > /dev/null << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name YOUR_DOMAIN_HERE;

    root /home/muthi/Documents/001. Pribadi/4. Project/gym-asistant;
    index index.html;
    try_files $uri $uri/ =404;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Cache static files
    location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
EOF
    
    # Enable site
    sudo ln -sf "$NGINX_CONF" "/etc/nginx/sites-enabled/"
    sudo nginx -t
    
    if [ $? -eq 0 ]; then
        sudo systemctl restart nginx
        echo "✅ Nginx configured successfully!"
        echo "   Please edit $NGINX_CONF to set your domain name"
    else
        echo "❌ Nginx configuration failed"
        exit 1
    fi
}

function setup_cloudflare() {
    echo "🔗 Setting up Cloudflare Tunnel..."
    
    if ! command -v cloudflared >/dev/null 2>&1; then
        echo "Installing cloudflared..."
        wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
        sudo dpkg -i cloudflared-linux-amd64.deb
    fi
    
    echo "Please run the following commands manually:"
    echo "1. Login to Cloudflare:"
    echo "   cloudflared tunnel login"
    echo ""
    echo "2. Create a tunnel:"
    echo "   cloudflared tunnel create gym-tracker"
    echo ""
    echo "3. Create config file (~/.cloudflared/config.yml):"
    echo "   tunnel: gym-tracker"
    echo "   credentials-file: ~/.cloudflared/[credentials-file]"
    echo ""
    echo "4. Run tunnel (in background):"
    echo "   cloudflared tunnel run --config ~/.cloudflared/config.yml"
    echo ""
    echo "After setup, update DNS with Cloudflare proxying enabled."
}

function backup_data() {
    echo "💾 Creating backup..."
    
    BACKUP_DIR="/home/muthi/gym-tracker-backup-$(date +%Y%m%d)"
    mkdir -p "$BACKUP_DIR"
    
    # Copy project files
    cp -r "$PROJECT_DIR"/* "$BACKUP_DIR/" 2>/dev/null
    
    echo "✅ Backup created at: $BACKUP_DIR"
    echo "   Files backed up:"
    ls -la "$BACKUP_DIR" | awk '{print "   " $9}'
}

# Main execution
function main() {
    case "$1" in
        "check")
            check_environment
            ;;
        "setup-nginx")
            setup_nginx
            ;;
        "setup-cloudflare")
            setup_cloudflare
            ;;
        "backup")
            backup_data
            ;;
        *)
            echo "Usage: $0 [check|setup-nginx|setup-cloudflare|backup]"
            echo ""
            echo "Commands:"
            echo "  check          Check current setup and environment"
            echo "  setup-nginx    Install and configure nginx"
            echo "  setup-cloudflare Setup Cloudflare tunnel (requires manual steps)"
            echo "  backup         Create backup of current data"
            ;;
    esac
}

main "$@"

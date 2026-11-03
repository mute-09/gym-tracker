# Gym Tracker - Enhanced Edition

## Key Improvements

### 🎨 UI Enhancements
- **Fun Color Mode**: Press `Ctrl+Shift+F` to toggle between normal and fun pastel color themes
- **Improved Responsiveness**: Enhanced breakpoints for better mobile experience
- **Touch Optimized**: Special styling for touch devices
- **Animation Feedback**: Smooth transitions and hover effects

### 📅 Smart Features
- **Auto-Select Today**: Automatically highlights the current day (e.g., if today is Tuesday, shows Tuesday workout)
- **Progress Comparison**: Shows last week's Tuesday data to track improvements
- **Real-time Date Display**: Shows full date with weekday in workout header
- **Smart Status Indicators**: "Today" badge for current day workouts

### 🚀 Performance & UX
- **Sticky Sidebar**: Progress panel stays visible on desktop
- **Compact Mobile Layout**: Optimized for screens under 480px
- **Touch-Friendly Buttons**: Larger tap targets on mobile
- **Auto-save**: All changes saved to localStorage automatically

## Deployment to Lenovo with Cloudflare

### Prerequisites
- Lenovo server with SSH access
- Root user credentials
- Domain name for SSL

### Setup Steps

#### 1. Install Nginx
```bash
# Update package list
sudo apt update
sudo apt upgrade -y

# Install nginx
sudo apt install nginx -y

# Start and enable nginx service
sudo systemctl start nginx
sudo systemctl enable nginx
```

#### 2. Configure Nginx
```bash
# Edit nginx config
sudo nano /etc/nginx/sites-available/gym-tracker

# Add the following configuration:
server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com;

    location / {
        root /home/muthi/Documents/001. Pribadi/4. Project/gym-asistant;
        index index.html;
        try_files $uri $uri/ =404;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Cache static files
    location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

#### 3. Set up Reverse Proxy with Cloudflare

Create a Cloudflare Tunnel:
```bash
# Install cloudflared
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb

# Login to Cloudflare
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create gym-tracker

# Create config file
cat > ~/.cloudflared/config.yml << EOF
tunnel: gym-tracker
credentials-file: ~/.cloudflared/[credentials-file]

ingress:
  - hostname: your-domain.com
    service: http://localhost:80
    origin_request:
      no_tls_verify: true
  - service: http_status:404
EOF

# Run tunnel in background
cloudflared tunnel run --config ~/.cloudflared/config.yml
```

#### 4. Firewall Configuration
```bash
# Open necessary ports
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow ssh

# Enable firewall
sudo ufw enable
```

### SSL Certificate (Optional)
```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d your-domain.com
```

### Data Backup
```bash
# Backup data (home directory contains index.html and localStorage data)
cp -r /home/muthi/Documents/001. Pribadi/4. Project/gym-asistant /home/muthi/gym-tracker-backup

# Or commit to git if using version control
git add .
git commit -m "Save progress before deployment"
git push
```

### Maintenance
```bash
# Check nginx status
sudo systemctl status nginx

# Check cloudflared status
cs cloudflared tunnel list

# View logs
sudo tail -f /var/log/nginx/error.log
tail -f ~/.cloudflared/log.json

# Restart services
sudo systemctl restart nginx
cloudflared tunnel restart gym-tracker
```

## Keyboard Shortcuts

- `Ctrl+Shift+F`: Toggle fun color mode
- `Ctrl+Shift+I`: Open developer tools (F12)
- `Ctrl+S`: Save (though auto-saves are enabled)

## Mobile Usage Tips

- Tap days to select workouts
- Pinch to zoom on charts (if added)
- Swipe between weeks
- Use fun mode for a more engaging experience

## Troubleshooting

**Common Issues:**
- **Fun mode not working**: Refresh the page after toggling
- **Mobile layout issues**: Try clearing browser cache
- **Cloudflare tunnel not connecting**: Check credentials file
- **LocalStorage full**: Clear browser storage and test again

**Debug Commands:**
```bash
# Check if files are accessible
ls -la /home/muthi/Documents/001. Pribadi/4. Project/gym-asistant/

# Test nginx configuration
sudo nginx -t

# Check if cloudflared is running
ps aux | grep cloudflared
```

## Support

For issues with this setup, refer to the deployment guide or check the documentation in the repository.

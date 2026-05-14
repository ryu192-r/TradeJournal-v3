#!/bin/bash

# Setup cron jobs for Trading Journal v3 automated backups

set -euo pipefail

# Configuration
CRON_FILE="/etc/cron.d/trading-journal-v3"
SCRIPT_DIR="/root/projects/Trading Journal v3/scripts"
LOG_DIR="/var/log/trading-journal"
BACKUP_TIME="10 00 * * *"  # Daily at 00:10 UTC (market close)

# Create log directory
mkdir -p "$LOG_DIR"
chmod 755 "$LOG_DIR"

# Create cron file
echo "Setting up cron jobs for Trading Journal v3..."

cat > "$CRON_FILE" << 'EOF'
# Trading Journal v3 automated backups
# Daily backup at market close (00:10 UTC)
10 00 * * * root /usr/bin/python3 /root/projects/Trading\ Journal\ v3/scripts/daily_backup.py >> /var/log/trading-journal/backup.log 2>&1

# Log rotation - keep last 30 days of logs
00 01 * * * root find /var/log/trading-journal -name "*.log" -mtime +30 -delete
EOF

# Set permissions
chmod 644 "$CRON_FILE"
chown root:root "$CRON_FILE"

echo "✅ Cron jobs installed:"
echo "   - Daily backup: 00:10 UTC"
echo "   - Log rotation: 01:00 UTC"
echo "   - Logs: /var/log/trading-journal/backup.log"

echo "📋 To verify cron jobs:"
echo "   cat /etc/cron.d/trading-journal-v3"

echo "🔄 To manually run backup:"
echo "   /usr/bin/python3 \"/root/projects/Trading Journal v3/scripts/daily_backup.py\""

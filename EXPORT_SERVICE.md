# Trading Journal v3 - Export/Backup Service

## Overview

This service provides CSV export functionality and automated Telegram backups for Trading Journal v3.

## Features

### 1. CSV Export Endpoint
- **URL**: `GET /api/v1/export/csv`
- **Parameters**:
  - `from_date` (optional): ISO date (YYYY-MM-DD) for start date filter
  - `to_date` (optional): ISO date (YYYY-MM-DD) for end date filter
  - `status` (optional): Filter by trade status
- **Response**: CSV file download with all trades

### 2. Telegram Backup Endpoint
- **URL**: `POST /api/v1/export/backup`
- **Parameters**:
  - `chat_id` (optional): Override default Telegram chat ID
  - `summary_text` (optional): Custom summary text (default: "Manual Trading Journal Backup")
- **Response**: JSON with backup status

### 3. Automated Daily Backup
- Scheduled via cron at 00:10 UTC (market close)
- Sends all trades as CSV to configured Telegram chat
- Includes summary text with date

## Files

### Service Implementation
- `backend/app/services/export_service.py` - Core export logic
- `backend/app/routers/export.py` - FastAPI endpoints

### Configuration
- `backend/app/core/config.py` - Telegram and backup settings
- `.env.example` - Environment variable templates

### Automation
- `scripts/daily_backup.py` - Daily backup script
- `scripts/setup_cron.sh` - Cron job setup
- `scripts/test_export.py` - Test script

## Setup

### 1. Environment Variables

Add to your `.env` file:

```env
# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here

# Backup settings
BACKUP_DIR=/backups
MAX_BACKUPS=30
```

### 2. Install Dependencies

```bash
cd /root/projects/"Trading Journal v3"/backend
pip install -r requirements.txt
```

### 3. Setup Cron Jobs

```bash
sudo /root/projects/"Trading Journal v3"/scripts/setup_cron.sh
```

### 4. Test the Service

```bash
# Test export functionality
/usr/bin/python3 /root/projects/"Trading Journal v3"/scripts/test_export.py

# Manual backup
/usr/bin/python3 /root/projects/"Trading Journal v3"/scripts/daily_backup.py
```

## CSV Format

The CSV format matches the T10 import format for round-trip compatibility:

```csv
symbol,direction,entry_price,quantity,entry_time,exit_price,exit_time,fees,setup,tactic,stop_price,target_price,r_multiple,status,notes,pnl,exit_reason,review_notes,tags,review_tags
```

## API Usage Examples

### Export CSV

```bash
curl -X GET "http://localhost:8000/api/v1/export/csv?from_date=2024-01-01&to_date=2024-01-31" \
     -H "accept: text/csv" \
     --output trades_export.csv
```

### Trigger Telegram Backup

```bash
curl -X POST "http://localhost:8000/api/v1/export/backup" \
     -H "Content-Type: application/json" \
     -d '{"chat_id": "123456789", "summary_text": "Weekly backup"}'
```

## Health Check

```bash
curl -X GET "http://localhost:8000/api/v1/export/health"
```

## Troubleshooting

### Telegram Backup Fails

1. Verify `TELEGRAM_BOT_TOKEN` is correct
2. Verify `TELEGRAM_CHAT_ID` is correct
3. Check bot has permission to send messages to the chat
4. Check network connectivity to Telegram API

### CSV Export Empty

1. Verify there are trades in the database
2. Check status filters (deleted trades are excluded by default)
3. Verify date format is YYYY-MM-DD

### Cron Jobs Not Running

1. Check cron service is running: `sudo service cron status`
2. Verify cron file exists: `cat /etc/cron.d/trading-journal-v3`
3. Check logs: `tail -f /var/log/trading-journal/backup.log`

## Security

- Telegram bot token is read from environment variables
- Never commit real `.env` files to version control
- Use HTTPS for all API endpoints in production
- Validate all input parameters

## Error Handling

- Invalid date formats return 400 Bad Request
- Missing Telegram configuration returns 400 Bad Request
- Empty exports return 404 Not Found
- Telegram API failures return 500 Internal Server Error

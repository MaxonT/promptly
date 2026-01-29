#!/bin/bash

# Keep-alive script for Render deployment
# Pings the backend service every 10 minutes to prevent cold start
# Features: retry mechanism, failure notifications, detailed logging

SERVICE_URL="https://promptly-v0-6-cloudtest-cursor-dev.onrender.com"
LOG_FILE="$HOME/.promptly-keepalive.log"
HEALTH_ENDPOINT="/api/health"
MAX_RETRIES=3
RETRY_DELAY=2
TIMEOUT=15

# Function to log messages with timestamp
log_message() {
    local msg="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $msg" >> "$LOG_FILE"
}

# Function to send desktop notification (macOS)
send_notification() {
    local title="$1"
    local message="$2"
    
    if command -v osascript &> /dev/null; then
        osascript -e "display notification \"$message\" with title \"Promptly Keep-Alive\""
    fi
}

# Function to perform single ping attempt
ping_service() {
    local attempt=$1
    local response=$(curl -s -o /dev/null -w "%{http_code}" -m "$TIMEOUT" "$SERVICE_URL$HEALTH_ENDPOINT" 2>/dev/null)
    
    echo "$response"
}

# Initialize log file if it doesn't exist
if [ ! -f "$LOG_FILE" ]; then
    touch "$LOG_FILE"
    log_message "🚀 Keep-alive service started (v1.1 with retry & notifications)"
    log_message "Service URL: $SERVICE_URL"
    log_message "Retry mechanism: $MAX_RETRIES attempts, $RETRY_DELAY sec delay"
fi

# Ping service with retry logic
attempt=1
success=false

while [ $attempt -le $MAX_RETRIES ] && [ "$success" = "false" ]; do
    response=$(ping_service "$attempt")
    
    if [ "$response" = "200" ]; then
        if [ $attempt -eq 1 ]; then
            log_message "✓ Service pinged successfully on first attempt (HTTP 200)"
        else
            log_message "✓ Service pinged successfully after $attempt attempts (HTTP 200)"
        fi
        success=true
    else
        if [ $attempt -lt $MAX_RETRIES ]; then
            log_message "⚠ Attempt $attempt failed (HTTP $response), retrying in ${RETRY_DELAY}s..."
            sleep "$RETRY_DELAY"
        else
            log_message "❌ ALL $MAX_RETRIES ATTEMPTS FAILED (Last: HTTP $response)"
            send_notification "Ping Failed" "After $MAX_RETRIES attempts, service is not responding (HTTP $response)"
        fi
    fi
    
    attempt=$((attempt + 1))
done

# Final status
if [ "$success" = "true" ]; then
    # Log response time if curl supports it
    response_time=$(curl -s -o /dev/null -w "%{time_total}" -m "$TIMEOUT" "$SERVICE_URL$HEALTH_ENDPOINT" 2>/dev/null)
    log_message "Response time: ${response_time}s"
else
    exit 1
fi

exit 0

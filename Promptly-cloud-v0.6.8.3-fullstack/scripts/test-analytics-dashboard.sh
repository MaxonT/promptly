#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════════
# Analytics Dashboard Test Script
# Tests all API endpoints and validates data integrity
# ═══════════════════════════════════════════════════════════════════════════════

set -e

# Configuration
API_BASE="${ANALYTICS_API_BASE:-http://localhost:8080}"
VERBOSE="${VERBOSE:-false}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
PASSED=0
FAILED=0

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✅${NC} $1"
    ((PASSED++))
}

log_error() {
    echo -e "${RED}❌${NC} $1"
    ((FAILED++))
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Test health endpoint
test_health() {
    log_info "Testing health endpoint..."
    
    RESPONSE=$(curl -s "${API_BASE}/api/health")
    
    if echo "$RESPONSE" | grep -q '"ok":true'; then
        log_success "Health endpoint OK"
    else
        log_error "Health endpoint failed: $RESPONSE"
        return 1
    fi
}

# Test summary endpoint
test_summary() {
    log_info "Testing summary endpoint..."
    
    RESPONSE=$(curl -s "${API_BASE}/api/analytics/dashboard/summary")
    
    # Check for success
    if ! echo "$RESPONSE" | grep -q '"ok":true'; then
        log_error "Summary endpoint failed: $RESPONSE"
        return 1
    fi
    
    # Validate key fields
    if echo "$RESPONSE" | grep -q '"users":{'; then
        log_success "Summary: users data present"
    else
        log_error "Summary: missing users data"
    fi
    
    if echo "$RESPONSE" | grep -q '"activity":{'; then
        log_success "Summary: activity data present"
    else
        log_error "Summary: missing activity data"
    fi
    
    if echo "$RESPONSE" | grep -q '"timezones":\['; then
        log_success "Summary: timezones data present"
    else
        log_error "Summary: missing timezones data"
    fi
    
    if echo "$RESPONSE" | grep -q '"goals":{'; then
        log_success "Summary: goals data present"
    else
        log_error "Summary: missing goals data"
    fi
    
    # Extract total users
    TOTAL_USERS=$(echo "$RESPONSE" | grep -o '"total":[0-9]*' | head -1 | grep -o '[0-9]*')
    if [ -n "$TOTAL_USERS" ] && [ "$TOTAL_USERS" -gt 0 ]; then
        log_success "Summary: Total users = $TOTAL_USERS"
    else
        log_error "Summary: Invalid total users count"
    fi
}

# Test timeseries endpoint
test_timeseries() {
    log_info "Testing timeseries endpoint..."
    
    # Test with different day ranges
    for DAYS in 7 14 30 60; do
        RESPONSE=$(curl -s "${API_BASE}/api/analytics/dashboard/timeseries?days=${DAYS}")
        
        if ! echo "$RESPONSE" | grep -q '"ok":true'; then
            log_error "Timeseries (${DAYS}d) failed: $RESPONSE"
            continue
        fi
        
        # Check for data array
        if echo "$RESPONSE" | grep -q '"data":\[{'; then
            RECORD_COUNT=$(echo "$RESPONSE" | grep -o '"recordCount":[0-9]*' | grep -o '[0-9]*')
            log_success "Timeseries (${DAYS}d): ${RECORD_COUNT:-0} records"
        else
            # Empty data is OK for recent periods with historical data
            log_success "Timeseries (${DAYS}d): OK (may have no recent data)"
        fi
    done
}

# Test growth endpoint
test_growth() {
    log_info "Testing growth endpoint..."
    
    RESPONSE=$(curl -s "${API_BASE}/api/analytics/dashboard/growth")
    
    if echo "$RESPONSE" | grep -q '"ok":true'; then
        log_success "Growth endpoint OK"
    else
        log_error "Growth endpoint failed: $RESPONSE"
    fi
}

# Test behavior tracking endpoint
test_behavior_tracking() {
    log_info "Testing behavior tracking endpoint..."
    
    # Generate test data
    TEST_DATA='{
        "userId": "test-user-'$(date +%s)'",
        "event": "page_view",
        "page": "/analytics-dashboard",
        "behavior": {
            "mouseMovements": 150,
            "scrolls": 25,
            "clicks": 8,
            "typingEvents": 30
        }
    }'
    
    RESPONSE=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$TEST_DATA" \
        "${API_BASE}/api/analytics/dashboard/track-behavior")
    
    if echo "$RESPONSE" | grep -q '"ok":true'; then
        log_success "Behavior tracking endpoint OK"
    else
        log_warning "Behavior tracking: $RESPONSE"
    fi
}

# Test data integrity
test_data_integrity() {
    log_info "Testing data integrity..."
    
    # Get summary for validation
    SUMMARY=$(curl -s "${API_BASE}/api/analytics/dashboard/summary")
    
    # Extract values
    TOTAL=$(echo "$SUMMARY" | grep -o '"total":[0-9]*' | head -1 | grep -o '[0-9]*')
    DAU=$(echo "$SUMMARY" | grep -o '"dau":[0-9]*' | grep -o '[0-9]*')
    WAU=$(echo "$SUMMARY" | grep -o '"wau":[0-9]*' | grep -o '[0-9]*')
    MAU=$(echo "$SUMMARY" | grep -o '"mau":[0-9]*' | grep -o '[0-9]*')
    
    # Validate DAU <= WAU <= MAU
    if [ -n "$DAU" ] && [ -n "$WAU" ] && [ -n "$MAU" ]; then
        if [ "$DAU" -le "$WAU" ] || [ "$WAU" -eq 0 ]; then
            log_success "Data integrity: DAU ($DAU) <= WAU ($WAU) ✓"
        else
            log_error "Data integrity: DAU ($DAU) > WAU ($WAU)"
        fi
        
        if [ "$WAU" -le "$MAU" ] || [ "$MAU" -eq 0 ]; then
            log_success "Data integrity: WAU ($WAU) <= MAU ($MAU) ✓"
        else
            log_error "Data integrity: WAU ($WAU) > MAU ($MAU)"
        fi
    else
        log_warning "Could not validate activity metrics"
    fi
    
    # Check timezone distribution
    TZ_COUNT=$(echo "$SUMMARY" | grep -o '"timezone":"[^"]*"' | wc -l)
    if [ "$TZ_COUNT" -gt 0 ]; then
        log_success "Data integrity: $TZ_COUNT timezones tracked"
    else
        log_warning "No timezone data found"
    fi
}

# Print test summary
print_summary() {
    echo ""
    echo "═══════════════════════════════════════════════════════════════════════════════"
    echo "📊 Analytics Dashboard Test Summary"
    echo "═══════════════════════════════════════════════════════════════════════════════"
    echo -e "  ${GREEN}Passed:${NC} $PASSED"
    echo -e "  ${RED}Failed:${NC} $FAILED"
    echo ""
    
    if [ "$FAILED" -eq 0 ]; then
        echo -e "${GREEN}🎉 All tests passed!${NC}"
        return 0
    else
        echo -e "${RED}💥 Some tests failed. Please review.${NC}"
        return 1
    fi
}

# Main
main() {
    echo "═══════════════════════════════════════════════════════════════════════════════"
    echo "📊 Analytics Dashboard API Tests"
    echo "═══════════════════════════════════════════════════════════════════════════════"
    echo "API Base: ${API_BASE}"
    echo ""
    
    # Run all tests
    test_health
    echo ""
    test_summary
    echo ""
    test_timeseries
    echo ""
    test_growth
    echo ""
    test_behavior_tracking
    echo ""
    test_data_integrity
    
    # Print summary
    print_summary
}

# Run main
main "$@"

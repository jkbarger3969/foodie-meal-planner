#!/bin/bash

###############################################################################
# BULK RECIPE SCRAPER - RUN AND DATABASE MANAGEMENT SCRIPT
# 
# This script provides commands to:
# 1. Run the bulk recipe scraper
# 2. Analyze scraped data
# 3. Backup and replace databases
# 4. Check statistics
###############################################################################

set -e  # Exit on error

PROJECT_DIR="/Users/keithbarger/Projects/foodie-meal-planner-desktop"
SCRAPED_DB="$PROJECT_DIR/data/foodie-scraped.sqlite"
MAIN_DB="$PROJECT_DIR/data/foodie.sqlite"
BACKUP_DIR="$PROJECT_DIR/data/backups"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

###############################################################################
# HELPER FUNCTIONS
###############################################################################

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

###############################################################################
# COMMAND FUNCTIONS
###############################################################################

# Command: run-scraper
# Runs the bulk recipe scraper (10,000 recipes, 8-12 hours)
run_scraper() {
    print_header "RUNNING BULK RECIPE SCRAPER"
    
    cd "$PROJECT_DIR"
    
    echo "Target: 10,000 recipes"
    echo "Duration: 8-12 hours (estimated)"
    echo "Output: $SCRAPED_DB"
    echo ""
    
    read -p "Start scraper now? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "Scraper cancelled"
        exit 0
    fi
    
    print_success "Starting scraper..."
    node scripts/bulk-recipe-scraper.js
}

# Command: run-scraper-background
# Runs scraper in background with logging
run_scraper_background() {
    print_header "RUNNING SCRAPER IN BACKGROUND"
    
    cd "$PROJECT_DIR"
    
    LOG_FILE="$PROJECT_DIR/scraper-$(date +%Y%m%d-%H%M%S).log"
    PID_FILE="$PROJECT_DIR/scraper.pid"
    
    echo "Log file: $LOG_FILE"
    echo "PID file: $PID_FILE"
    echo ""
    
    read -p "Start scraper in background? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "Scraper cancelled"
        exit 0
    fi
    
    nohup node scripts/bulk-recipe-scraper.js > "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
    
    print_success "Scraper started in background (PID: $(cat $PID_FILE))"
    echo ""
    echo "Monitor progress:"
    echo "  tail -f $LOG_FILE"
    echo ""
    echo "Stop scraper:"
    echo "  kill \$(cat $PID_FILE)"
}

# Command: test-scraper
# Runs scraper with only 100 recipes for testing
test_scraper() {
    print_header "TEST SCRAPER (100 recipes)"
    
    cd "$PROJECT_DIR"
    
    # Check if config needs to be temporarily modified
    if grep -q "totalTargetRecipes: 10000" scripts/bulk-recipe-scraper.js; then
        print_warning "Config is set to 10000 recipes"
        print_warning "For testing, you should modify line 107 to: totalTargetRecipes: 100"
        echo ""
        read -p "Continue with current config? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 0
        fi
    fi
    
    node scripts/bulk-recipe-scraper.js
}

# Command: analyze
# Analyzes scraped recipes (meal types, cuisines, etc.)
analyze_scraped() {
    print_header "ANALYZING SCRAPED RECIPES"
    
    if [ ! -f "$SCRAPED_DB" ]; then
        print_error "Scraped database not found: $SCRAPED_DB"
        exit 1
    fi
    
    cd "$PROJECT_DIR"
    node scripts/analyze-meal-types.js
}

# Command: stats
# Shows quick statistics
show_stats() {
    print_header "DATABASE STATISTICS"
    
    if [ -f "$SCRAPED_DB" ]; then
        echo -e "${GREEN}Scraped Database:${NC}"
        sqlite3 "$SCRAPED_DB" << EOF
SELECT '  Total Recipes: ' || COUNT(*) FROM recipes;
SELECT '  By Source:' AS '';
SELECT '    ' || Source || ': ' || COUNT(*) FROM recipes GROUP BY Source ORDER BY COUNT(*) DESC;
SELECT '  By Meal Type:' AS '';
SELECT '    ' || MealType || ': ' || COUNT(*) FROM recipes GROUP BY MealType ORDER BY COUNT(*) DESC LIMIT 10;
EOF
        echo ""
    else
        print_warning "Scraped database not found"
    fi
    
    if [ -f "$MAIN_DB" ]; then
        echo -e "${GREEN}Main Database:${NC}"
        # Check if Source column exists before querying
        HAS_SOURCE=$(sqlite3 "$MAIN_DB" "PRAGMA table_info(recipes);" | grep -c "Source" || true)
        
        sqlite3 "$MAIN_DB" << EOF
SELECT '  Total Recipes: ' || COUNT(*) FROM recipes;
EOF
        
        if [ "$HAS_SOURCE" -gt 0 ]; then
            sqlite3 "$MAIN_DB" << EOF
SELECT '  By Source:' AS '';
SELECT '    ' || COALESCE(Source, 'Manual') || ': ' || COUNT(*) FROM recipes GROUP BY Source ORDER BY COUNT(*) DESC LIMIT 5;
EOF
        fi
        
        echo ""
    else
        print_warning "Main database not found"
    fi
}

# Command: backup-main
# Backs up the main database
backup_main_db() {
    print_header "BACKUP MAIN DATABASE"
    
    if [ ! -f "$MAIN_DB" ]; then
        print_error "Main database not found: $MAIN_DB"
        exit 1
    fi
    
    mkdir -p "$BACKUP_DIR"
    
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/foodie-backup-$TIMESTAMP.sqlite"
    
    echo "Source: $MAIN_DB"
    echo "Backup: $BACKUP_FILE"
    echo ""
    
    cp "$MAIN_DB" "$BACKUP_FILE"
    
    print_success "Backup created: $BACKUP_FILE"
    
    # Show backup size
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "Size: $SIZE"
}

# Command: replace-main
# Replaces main database with scraped database (with backup)
replace_main_with_scraped() {
    print_header "REPLACE MAIN DATABASE WITH SCRAPED DATA"
    
    if [ ! -f "$SCRAPED_DB" ]; then
        print_error "Scraped database not found: $SCRAPED_DB"
        exit 1
    fi
    
    print_warning "This will REPLACE your main database with scraped data!"
    print_warning "A backup will be created first."
    echo ""
    
    # Show counts
    SCRAPED_COUNT=$(sqlite3 "$SCRAPED_DB" "SELECT COUNT(*) FROM recipes;")
    if [ -f "$MAIN_DB" ]; then
        MAIN_COUNT=$(sqlite3 "$MAIN_DB" "SELECT COUNT(*) FROM recipes;")
    else
        MAIN_COUNT=0
    fi
    
    echo "Current main DB: $MAIN_COUNT recipes"
    echo "Scraped DB: $SCRAPED_COUNT recipes"
    echo ""
    
    read -p "Backup and replace main database? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "Operation cancelled"
        exit 0
    fi
    
    # Create backup if main exists
    if [ -f "$MAIN_DB" ]; then
        mkdir -p "$BACKUP_DIR"
        TIMESTAMP=$(date +%Y%m%d-%H%M%S)
        BACKUP_FILE="$BACKUP_DIR/foodie-backup-before-replace-$TIMESTAMP.sqlite"
        
        echo ""
        echo "Creating backup..."
        cp "$MAIN_DB" "$BACKUP_FILE"
        print_success "Backup created: $BACKUP_FILE"
    fi
    
    # Replace
    echo ""
    echo "Replacing main database..."
    cp "$SCRAPED_DB" "$MAIN_DB"
    
    print_success "Main database replaced!"
    print_success "New recipe count: $SCRAPED_COUNT"
    
    # Update seed database and user data
    echo ""
    echo "Updating seed database and app user data..."
    if [ -f "./update-seed-database.sh" ]; then
        ./update-seed-database.sh
        print_success "Seed database and user data updated!"
    else
        print_warning "update-seed-database.sh not found"
        print_warning "Run manually: ./update-seed-database.sh"
    fi
}

# Command: merge
# Merges scraped database into main database (avoiding duplicates)
merge_scraped_into_main() {
    print_header "MERGE SCRAPED DATA INTO MAIN DATABASE"
    
    if [ ! -f "$SCRAPED_DB" ]; then
        print_error "Scraped database not found: $SCRAPED_DB"
        exit 1
    fi
    
    if [ ! -f "$MAIN_DB" ]; then
        print_error "Main database not found: $MAIN_DB"
        print_warning "Use 'replace-main' command instead for first-time setup"
        exit 1
    fi
    
    print_warning "This will merge scraped recipes into main database"
    print_warning "Duplicates (by URL) will be skipped"
    echo ""
    
    # Show counts
    SCRAPED_COUNT=$(sqlite3 "$SCRAPED_DB" "SELECT COUNT(*) FROM recipes;")
    MAIN_COUNT=$(sqlite3 "$MAIN_DB" "SELECT COUNT(*) FROM recipes;")
    
    echo "Main DB (current): $MAIN_COUNT recipes"
    echo "Scraped DB: $SCRAPED_COUNT recipes"
    echo ""
    
    read -p "Create backup and merge? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "Operation cancelled"
        exit 0
    fi
    
    # Create backup
    mkdir -p "$BACKUP_DIR"
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/foodie-backup-before-merge-$TIMESTAMP.sqlite"
    
    echo ""
    echo "Creating backup..."
    cp "$MAIN_DB" "$BACKUP_FILE"
    print_success "Backup created: $BACKUP_FILE"
    
    # Merge using SQLite ATTACH
    echo ""
    echo "Merging databases..."
    
    sqlite3 "$MAIN_DB" << EOF
ATTACH DATABASE '$SCRAPED_DB' AS scraped;

-- Insert recipes that don't exist (by URL)
INSERT OR IGNORE INTO recipes 
SELECT * FROM scraped.recipes 
WHERE URL NOT IN (SELECT URL FROM recipes WHERE URL IS NOT NULL AND URL != '');

-- Insert ingredients for new recipes
INSERT OR IGNORE INTO ingredients
SELECT i.* FROM scraped.ingredients i
WHERE i.RecipeId IN (SELECT RecipeId FROM scraped.recipes WHERE URL NOT IN (SELECT COALESCE(URL, '') FROM recipes WHERE RecipeId != i.RecipeId));

DETACH DATABASE scraped;
EOF
    
    NEW_COUNT=$(sqlite3 "$MAIN_DB" "SELECT COUNT(*) FROM recipes;")
    ADDED=$((NEW_COUNT - MAIN_COUNT))
    
    print_success "Merge complete!"
    echo "Added: $ADDED new recipes"
    echo "Total: $NEW_COUNT recipes"
}

# Command: list-backups
# Lists all database backups
list_backups() {
    print_header "DATABASE BACKUPS"
    
    if [ ! -d "$BACKUP_DIR" ]; then
        print_warning "No backups found (directory doesn't exist)"
        exit 0
    fi
    
    if [ -z "$(ls -A $BACKUP_DIR/*.sqlite 2>/dev/null)" ]; then
        print_warning "No backups found"
        exit 0
    fi
    
    echo "Location: $BACKUP_DIR"
    echo ""
    
    ls -lh "$BACKUP_DIR"/*.sqlite | awk '{print $9 " (" $5 ")"}'
}

# Command: restore
# Restores from a backup
restore_backup() {
    print_header "RESTORE FROM BACKUP"
    
    if [ ! -d "$BACKUP_DIR" ]; then
        print_error "Backup directory not found"
        exit 1
    fi
    
    echo "Available backups:"
    echo ""
    
    select backup in "$BACKUP_DIR"/*.sqlite; do
        if [ -n "$backup" ]; then
            echo ""
            echo "Selected: $backup"
            SIZE=$(du -h "$backup" | cut -f1)
            echo "Size: $SIZE"
            
            RECIPE_COUNT=$(sqlite3 "$backup" "SELECT COUNT(*) FROM recipes;")
            echo "Recipes: $RECIPE_COUNT"
            echo ""
            
            print_warning "This will REPLACE your main database!"
            read -p "Restore this backup? (y/N) " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                cp "$backup" "$MAIN_DB"
                print_success "Database restored from: $backup"
            else
                print_warning "Restore cancelled"
            fi
            break
        fi
    done
}

###############################################################################
# MAIN MENU
###############################################################################

show_usage() {
    cat << EOF
Usage: $0 <command>

SCRAPER COMMANDS:
  run-scraper          Run bulk scraper (10,000 recipes, 8-12 hours)
  run-background       Run scraper in background with logging
  test-scraper         Test scraper with 100 recipes
  analyze              Analyze scraped data (meal types, cuisines, etc.)
  stats                Show quick statistics for both databases

DATABASE MANAGEMENT:
  backup-main          Backup main database
  replace-main         Replace main DB with scraped DB (with backup)
  merge                Merge scraped DB into main DB (avoid duplicates)
  list-backups         List all database backups
  restore              Restore main database from a backup

EXAMPLES:
  # Test scraper first
  $0 test-scraper
  
  # Run full scrape in background
  $0 run-background
  
  # After scraping, analyze results
  $0 analyze
  
  # Replace main database with scraped data
  $0 backup-main
  $0 replace-main

EOF
}

# Main command router
case "$1" in
    run-scraper)
        run_scraper
        ;;
    run-background)
        run_scraper_background
        ;;
    test-scraper)
        test_scraper
        ;;
    analyze)
        analyze_scraped
        ;;
    stats)
        show_stats
        ;;
    backup-main)
        backup_main_db
        ;;
    replace-main)
        replace_main_with_scraped
        ;;
    merge)
        merge_scraped_into_main
        ;;
    list-backups)
        list_backups
        ;;
    restore)
        restore_backup
        ;;
    *)
        show_usage
        exit 1
        ;;
esac

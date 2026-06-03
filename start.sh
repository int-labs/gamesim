#!/bin/bash
set -e

# Function to cleanup on exit
cleanup() {
    echo "Shutting down..."
    exit 0
}
trap cleanup SIGTERM SIGINT

# Check if we should use MongoDB Atlas or local MongoDB
if [ ! -z "$MONGODB_ATLAS_URI" ]; then
    echo "🗄️ Using MongoDB Atlas..."
    
    # Debug: Show available environment variables
    echo "🔍 Environment variables for database naming:"
    echo "   RENDER_SERVICE_NAME: ${RENDER_SERVICE_NAME:-NOT_SET}"
    echo "   RENDER_GIT_BRANCH: ${RENDER_GIT_BRANCH:-NOT_SET}"
    echo "   PREVIEW_ID: ${PREVIEW_ID:-NOT_SET}"
    echo "   GIT_BRANCH: ${GIT_BRANCH:-NOT_SET}"
    echo "   BRANCH: ${BRANCH:-NOT_SET}"
    
    # Get preview ID from environment (PR number or branch name)
    # Check if we're in a preview environment (has "preview" in service name or branch)
    if [[ "$RENDER_SERVICE_NAME" == *"preview"* ]] || [[ "$RENDER_GIT_BRANCH" == *"preview"* ]] || [[ "$RENDER_SERVICE_NAME" == *"PR"* ]] || [[ "$GIT_BRANCH" == *"preview"* ]] || [[ "$BRANCH" == *"preview"* ]]; then
        echo "🎯 Preview environment detected"
        
        # Extract PR number from service name if available (e.g., "stratagem-staging PR #196")
        if [[ "$RENDER_SERVICE_NAME" =~ PR\ #([0-9]+) ]]; then
            PREVIEW_ID="${BASH_REMATCH[1]}"
            echo "📋 Extracted PR number: $PREVIEW_ID"
        # Or use branch name if it contains preview info
        elif [[ "$RENDER_GIT_BRANCH" =~ preview-([0-9]+) ]]; then
            PREVIEW_ID="${BASH_REMATCH[1]}"
            echo "🌿 Using branch preview number: $PREVIEW_ID"
        elif [[ "$GIT_BRANCH" =~ preview-([0-9]+) ]]; then
            PREVIEW_ID="${BASH_REMATCH[1]}"
            echo "🌿 Using GIT_BRANCH preview number: $PREVIEW_ID"
        elif [[ "$BRANCH" =~ preview-([0-9]+) ]]; then
            PREVIEW_ID="${BASH_REMATCH[1]}"
            echo "🌿 Using BRANCH preview number: $PREVIEW_ID"
        # Or use provided PREVIEW_ID
        elif [ ! -z "$PREVIEW_ID" ]; then
            PREVIEW_ID="$PREVIEW_ID"
            echo "🔧 Using provided PREVIEW_ID: $PREVIEW_ID"
        else
            # Try to get branch name from git if available
            if command -v git >/dev/null 2>&1; then
                GIT_CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
                if [[ "$GIT_CURRENT_BRANCH" =~ preview-([0-9]+) ]]; then
                    PREVIEW_ID="${BASH_REMATCH[1]}"
                    echo "🌿 Using git branch preview number: $PREVIEW_ID"
                else
                    # Fallback to timestamp for unique identification
                    PREVIEW_ID=$(date +%s)
                    echo "⏰ Using timestamp as PREVIEW_ID: $PREVIEW_ID"
                fi
            else
                # Fallback to timestamp for unique identification
                PREVIEW_ID=$(date +%s)
                echo "⏰ Using timestamp as PREVIEW_ID: $PREVIEW_ID"
            fi
        fi
        DB_NAME="preview_${PREVIEW_ID}"
    else
        echo "🏭 Production/Staging environment detected"
        # For staging/production, use a fixed database name
        DB_NAME="staging"
    fi
    
    echo "🎯 Preview ID: $PREVIEW_ID"
    echo "📁 Database name: $DB_NAME"
    export MONGODB_URI="${MONGODB_ATLAS_URI}/${DB_NAME}"
    export DATABASE_URL="${MONGODB_URI}"
    export MONGO_URI="${MONGODB_URI}"
    
    echo "🔗 MongoDB Atlas URI: $MONGODB_URI"
    
    # Test Atlas connection (database will be created automatically on first use)
    echo "🧪 Testing Atlas connection..."
    timeout=30
    while [ $timeout -gt 0 ]; do
        if command -v mongosh >/dev/null 2>&1; then
            if mongosh "$MONGODB_URI" --eval "db.adminCommand('ping')" --quiet 2>/dev/null; then
                echo "✅ MongoDB Atlas connection successful!"
                break
            fi
        else
            echo "⚠️ mongosh not available, skipping connection test"
            echo "✅ Assuming MongoDB Atlas URI is valid"
            break
        fi
        timeout=$((timeout - 1))
        sleep 1
    done
    
    if [ $timeout -eq 0 ] && command -v mongosh >/dev/null 2>&1; then
        echo "❌ ERROR: MongoDB Atlas connection failed"
        exit 1
    fi
    
    echo "🎉 MongoDB Atlas database '$DB_NAME' is ready!"
    
else
    echo "🐳 Using local MongoDB (fallback mode)..."
    
    # Start local MongoDB in background (fallback)
    echo "🚀 Starting local MongoDB..."
    mongod --dbpath /data/db --bind_ip 0.0.0.0 --port 27017 --fork --logpath /tmp/mongod.log
    
    # Wait for MongoDB to be ready
    echo "⏳ Waiting for local MongoDB to start..."
    timeout=60
    while [ $timeout -gt 0 ]; do
        if mongosh --eval "db.adminCommand('ping')" --quiet 2>/dev/null; then
            echo "✅ Local MongoDB is ready!"
            break
        fi
        timeout=$((timeout - 1))
        sleep 1
    done
    
    if [ $timeout -eq 0 ]; then
        echo "❌ ERROR: Local MongoDB failed to start within 60 seconds"
        cat /tmp/mongod.log
        exit 1
    fi
    
    # Set local MongoDB URI
    export MONGO_URI="mongodb://localhost:27017/preview_db"
    export MONGODB_URI="mongodb://localhost:27017/preview_db"
    export DATABASE_URL="mongodb://localhost:27017/preview_db"
fi

export NODE_ENV="preview"
export IS_PULL_REQUEST="true"

# Seed the database with test data
echo "🌱 Seeding preview database..."
cd /app/server && npm run seed-db

# Start the application
echo "🚀 Starting application on port ${PORT:-3000}..."
exec npm start

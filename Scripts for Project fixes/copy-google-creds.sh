#!/bin/bash

# Copy Google Calendar credentials between dev and production folders

SOURCE="$HOME/Library/Application Support/Foodie Meal Planner"
DEST="$HOME/Library/Application Support/foodie-meal-planner-desktop"

echo "Copying Google Calendar credentials..."
echo "From: $SOURCE"
echo "To: $DEST"
echo ""

if [ -f "$SOURCE/google-credentials.json" ]; then
  cp "$SOURCE/google-credentials.json" "$DEST/"
  echo "✓ Copied google-credentials.json"
else
  echo "✗ google-credentials.json not found in source"
fi

if [ -f "$SOURCE/google-token.json" ]; then
  cp "$SOURCE/google-token.json" "$DEST/"
  echo "✓ Copied google-token.json"
else
  echo "✗ google-token.json not found in source"
fi

echo ""
echo "Done! You should no longer need to re-authorize in npm run dev."

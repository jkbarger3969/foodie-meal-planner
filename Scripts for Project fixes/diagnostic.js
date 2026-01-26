#!/usr/bin/env node

// Quick diagnostic script to check meal data

const Database = require('better-sqlite3');
const os = require('os');
const path = require('path');

const dbPath = path.join(os.homedir(), 'Library/Application Support/foodie-meal-planner-desktop/foodie.sqlite');
const db = new Database(dbPath);

console.log('=== MEAL PLANNER DIAGNOSTIC ===\n');

// Check all plans
const plans = db.prepare('SELECT * FROM plans ORDER BY Date DESC LIMIT 10').all();
console.log(`Total plans in database: ${plans.length}\n`);

plans.forEach(p => {
  console.log(`Date: ${p.Date}`);
  console.log(`  Breakfast: RecipeId="${p.BreakfastRecipeId || ''}" Title="${p.BreakfastTitle || ''}" GoogleEventId="${p.BreakfastGoogleEventId || ''}"`);
  console.log(`  Lunch:     RecipeId="${p.LunchRecipeId || ''}" Title="${p.LunchTitle || ''}" GoogleEventId="${p.LunchGoogleEventId || ''}"`);
  console.log(`  Dinner:    RecipeId="${p.DinnerRecipeId || ''}" Title="${p.DinnerTitle || ''}" GoogleEventId="${p.DinnerGoogleEventId || ''}"`);
  console.log('');
});

// Check what would sync for today's week
const today = new Date().toISOString().split('T')[0];
const weekEnd = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

console.log(`\n=== SYNC RANGE: ${today} to ${weekEnd} ===\n`);
const syncPlans = db.prepare('SELECT * FROM plans WHERE Date >= ? AND Date <= ? ORDER BY Date ASC').all(today, weekEnd);
console.log(`Plans in range: ${syncPlans.length}\n`);

let mealCount = 0;
syncPlans.forEach(p => {
  ['Breakfast', 'Lunch', 'Dinner'].forEach(slot => {
    const title = p[`${slot}Title`];
    if (title && title.trim()) {
      console.log(`  ${p.Date} ${slot}: ${title}`);
      mealCount++;
    }
  });
});

console.log(`\nTotal meals to sync: ${mealCount}`);
console.log(`Expected result: Created: ${mealCount}, Updated: 0 (or vice versa if syncing again)\n`);

db.close();

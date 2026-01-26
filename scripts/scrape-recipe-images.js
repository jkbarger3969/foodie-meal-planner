#!/usr/bin/env node
/**
 * Scrape recipe images from URLs and download them locally
 * Run with: npx electron scripts/scrape-recipe-images.js
 * Or from app: Admin > Download Recipe Images
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const os = require('os');

// Use Electron's app path for database
const dbPath = path.join(os.homedir(), 'Library/Application Support/Foodie Meal Planner/foodie.sqlite');
const imagesDir = path.join(os.homedir(), 'Library/Application Support/Foodie Meal Planner/images');

// Load better-sqlite3 via electron-rebuild compatible path
let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  console.error('Error loading better-sqlite3. Run this script with: npx electron scripts/scrape-recipe-images.js');
  process.exit(1);
}

const db = new Database(dbPath);

// Ensure images directory exists
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

// Image URL selectors for common recipe sites
const IMAGE_SELECTORS = {
  'allrecipes.com': 'img.universal-image__image, .recipe-image img, [data-tracking-zone="recipe-hero"] img',
  'foodnetwork.com': '.o-AssetImage__a-Img img, .m-MediaBlock__a-Image img',
  'bbcgoodfood.com': '.image__img, .post-header__image img, picture img',
  'bonappetit.com': '[data-testid="ContentHeaderLeadAsset"] img, .lede__image img',
  'seriouseats.com': '.primary-image img, .article-image img',
  'epicurious.com': '.photo-wrap img, [data-testid="ContentHeaderLeadAsset"] img',
  'tasty.co': '.recipe-hero img, .recipe-image img',
  'delish.com': '.recipe-hed-image img, picture img',
  'food52.com': '.recipe-image img, .article-image img',
  'simplyrecipes.com': '.featured-image img, .entry-image img',
  'default': 'meta[property="og:image"], .recipe-image img, article img, .hero-image img, main img'
};

function getSelectorsForUrl(url) {
  for (const [domain, selector] of Object.entries(IMAGE_SELECTORS)) {
    if (domain !== 'default' && url.includes(domain)) {
      return selector + ', ' + IMAGE_SELECTORS.default;
    }
  }
  return IMAGE_SELECTORS.default;
}

async function scrapeImageUrl(browser, recipeUrl) {
  const page = await browser.newPage();
  
  try {
    // Set a user agent to avoid being blocked
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Navigate with timeout
    await page.goto(recipeUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });
    
    // Wait a bit for images to load
    await new Promise(r => setTimeout(r, 1000));
    
    const selectors = getSelectorsForUrl(recipeUrl);
    
    // Try to get image URL
    const imageUrl = await page.evaluate((selectors) => {
      // First try og:image meta tag (most reliable)
      const ogImage = document.querySelector('meta[property="og:image"]');
      if (ogImage && ogImage.content) {
        return ogImage.content;
      }
      
      // Try other selectors
      const selectorList = selectors.split(',').map(s => s.trim());
      for (const selector of selectorList) {
        if (selector.includes('meta')) continue; // Already tried
        const img = document.querySelector(selector);
        if (img) {
          const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
          if (src && src.startsWith('http') && !src.includes('placeholder') && !src.includes('avatar')) {
            return src;
          }
        }
      }
      
      // Fallback: find largest image on page
      const images = Array.from(document.querySelectorAll('img'));
      let bestImage = null;
      let bestScore = 0;
      
      for (const img of images) {
        const src = img.src || img.getAttribute('data-src');
        if (!src || !src.startsWith('http')) continue;
        if (src.includes('logo') || src.includes('icon') || src.includes('avatar') || src.includes('placeholder')) continue;
        
        const width = img.naturalWidth || img.width || 0;
        const height = img.naturalHeight || img.height || 0;
        const score = width * height;
        
        if (score > bestScore && width > 200 && height > 150) {
          bestScore = score;
          bestImage = src;
        }
      }
      
      return bestImage;
    }, selectors);
    
    return imageUrl;
  } catch (e) {
    console.error(`  Error scraping ${recipeUrl}:`, e.message);
    return null;
  } finally {
    await page.close();
  }
}

function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(filepath);
    
    const request = protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        fs.unlinkSync(filepath);
        return downloadImage(response.headers.location, filepath)
          .then(resolve)
          .catch(reject);
      }
      
      if (response.statusCode !== 200) {
        file.close();
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
        return reject(new Error(`HTTP ${response.statusCode}`));
      }
      
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
      file.on('error', (err) => {
        file.close();
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
        reject(err);
      });
    });
    
    request.on('error', (err) => {
      file.close();
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
      reject(err);
    });
    
    request.setTimeout(10000, () => {
      request.destroy();
      reject(new Error('Download timeout'));
    });
  });
}

async function main() {
  console.log('=== Recipe Image Scraper ===\n');
  console.log('Database:', dbPath);
  console.log('Images dir:', imagesDir);
  
  // Get recipes without images that have URLs
  const recipes = db.prepare(`
    SELECT RecipeId, Title, URL
    FROM recipes
    WHERE URL IS NOT NULL AND URL != ''
    AND (Image_Name IS NULL OR Image_Name = '')
    ORDER BY Title
  `).all();
  
  console.log(`\nFound ${recipes.length} recipes without images\n`);
  
  if (recipes.length === 0) {
    console.log('No recipes to process.');
    db.close();
    return;
  }
  
  // Limit for testing - remove or increase for full run
  const BATCH_SIZE = parseInt(process.argv[2]) || 50;
  const recipesToProcess = recipes.slice(0, BATCH_SIZE);
  
  console.log(`Processing first ${recipesToProcess.length} recipes...\n`);
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const results = {
    total: recipesToProcess.length,
    success: 0,
    noImage: 0,
    downloadFailed: 0,
    errors: []
  };
  
  const updateStmt = db.prepare('UPDATE recipes SET Image_Name = ? WHERE RecipeId = ?');
  
  for (let i = 0; i < recipesToProcess.length; i++) {
    const recipe = recipesToProcess[i];
    const progress = `[${i + 1}/${recipesToProcess.length}]`;
    
    console.log(`${progress} ${recipe.Title.substring(0, 50)}...`);
    
    try {
      // Scrape image URL
      const imageUrl = await scrapeImageUrl(browser, recipe.URL);
      
      if (!imageUrl) {
        console.log('  No image found');
        results.noImage++;
        continue;
      }
      
      // Generate local filename
      const ext = imageUrl.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i)?.[1] || 'jpg';
      const filename = `${recipe.RecipeId}.${ext}`;
      const filepath = path.join(imagesDir, filename);
      
      // Download image
      try {
        await downloadImage(imageUrl, filepath);
        
        // Update database with local path
        const localPath = `images/${filename}`;
        updateStmt.run(localPath, recipe.RecipeId);
        
        console.log('  Downloaded successfully');
        results.success++;
      } catch (e) {
        console.log(`  Download failed: ${e.message}`);
        results.downloadFailed++;
        results.errors.push({ title: recipe.Title, error: e.message });
      }
      
      // Small delay between requests
      await new Promise(r => setTimeout(r, 500));
      
    } catch (e) {
      console.log(`  Error: ${e.message}`);
      results.errors.push({ title: recipe.Title, error: e.message });
    }
  }
  
  await browser.close();
  db.close();
  
  console.log('\n=== Results ===');
  console.log(`Total processed: ${results.total}`);
  console.log(`Successfully downloaded: ${results.success}`);
  console.log(`No image found: ${results.noImage}`);
  console.log(`Download failed: ${results.downloadFailed}`);
  
  if (results.errors.length > 0 && results.errors.length <= 10) {
    console.log('\nErrors:');
    results.errors.forEach(e => console.log(`  - ${e.title}: ${e.error}`));
  }
  
  console.log('\nDone!');
}

main().catch(console.error);

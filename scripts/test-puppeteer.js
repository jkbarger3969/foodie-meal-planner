#!/usr/bin/env node

/**
 * Quick test to verify Puppeteer works
 */

const puppeteer = require('puppeteer');

async function testPuppeteer() {
  console.log('Testing Puppeteer...\n');
  
  try {
    console.log('1. Launching browser...');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    console.log('   ✅ Browser launched');
    
    console.log('2. Opening new page...');
    const page = await browser.newPage();
    console.log('   ✅ Page opened');
    
    console.log('3. Navigating to AllRecipes...');
    await page.goto('https://www.allrecipes.com/recipes/78/breakfast-and-brunch/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    console.log('   ✅ Page loaded');
    
    console.log('4. Extracting recipe links...');
    const links = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a'));
      return anchors
        .map(a => a.href)
        .filter(href => href && href.includes('-recipe-'))
        .slice(0, 10);
    });
    console.log(`   ✅ Found ${links.length} recipe links (showing first 10)`);
    links.forEach((link, i) => console.log(`      ${i + 1}. ${link}`));
    
    console.log('5. Closing browser...');
    await browser.close();
    console.log('   ✅ Browser closed');
    
    console.log('\n✅ Puppeteer test successful!');
    console.log('\nYou can now run the full scraper:');
    console.log('  ./scraper-manager.sh test-scraper');
    
  } catch (error) {
    console.error('\n❌ Puppeteer test failed:');
    console.error(error.message);
    console.error('\nTroubleshooting:');
    console.error('  1. Make sure Puppeteer is installed: npm install puppeteer');
    console.error('  2. Check if you have enough disk space (~350MB for Chromium)');
    console.error('  3. Try: npm rebuild puppeteer');
    process.exit(1);
  }
}

testPuppeteer();

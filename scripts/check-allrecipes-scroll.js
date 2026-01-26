#!/usr/bin/env node

const puppeteer = require('puppeteer');

async function checkScrollMechanism() {
  console.log('Checking AllRecipes scroll mechanism...\n');
  
  const browser = await puppeteer.launch({ headless: false }); // visible browser
  const page = await browser.newPage();
  
  await page.goto('https://www.allrecipes.com/recipes/78/breakfast-and-brunch/', {
    waitUntil: 'networkidle2'
  });
  
  console.log('Page loaded. Counting initial recipe links...');
  
  let count1 = await page.evaluate(() => {
    return document.querySelectorAll('a[href*="-recipe-"]').length;
  });
  console.log(`Initial count: ${count1} recipe links`);
  
  console.log('\nScrolling 10 times with 2s delays...');
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, 2000));
    
    let count = await page.evaluate(() => {
      return document.querySelectorAll('a[href*="-recipe-"]').length;
    });
    console.log(`After scroll ${i + 1}: ${count} recipe links (${count - count1} new)`);
  }
  
  console.log('\nChecking for Load More button...');
  const hasLoadMore = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, a'));
    return buttons.some(btn => 
      btn.textContent.toLowerCase().includes('load') || 
      btn.textContent.toLowerCase().includes('more') ||
      btn.textContent.toLowerCase().includes('show')
    );
  });
  console.log(`Has "Load More" button: ${hasLoadMore}`);
  
  console.log('\nPress Ctrl+C when done inspecting the page...');
  await new Promise(r => setTimeout(r, 60000)); // Wait 60 seconds
  
  await browser.close();
}

checkScrollMechanism().catch(console.error);

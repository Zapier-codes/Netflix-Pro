// test-vidsrc-correct.js
console.log('🔍 Testing vidsrc.extractor.module...\n');

// Try to import the correct module name
try {
  console.log('[1] Trying require("vidsrc.extractor.module")');
  const module1 = require('vidsrc.extractor.module');
  console.log('✅ Module loaded!');
  console.log('📦 Exports:', Object.keys(module1));
  console.log('📦 Default:', module1.default);
} catch (e) {
  console.log('❌ Failed:', e.message);
}

// Check the module structure
try {
  console.log('\n[2] Checking module exports...');
  const mod = require('vidsrc.extractor.module');
  
  // Try different export patterns
  const functions = mod.default || mod;
  console.log('Functions available:', Object.keys(functions));
  
  // Try to find the scrape function
  const scrapeFn = functions.tmdbScrape || functions.scrape || functions.default || functions;
  console.log('Scrape function found:', typeof scrapeFn);
  
} catch (e) {
  console.log('❌ Failed:', e.message);
}

// Try to actually use it
console.log('\n[3] Testing scrape function...');
const mod = require('vidsrc.extractor.module');
const scrape = mod.default?.tmdbScrape || mod.tmdbScrape || mod.default || mod;

if (typeof scrape === 'function') {
  try {
    const result = await scrape('27205', 'movie');
    console.log('✅ Result:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.log('❌ Scrape failed:', e.message);
  }
} else {
  console.log('⚠️ No scrape function found');
  console.log('Available:', Object.keys(mod));
}
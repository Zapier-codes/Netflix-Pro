// test-vidsrc.mjs
console.log('🔍 Testing vidsrc.extractor.module...\n');

try {
  // Dynamic import
  const module = await import('vidsrc.extractor.module');
  console.log('✅ Module loaded!');
  console.log('📦 Exports:', Object.keys(module));
  
  // Find the scrape function
  const scrape = module.default?.tmdbScrape || module.tmdbScrape || module.default || module;
  console.log('Scrape function type:', typeof scrape);
  
  if (typeof scrape === 'function') {
    console.log('\n[1] Testing movie: Inception (27205)');
    const movieResult = await scrape('27205', 'movie');
    console.log('✅ Movie result:', JSON.stringify(movieResult, null, 2));
    
    console.log('\n[2] Testing TV: Breaking Bad S1E1 (1396, 1, 1)');
    const tvResult = await scrape('1396', 'tv', 1, 1);
    console.log('✅ TV result:', JSON.stringify(tvResult, null, 2));
    
  } else {
    console.log('⚠️ No scrape function found');
    console.log('Available exports:', Object.keys(module));
  }
  
} catch (e) {
  console.error('❌ Error:', e.message);
  console.error('Stack:', e.stack);
}

// Benchmark script for CV parser adapters
const fs = require('fs');
const path = require('path');
const { SimpleEnhancedCvParser } = require('./src/parsers/simpleEnhancedCvParser');

// Test files directory
const TEST_FILES_DIR = path.join(__dirname, 'test', 'data');

// Sample test files (you can add your own)
const TEST_FILES = [
  '05-versions-space.pdf', // Already exists
  // Add more test files as needed
];

async function runBenchmark() {
  console.log('=== CV PARSER BENCHMARK ===');
  console.log(`Test files directory: ${TEST_FILES_DIR}`);
  
  const parser = new SimpleEnhancedCvParser();
  const results = [];
  
  for (const filename of TEST_FILES) {
    const filePath = path.join(TEST_FILES_DIR, filename);
    
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  Test file not found: ${filename}`);
      continue;
    }
    
    console.log(`\n📄 Testing: ${filename}`);
    console.log('─'.repeat(50));
    
    try {
      const buffer = fs.readFileSync(filePath);
      const mimetype = getMimeType(filename);
      
      const startTime = Date.now();
      const result = await parser.parseFile(buffer, mimetype, filename);
      const totalTime = Date.now() - startTime;
      
      console.log(`✅ Success!`);
      console.log(`   Best adapter: ${result.adapter}`);
      console.log(`   Text length: ${result.text.length} characters`);
      console.log(`   Confidence: ${result.confidence.toFixed(2)}`);
      console.log(`   Total time: ${totalTime}ms`);
      console.log(`   Duration: ${result.duration}ms`);
      
      // Show all adapter results
      console.log(`\n   All adapter results:`);
      result.allResults.forEach(r => {
        console.log(`   - ${r.adapter}: ${r.text.length} chars, confidence: ${r.confidence.toFixed(2)}, ${r.duration}ms`);
      });
      
      // Show errors
      if (result.errors.length > 0) {
        console.log(`\n   Errors:`);
        result.errors.forEach(e => {
          console.log(`   - ${e.adapter}: ${e.error}`);
        });
      }
      
      results.push({
        filename,
        success: true,
        bestAdapter: result.adapter,
        textLength: result.text.length,
        confidence: result.confidence,
        duration: result.duration,
        totalTime,
        allResults: result.allResults,
        errors: result.errors
      });
      
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
      results.push({
        filename,
        success: false,
        error: error.message
      });
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 BENCHMARK SUMMARY');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`Total files: ${results.length}`);
  console.log(`Successful: ${successful.length}`);
  console.log(`Failed: ${failed.length}`);
  
  if (successful.length > 0) {
    console.log('\n🏆 Adapter Performance:');
    const adapterStats = {};
    
    successful.forEach(result => {
      result.allResults.forEach(r => {
        if (!adapterStats[r.adapter]) {
          adapterStats[r.adapter] = {
            count: 0,
            totalConfidence: 0,
            totalDuration: 0,
            totalTextLength: 0
          };
        }
        adapterStats[r.adapter].count++;
        adapterStats[r.adapter].totalConfidence += r.confidence;
        adapterStats[r.adapter].totalDuration += r.duration;
        adapterStats[r.adapter].totalTextLength += r.text.length;
      });
    });
    
    Object.entries(adapterStats).forEach(([adapter, stats]) => {
      const avgConfidence = (stats.totalConfidence / stats.count).toFixed(2);
      const avgDuration = (stats.totalDuration / stats.count).toFixed(0);
      const avgTextLength = Math.round(stats.totalTextLength / stats.count);
      console.log(`   ${adapter}: ${stats.count} runs, avg confidence: ${avgConfidence}, avg duration: ${avgDuration}ms, avg text: ${avgTextLength} chars`);
    });
  }
  
  if (failed.length > 0) {
    console.log('\n❌ Failed files:');
    failed.forEach(result => {
      console.log(`   ${result.filename}: ${result.error}`);
    });
  }
  
  console.log('\n✅ Benchmark complete!');
}

function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.pdf':
      return 'application/pdf';
    case '.docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case '.txt':
      return 'text/plain';
    default:
      return 'application/octet-stream';
  }
}

// Run benchmark
if (require.main === module) {
  runBenchmark().catch(console.error);
}

module.exports = { runBenchmark };

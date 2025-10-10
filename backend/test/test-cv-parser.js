// Comprehensive test suite for CV parser
const fs = require('fs');
const path = require('path');
const { SimpleEnhancedCvParser } = require('../src/parsers/simpleEnhancedCvParser');
const { logger } = require('../src/utils/logger');
const { config } = require('../src/config/config');

class CvParserTestSuite {
  constructor() {
    this.parser = new SimpleEnhancedCvParser();
    this.testResults = [];
    this.testFiles = [
      'sample-cv.txt',
      'sample-cv-simple.txt',
      '05-versions-space.pdf'
    ];
  }

  async runAllTests() {
    console.log('🧪 Starting CV Parser Test Suite');
    console.log('='.repeat(50));

    // Test configuration
    await this.testConfiguration();

    // Test file parsing
    await this.testFileParsing();

    // Test error handling
    await this.testErrorHandling();

    // Test performance
    await this.testPerformance();

    // Generate report
    this.generateReport();
  }

  async testConfiguration() {
    console.log('\n📋 Testing Configuration...');
    
    try {
      config.validate();
      console.log('✅ Configuration validation passed');
      
      const summary = config.getSummary();
      console.log('📊 Configuration Summary:');
      console.log(`   OCR Enabled: ${summary.parser.enableOcr}`);
      console.log(`   Log Level: ${summary.parser.logLevel}`);
      console.log(`   Port: ${summary.server.port}`);
      console.log(`   Max File Size: ${summary.server.maxFileSize} bytes`);
      console.log(`   Active Adapters: ${summary.adapters.join(', ')}`);
      
      this.testResults.push({
        test: 'Configuration',
        status: 'PASS',
        details: 'Configuration validation successful'
      });
    } catch (error) {
      console.log('❌ Configuration validation failed:', error.message);
      this.testResults.push({
        test: 'Configuration',
        status: 'FAIL',
        details: error.message
      });
    }
  }

  async testFileParsing() {
    console.log('\n📄 Testing File Parsing...');
    
    for (const filename of this.testFiles) {
      const filePath = path.join(__dirname, 'data', filename);
      
      if (!fs.existsSync(filePath)) {
        console.log(`⚠️  Test file not found: ${filename}`);
        continue;
      }

      try {
        console.log(`\n   Testing: ${filename}`);
        
        const buffer = fs.readFileSync(filePath);
        const mimetype = this.getMimeType(filename);
        
        const startTime = Date.now();
        const result = await this.parser.parseFile(buffer, mimetype, filename);
        const duration = Date.now() - startTime;
        
        // Validate result
        const isValid = this.validateParseResult(result);
        
        if (isValid) {
          console.log(`   ✅ Success: ${result.adapter} (${duration}ms)`);
          console.log(`      Text: ${result.text.length} chars`);
          console.log(`      Confidence: ${result.confidence.toFixed(2)}`);
          
          this.testResults.push({
            test: `File Parsing - ${filename}`,
            status: 'PASS',
            details: {
              adapter: result.adapter,
              duration,
              textLength: result.text.length,
              confidence: result.confidence
            }
          });
        } else {
          console.log(`   ❌ Invalid result from ${result.adapter}`);
          this.testResults.push({
            test: `File Parsing - ${filename}`,
            status: 'FAIL',
            details: 'Invalid parse result'
          });
        }
        
      } catch (error) {
        console.log(`   ❌ Failed: ${error.message}`);
        this.testResults.push({
          test: `File Parsing - ${filename}`,
          status: 'FAIL',
          details: error.message
        });
      }
    }
  }

  async testErrorHandling() {
    console.log('\n🚨 Testing Error Handling...');
    
    // Test with invalid file
    try {
      const invalidBuffer = Buffer.from('invalid content');
      await this.parser.parseFile(invalidBuffer, 'application/pdf', 'invalid.pdf');
      console.log('   ❌ Should have failed with invalid PDF');
      this.testResults.push({
        test: 'Error Handling - Invalid PDF',
        status: 'FAIL',
        details: 'Should have thrown error for invalid PDF'
      });
    } catch (error) {
      console.log('   ✅ Correctly handled invalid PDF');
      this.testResults.push({
        test: 'Error Handling - Invalid PDF',
        status: 'PASS',
        details: 'Correctly threw error for invalid PDF'
      });
    }

    // Test with empty buffer
    try {
      const emptyBuffer = Buffer.alloc(0);
      await this.parser.parseFile(emptyBuffer, 'text/plain', 'empty.txt');
      console.log('   ❌ Should have failed with empty file');
      this.testResults.push({
        test: 'Error Handling - Empty File',
        status: 'FAIL',
        details: 'Should have thrown error for empty file'
      });
    } catch (error) {
      console.log('   ✅ Correctly handled empty file');
      this.testResults.push({
        test: 'Error Handling - Empty File',
        status: 'PASS',
        details: 'Correctly threw error for empty file'
      });
    }
  }

  async testPerformance() {
    console.log('\n⚡ Testing Performance...');
    
    const testFile = path.join(__dirname, 'data', 'sample-cv.txt');
    
    if (!fs.existsSync(testFile)) {
      console.log('   ⚠️  Test file not available for performance testing');
      return;
    }

    const buffer = fs.readFileSync(testFile);
    const mimetype = 'text/plain';
    const iterations = 10;
    const durations = [];

    console.log(`   Running ${iterations} iterations...`);

    for (let i = 0; i < iterations; i++) {
      try {
        const startTime = Date.now();
        await this.parser.parseFile(buffer, mimetype, 'sample-cv.txt');
        const duration = Date.now() - startTime;
        durations.push(duration);
      } catch (error) {
        console.log(`   ❌ Performance test iteration ${i + 1} failed: ${error.message}`);
      }
    }

    if (durations.length > 0) {
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const minDuration = Math.min(...durations);
      const maxDuration = Math.max(...durations);

      console.log(`   📊 Performance Results:`);
      console.log(`      Average: ${avgDuration.toFixed(2)}ms`);
      console.log(`      Min: ${minDuration}ms`);
      console.log(`      Max: ${maxDuration}ms`);

      this.testResults.push({
        test: 'Performance',
        status: 'PASS',
        details: {
          iterations: durations.length,
          averageDuration: avgDuration,
          minDuration,
          maxDuration
        }
      });
    } else {
      this.testResults.push({
        test: 'Performance',
        status: 'FAIL',
        details: 'All performance test iterations failed'
      });
    }
  }

  validateParseResult(result) {
    if (!result || typeof result !== 'object') return false;
    if (!result.text || typeof result.text !== 'string') return false;
    if (!result.adapter || typeof result.adapter !== 'string') return false;
    if (typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 1) return false;
    if (typeof result.duration !== 'number' || result.duration < 0) return false;
    return true;
  }

  getMimeType(filename) {
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

  generateReport() {
    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST SUITE REPORT');
    console.log('='.repeat(50));

    const passed = this.testResults.filter(r => r.status === 'PASS').length;
    const failed = this.testResults.filter(r => r.status === 'FAIL').length;
    const total = this.testResults.length;

    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed} ✅`);
    console.log(`Failed: ${failed} ❌`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults
        .filter(r => r.status === 'FAIL')
        .forEach(r => {
          console.log(`   - ${r.test}: ${r.details}`);
        });
    }

    console.log('\n✅ All tests completed!');
  }
}

// Run tests if called directly
if (require.main === module) {
  const testSuite = new CvParserTestSuite();
  testSuite.runAllTests().catch(console.error);
}

module.exports = { CvParserTestSuite };














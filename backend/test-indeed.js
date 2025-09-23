import { fetchIndeed } from './src/monitoring/indeed.js';

async function testIndeed() {
  console.log('🔍 Testing Indeed scraper...\n');
  
  try {
    // Test with default parameters
    console.log('Searching for "public affairs" jobs in "United Kingdom"...');
    const results = await fetchIndeed();
    
    console.log(`\n✅ Found ${results.length} job listings:\n`);
    
    results.forEach((job, index) => {
      console.log(`${index + 1}. ${job.title}`);
      console.log(`   Company: ${job.org}`);
      console.log(`   Salary: ${job.salary || 'Not specified'}`);
      console.log(`   Link: ${job.link}`);
      console.log('');
    });
    
    if (results.length === 0) {
      console.log('No jobs found. This might be due to:');
      console.log('- Indeed blocking the request');
      console.log('- Changes in their HTML structure');
      console.log('- Network issues');
    }
    
  } catch (error) {
    console.error('❌ Error running Indeed scraper:', error.message);
  }
}

// Run the test
testIndeed();






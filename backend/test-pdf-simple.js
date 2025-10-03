// Test PDF parsing with a simple approach
import fs from 'fs';
import pdfParse from 'pdf-parse';

async function testPDF() {
  console.log('=== TESTING PDF PARSING ===');
  
  try {
    // Test different PDF files
    const pdfFiles = [
      './test/data/simple-test.pdf',
      './test/data/05-versions-space.pdf',
      './tests/sample-real.pdf',
      './tests/sample.pdf'
    ];
    
    for (const pdfFile of pdfFiles) {
      console.log(`\nTesting ${pdfFile}...`);
      try {
        const buffer = fs.readFileSync(pdfFile);
        console.log('File size:', buffer.length, 'bytes');
        console.log('PDF header check:', buffer.slice(0, 4).toString() === '%PDF');
        
        const pdfData = await pdfParse(buffer);
        console.log('✅ PDF parsed successfully!');
        console.log('Pages:', pdfData.numpages);
        console.log('Text length:', pdfData.text.length);
        console.log('First 200 chars:', pdfData.text.substring(0, 200));
        break; // Stop at first successful PDF
      } catch (error) {
        console.log('❌ PDF parsing failed:', error.message);
      }
    }
    
  } catch (error) {
    console.log('❌ All PDFs failed:', error.message);
  }
}

testPDF();

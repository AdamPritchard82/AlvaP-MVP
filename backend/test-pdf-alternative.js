// Test PDF parsing with alternative libraries
import fs from 'fs';
import pdfParse from 'pdf-parse';

async function testPDFAlternative() {
  console.log('=== TESTING PDF PARSING WITH ALTERNATIVE APPROACH ===');
  
  try {
    // Test with a real PDF from the internet or create a proper one
    console.log('Testing with pdf-parse options...');
    
    const buffer = fs.readFileSync('./test/data/simple-test.pdf');
    
    // Try with different options
    const options = {
      max: 0, // No page limit
      version: 'v1.10.100' // Use specific PDF.js version
    };
    
    const pdfData = await pdfParse(buffer, options);
    console.log('✅ PDF parsed successfully!');
    console.log('Pages:', pdfData.numpages);
    console.log('Text length:', pdfData.text.length);
    console.log('Text content:', pdfData.text);
    
  } catch (error) {
    console.log('❌ PDF parsing failed:', error.message);
    
    // Try a different approach - check if it's a text file with .pdf extension
    console.log('\nChecking if file is actually text...');
    try {
      const buffer = fs.readFileSync('./test/data/simple-test.pdf');
      const text = buffer.toString('utf8');
      console.log('File as text:', text.substring(0, 200));
      
      // If it contains PDF structure, try to extract text manually
      if (text.includes('John Smith')) {
        console.log('✅ Found text content in PDF file!');
        console.log('Extracted text:', text);
      }
    } catch (textError) {
      console.log('Text extraction also failed:', textError.message);
    }
  }
}

testPDFAlternative();















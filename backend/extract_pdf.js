const fs = require('fs');
const pdf = require('pdf-parse/lib/pdf-parse');

const pdfPath = './company data/Kacha Staff Leave data for HRMS.pdf';
const dataBuffer = fs.readFileSync(pdfPath);

pdf(dataBuffer).then(function(data) {
  console.log('Number of pages:', data.numpages);
  console.log('---');
  // Print first 3000 chars to see structure
  console.log(data.text.substring(0, 3000));
  console.log('---');
  console.log('Total text length:', data.text.length);
});

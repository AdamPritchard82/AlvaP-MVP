// Minimal lock test for parseCVContent
const { parseCVContent } = require('../src/parsers/textParser');

const sample = `
Adam Pritchard
Flat 22 Sherbourne Court
SE20 7SL
Adam@door10.co.uk
+44 78808 62437

WORK EXPERIENCE
Director of Government Relations at BigCo Ltd
London, UK
2015 – Present
`;

const result = parseCVContent(sample);
console.log('LOCK TEST RESULT:', result);

if (!result.phone.includes('78808')) throw new Error('Phone parsing regressed');
if (!/Director of Government Relations/i.test(result.currentTitle)) throw new Error('Title parsing regressed');
if (!/BigCo/i.test(result.currentEmployer)) throw new Error('Employer parsing regressed');

console.log('OK: phone/title/employer parsing locked');



// Conservative phone number fallback for when .NET parser returns null
// Only use if you have raw text from the vendor response

export function fallbackPhone(rawText, region = 'GB') {
  if (!rawText) return undefined;
  
  // Conservative regex for phone numbers
  const m = rawText.match(/(?:\+?\d[\s().-]?){9,15}/g)?.[0];
  if (!m) return undefined;
  
  // Basic validation - check if it looks like a phone number
  const digits = m.replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 15) return undefined;
  
  return m.trim();
}

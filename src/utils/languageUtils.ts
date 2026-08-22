const languageMap = {
en: 'English',
es: 'Español (Spanish)',
pt: 'Português (Portuguese)',
fr: 'Français (French)',
de: 'Deutsch (German)',
it: 'Italiano (Italian)',
ja: '日本語 (Japanese)',
ko: '한국어 (Korean)',
zh: '中文 (Chinese)',
ar: 'العربية (Arabic)',
hi: 'हिन्दी (Hindi)',
ru: 'Русский (Russian)',
// Add more as needed
};

export const getLanguageName = (code) => {
if (!code) return 'Unknown';
if (code.startsWith('local:')) return code.slice('local:'.length);
return languageMap[code.toLowerCase()] || code.toUpperCase();
};

// Could also add a function to get a sorted list of common languages for UI purposes
export const commonLanguages = [
{ code: 'en', name: 'English' },
{ code: 'es', name: 'Español' },
{ code: 'fr', name: 'Français' },
{ code: 'de', name: 'Deutsch' },
{ code: 'pt', name: 'Português' },
];

const flagMap = {
  en: '🇺🇸', // US flag for English (common default)
  es: '🇪🇸', // Spain flag for Spanish
  pt: '🇵🇹', // Portugal flag for Portuguese (could also use BR)
  fr: '🇫🇷', // France flag
  de: '🇩🇪', // Germany flag
  it: '🇮🇹', // Italy flag
  ja: '🇯🇵', // Japan flag
  ko: '🇰🇷', // South Korea flag
  zh: '🇨🇳', // China flag
  ar: '🇸🇦', // Saudi Arabia flag for Arabic (common default)
  hi: '🇮🇳', // India flag for Hindi
  ru: '🇷🇺', // Russia flag
  // Add more as needed, be mindful of regional variations vs. general language
};

export const getLanguageFlag = (code) => {
  if (!code) return '';
  return flagMap[code.toLowerCase()] || '🏳️'; // Default to white flag
};
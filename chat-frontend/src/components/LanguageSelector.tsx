import { useTranslation } from 'react-i18next';

interface Language {
  code: string;
  name: string;
  flag: string;
}

const languages: Language[] = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'uk', name: 'Українська', flag: '🇺🇦' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
];

interface LanguageSelectorProps {
  variant?: 'buttons' | 'dropdown';
  className?: string;
}

export default function LanguageSelector({ 
  variant = 'buttons',
  className = '' 
}: LanguageSelectorProps) {
  const { i18n } = useTranslation();
  const currentLang = i18n.language;

  const handleLanguageChange = (langCode: string) => {
    i18n.changeLanguage(langCode);
  };

  if (variant === 'dropdown') {
    return (
      <select
        value={currentLang}
        onChange={(e) => handleLanguageChange(e.target.value)}
        className={`input ${className}`}
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.flag} {lang.name}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {languages.map((lang) => (
        <button
          key={lang.code}
          onClick={() => handleLanguageChange(lang.code)}
          className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-2 rounded-xl text-sm font-medium transition-all duration-300 min-h-[44px] ${
            currentLang === lang.code
              ? 'bg-primary-100 text-primary-700 ring-2 ring-primary-200'
              : 'bg-white/90 text-neutral-600 hover:bg-white hover:text-neutral-700 shadow-soft'
          }`}
          title={lang.name}
        >
          <span className="text-lg">{lang.flag}</span>
          <span className="hidden sm:inline">{lang.name}</span>
        </button>
      ))}
    </div>
  );
}


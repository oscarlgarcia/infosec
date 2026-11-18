import type { Language } from '../i18n';

export interface Country {
  code: string;
  name: string;
  nameEn: string;
}

export const COUNTRIES: Country[] = [
  { code: 'ES', name: 'España', nameEn: 'Spain' },
  { code: 'US', name: 'Estados Unidos', nameEn: 'United States' },
  { code: 'GB', name: 'Reino Unido', nameEn: 'United Kingdom' },
  { code: 'FR', name: 'Francia', nameEn: 'France' },
  { code: 'DE', name: 'Alemania', nameEn: 'Germany' },
  { code: 'IT', name: 'Italia', nameEn: 'Italy' },
  { code: 'PT', name: 'Portugal', nameEn: 'Portugal' },
  { code: 'NL', name: 'Países Bajos', nameEn: 'Netherlands' },
  { code: 'BE', name: 'Bélgica', nameEn: 'Belgium' },
  { code: 'CH', name: 'Suiza', nameEn: 'Switzerland' },
  { code: 'AT', name: 'Austria', nameEn: 'Austria' },
  { code: 'IE', name: 'Irlanda', nameEn: 'Ireland' },
  { code: 'SE', name: 'Suecia', nameEn: 'Sweden' },
  { code: 'NO', name: 'Noruega', nameEn: 'Norway' },
  { code: 'DK', name: 'Dinamarca', nameEn: 'Denmark' },
  { code: 'FI', name: 'Finlandia', nameEn: 'Finland' },
  { code: 'PL', name: 'Polonia', nameEn: 'Poland' },
  { code: 'CZ', name: 'República Checa', nameEn: 'Czech Republic' },
  { code: 'HU', name: 'Hungría', nameEn: 'Hungary' },
  { code: 'RO', name: 'Rumania', nameEn: 'Romania' },
  { code: 'GR', name: 'Grecia', nameEn: 'Greece' },
  { code: 'MX', name: 'México', nameEn: 'Mexico' },
  { code: 'AR', name: 'Argentina', nameEn: 'Argentina' },
  { code: 'CL', name: 'Chile', nameEn: 'Chile' },
  { code: 'CO', name: 'Colombia', nameEn: 'Colombia' },
  { code: 'BR', name: 'Brasil', nameEn: 'Brazil' },
  { code: 'PE', name: 'Perú', nameEn: 'Peru' },
  { code: 'VE', name: 'Venezuela', nameEn: 'Venezuela' },
  { code: 'CA', name: 'Canadá', nameEn: 'Canada' },
  { code: 'AU', name: 'Australia', nameEn: 'Australia' },
  { code: 'JP', name: 'Japón', nameEn: 'Japan' },
  { code: 'CN', name: 'China', nameEn: 'China' },
  { code: 'IN', name: 'India', nameEn: 'India' },
  { code: 'SG', name: 'Singapur', nameEn: 'Singapore' },
  { code: 'HK', name: 'Hong Kong', nameEn: 'Hong Kong' },
  { code: 'KR', name: 'Corea del Sur', nameEn: 'South Korea' },
  { code: 'AE', name: 'Emiratos Árabes Unidos', nameEn: 'United Arab Emirates' },
  { code: 'SA', name: 'Arabia Saudita', nameEn: 'Saudi Arabia' },
  { code: 'IL', name: 'Israel', nameEn: 'Israel' },
  { code: 'ZA', name: 'Sudáfrica', nameEn: 'South Africa' },
  { code: 'NG', name: 'Nigeria', nameEn: 'Nigeria' },
  { code: 'EG', name: 'Egipto', nameEn: 'Egypt' },
  { code: 'MA', name: 'Marruecos', nameEn: 'Morocco' },
];

export function countryName(code: string | null | undefined, language: Language): string {
  if (!code) return '';
  const country = COUNTRIES.find((item) => item.code.toUpperCase() === code.toUpperCase());
  if (!country) return code;
  return language === 'es' ? country.name : country.nameEn;
}

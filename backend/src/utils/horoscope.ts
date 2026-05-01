/**
 * Horoscope Utility
 * Provides zodiac sign detection and horoscope messages
 */

interface ZodiacInfo {
  sign: string;
  symbol: string;
  element: string;
  horoscope: string;
}

const ZODIAC_SIGNS: { sign: string; symbol: string; element: string; startMonth: number; startDay: number; endMonth: number; endDay: number }[] = [
  { sign: "Capricorn", symbol: "♑", element: "Earth", startMonth: 12, startDay: 22, endMonth: 1, endDay: 19 },
  { sign: "Aquarius", symbol: "♒", element: "Air", startMonth: 1, startDay: 20, endMonth: 2, endDay: 18 },
  { sign: "Pisces", symbol: "♓", element: "Water", startMonth: 2, startDay: 19, endMonth: 3, endDay: 20 },
  { sign: "Aries", symbol: "♈", element: "Fire", startMonth: 3, startDay: 21, endMonth: 4, endDay: 19 },
  { sign: "Taurus", symbol: "♉", element: "Earth", startMonth: 4, startDay: 20, endMonth: 5, endDay: 20 },
  { sign: "Gemini", symbol: "♊", element: "Air", startMonth: 5, startDay: 21, endMonth: 6, endDay: 20 },
  { sign: "Cancer", symbol: "♋", element: "Water", startMonth: 6, startDay: 21, endMonth: 7, endDay: 22 },
  { sign: "Leo", symbol: "♌", element: "Fire", startMonth: 7, startDay: 23, endMonth: 8, endDay: 22 },
  { sign: "Virgo", symbol: "♍", element: "Earth", startMonth: 8, startDay: 23, endMonth: 9, endDay: 22 },
  { sign: "Libra", symbol: "♎", element: "Air", startMonth: 9, startDay: 23, endMonth: 10, endDay: 22 },
  { sign: "Scorpio", symbol: "♏", element: "Water", startMonth: 10, startDay: 23, endMonth: 11, endDay: 21 },
  { sign: "Sagittarius", symbol: "♐", element: "Fire", startMonth: 11, startDay: 22, endMonth: 12, endDay: 21 },
];

const HOROSCOPE_MESSAGES: Record<string, string[]> = {
  Aries: [
    "Your energy and enthusiasm are contagious today. Leadership opportunities await!",
    "Bold moves will pay off. Trust your instincts and take the initiative.",
    "Your pioneering spirit shines bright. New beginnings are on the horizon.",
  ],
  Taurus: [
    "Stability and determination are your strengths today. Keep building steadily.",
    "Your practical approach will lead to tangible results. Stay grounded.",
    "Patience brings rewards. Your dedication to quality is appreciated.",
  ],
  Gemini: [
    "Communication flows easily today. Share your ideas with confidence.",
    "Your adaptability opens new doors. Embrace variety and learning.",
    "Connections made today could lead to exciting opportunities.",
  ],
  Cancer: [
    "Your intuition guides you well. Trust your inner wisdom.",
    "Nurturing relationships brings joy. Your caring nature shines.",
    "Home and family matters receive positive energy today.",
  ],
  Leo: [
    "Your creativity is at its peak. Let your light shine!",
    "Leadership comes naturally to you today. Inspire others with your vision.",
    "Recognition for your efforts is coming. Keep being authentically you.",
  ],
  Virgo: [
    "Your attention to detail brings success. Quality work speaks volumes.",
    "Organization and planning lead to achievements. Trust your methods.",
    "Your analytical skills solve complex problems with ease.",
  ],
  Libra: [
    "Harmony and balance guide your decisions. Diplomacy wins the day.",
    "Partnerships flourish under your fair approach. Collaboration is key.",
    "Beauty and creativity inspire you. Share your aesthetic vision.",
  ],
  Scorpio: [
    "Your determination and focus bring transformation. Embrace change.",
    "Deep insights reveal hidden opportunities. Trust your perceptions.",
    "Your passion and intensity drive success. Channel it wisely.",
  ],
  Sagittarius: [
    "Adventure and learning expand your horizons. Embrace new experiences.",
    "Your optimism is infectious. Share your positive vision with others.",
    "Travel or education brings enlightenment. Stay curious and open.",
  ],
  Capricorn: [
    "Your ambition and discipline lead to achievement. Stay focused on goals.",
    "Hard work pays off in visible ways. Your reputation grows stronger.",
    "Leadership responsibilities find you ready. Trust your experience.",
  ],
  Aquarius: [
    "Innovation and originality set you apart. Think outside the box.",
    "Your humanitarian ideals inspire others. Make a positive difference.",
    "Technology and new methods bring breakthroughs. Embrace progress.",
  ],
  Pisces: [
    "Your creativity and imagination flow freely. Express yourself artistically.",
    "Intuition and empathy guide your connections. Trust your feelings.",
    "Dreams and inspiration bring insights. Listen to your inner voice.",
  ],
};

/**
 * Get zodiac sign from a date
 */
export function getZodiacSign(date: Date): ZodiacInfo {
  const month = date.getMonth() + 1;
  const day = date.getDate();

  for (const zodiac of ZODIAC_SIGNS) {
    const matchesStart = month === zodiac.startMonth && day >= zodiac.startDay;
    const matchesEnd = month === zodiac.endMonth && day <= zodiac.endDay;
    
    // Handle Capricorn which spans year boundary
    if (zodiac.sign === "Capricorn") {
      if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) {
        const horoscopes = HOROSCOPE_MESSAGES[zodiac.sign];
        const horoscope = horoscopes[Math.floor(Math.random() * horoscopes.length)];
        return { sign: zodiac.sign, symbol: zodiac.symbol, element: zodiac.element, horoscope };
      }
      continue;
    }
    
    if (matchesStart || matchesEnd) {
      const horoscopes = HOROSCOPE_MESSAGES[zodiac.sign];
      const horoscope = horoscopes[Math.floor(Math.random() * horoscopes.length)];
      return { sign: zodiac.sign, symbol: zodiac.symbol, element: zodiac.element, horoscope };
    }
  }

  // Default fallback (shouldn't happen)
  return { sign: "Unknown", symbol: "?", element: "Unknown", horoscope: "The stars align for a wonderful day!" };
}

/**
 * Calculate age from date of birth
 */
export function calculateAge(dateOfBirth: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const m = today.getMonth() - dateOfBirth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dateOfBirth.getDate())) {
    age--;
  }
  return age;
}

/**
 * Calculate years of service from employment start date
 */
export function calculateYearsOfService(startDate: Date): number {
  const today = new Date();
  let years = today.getFullYear() - startDate.getFullYear();
  const m = today.getMonth() - startDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < startDate.getDate())) {
    years--;
  }
  return years;
}

/**
 * Check if today is a milestone anniversary (5, 10, 15, 20, etc.)
 */
export function isMilestoneAnniversary(yearsOfService: number): boolean {
  return yearsOfService > 0 && yearsOfService % 5 === 0;
}

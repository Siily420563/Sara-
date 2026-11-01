// International / Observance Days Lookup Helper for SARA

interface DayObservance {
  month: number; // 1 - 12
  day: number;   // 1 - 31
  title: string;
}

const OBSERVANCES: DayObservance[] = [
  { month: 1, day: 1, title: "Global Family Day / New Year's Day" },
  { month: 1, day: 12, title: "National Youth Day" },
  { month: 1, day: 15, title: "Indian Army Day" },
  { month: 1, day: 24, title: "International Day of Education" },
  { month: 1, day: 26, title: "Republic Day of India" },
  { month: 2, day: 4, title: "World Cancer Day" },
  { month: 2, day: 13, title: "World Radio Day" },
  { month: 2, day: 14, title: "International Epilepsy Day" },
  { month: 2, day: 21, title: "International Mother Language Day" },
  { month: 2, day: 28, title: "National Science Day" },
  { month: 3, day: 3, title: "World Wildlife Day" },
  { month: 3, day: 8, title: "International Women's Day" },
  { month: 3, day: 14, title: "International Day of Mathematics (Pi Day)" },
  { month: 3, day: 20, title: "International Day of Happiness" },
  { month: 3, day: 21, title: "World Poetry Day" },
  { month: 3, day: 22, title: "World Water Day" },
  { month: 4, day: 7, title: "World Health Day" },
  { month: 4, day: 14, title: "Ambedkar Jayanti" },
  { month: 4, day: 18, title: "World Heritage Day" },
  { month: 4, day: 22, title: "Earth Day" },
  { month: 4, day: 23, title: "World Book Day" },
  { month: 5, day: 1, title: "International Workers' Day" },
  { month: 5, day: 3, title: "World Press Freedom Day" },
  { month: 5, day: 8, title: "World Red Cross Day" },
  { month: 5, day: 11, title: "National Technology Day" },
  { month: 5, day: 21, title: "National Anti-Terrorism Day" },
  { month: 5, day: 31, title: "World No Tobacco Day" },
  { month: 6, day: 5, title: "World Environment Day" },
  { month: 6, day: 8, title: "World Oceans Day" },
  { month: 6, day: 21, title: "International Yoga Day & World Music Day" },
  { month: 6, day: 23, title: "International Olympic Day" },
  { month: 7, day: 1, title: "National Doctors' Day" },
  { month: 7, day: 11, title: "World Population Day" },
  { month: 7, day: 17, title: "World Day for International Justice" },
  { month: 7, day: 26, title: "Kargil Vijay Diwas" },
  { month: 7, day: 29, title: "International Tiger Day" },
  { month: 8, day: 7, title: "National Handloom Day" },
  { month: 8, day: 9, title: "International Day of the World's Indigenous Peoples" },
  { month: 8, day: 12, title: "International Youth Day" },
  { month: 8, day: 13, title: "International Left-Handers Day" },
  { month: 8, day: 15, title: "Indian Independence Day" },
  { month: 8, day: 19, title: "World Photography Day & World Humanitarian Day" },
  { month: 8, day: 29, title: "National Sports Day" },
  { month: 9, day: 5, title: "Teachers' Day" },
  { month: 9, day: 8, title: "International Literacy Day" },
  { month: 9, day: 15, title: "Engineers' Day & International Day of Democracy" },
  { month: 9, day: 16, title: "World Ozone Day" },
  { month: 9, day: 21, title: "International Day of Peace" },
  { month: 9, day: 27, title: "World Tourism Day" },
  { month: 10, day: 2, title: "Gandhi Jayanti & International Day of Non-Violence" },
  { month: 10, day: 5, title: "World Teachers' Day" },
  { month: 10, day: 8, title: "Indian Air Force Day" },
  { month: 10, day: 10, title: "World Mental Health Day" },
  { month: 10, day: 11, title: "International Day of the Girl Child" },
  { month: 10, day: 16, title: "World Food Day" },
  { month: 10, day: 24, title: "United Nations Day" },
  { month: 10, day: 31, title: "National Unity Day (Rashtriya Ekta Diwas)" },
  { month: 11, day: 11, title: "National Education Day" },
  { month: 11, day: 14, title: "Children's Day" },
  { month: 11, day: 19, title: "World Toilet Day & International Men's Day" },
  { month: 11, day: 26, title: "Constitution Day of India (Samvidhan Divas)" },
  { month: 12, day: 1, title: "World AIDS Day" },
  { month: 12, day: 4, title: "Indian Navy Day" },
  { month: 12, day: 10, title: "Human Rights Day" },
  { month: 12, day: 16, title: "Vijay Diwas" },
  { month: 12, day: 22, title: "National Mathematics Day" },
  { month: 12, day: 23, title: "Kisan Diwas (Farmers' Day)" },
  { month: 12, day: 25, title: "Christmas Day & Good Governance Day" },
];

export function getTodayObservance(date: Date = new Date()): string | null {
  const month = date.getMonth() + 1; // 1-12
  const day = date.getDate();
  const found = OBSERVANCES.find(o => o.month === month && o.day === day);
  return found ? found.title : null;
}

export interface DailyQuoteItem {
  id: number;
  quote: string;
  author: string;
  category: 'Mindset' | 'Productivity' | 'Confidence' | 'Focus' | 'Wisdom' | 'Discipline';
  theme: string;
}

export const CURATED_DAILY_QUOTES: DailyQuoteItem[] = [
  {
    id: 1,
    quote: "Har subah ek naya panna hai tumhari kahani ka. Aaj ka din itna behtar banao ki kal tum khud par naaz karo.",
    author: "SARA Daily Wisdom",
    category: "Mindset",
    theme: "Nayi Shuruaat"
  },
  {
    id: 2,
    quote: "Focus is not about doing 10 things at once. It's about doing the ONE most important thing with 100% devotion.",
    author: "Focus & Discipline",
    category: "Focus",
    theme: "Deep Work"
  },
  {
    id: 3,
    quote: "Mushkilein sabhi ki zindagi me aati hain, lekin jeetta wahi hai jo rukta nahi, bas aage badhta rehta hai.",
    author: "APJ Abdul Kalam Inspiration",
    category: "Confidence",
    theme: "Perseverance"
  },
  {
    id: 4,
    quote: "Your future is created by what you do today, not what you plan for tomorrow. Shuruat abhi se karo.",
    author: "Action Principles",
    category: "Productivity",
    theme: "Immediate Action"
  },
  {
    id: 5,
    quote: "Khud par vishwas rakho. Jitna tum sochte ho, tum usse kahin zyada capable aur strong ho.",
    author: "SARA Inner Strength",
    category: "Confidence",
    theme: "Self Belief"
  },
  {
    id: 6,
    quote: "Small consistent steps lead to massive results. Aaj sirf 1% behtar bano kal se.",
    author: "Atomic Habits Wisdom",
    category: "Discipline",
    theme: "1% Improvement"
  },
  {
    id: 7,
    quote: "Jab raste mushkil lagne lagein, toh yaad karo tumne shuru kyun kiya tha. Lakshya ko bhoolna mat.",
    author: "Motivation Matrix",
    category: "Mindset",
    theme: "Remember Your Why"
  },
  {
    id: 8,
    quote: "Discipline is choosing between what you want NOW and what you want MOST. Make the right choice today.",
    author: "Abraham Lincoln Philosophy",
    category: "Discipline",
    theme: "Master Your Urges"
  },
  {
    id: 9,
    quote: "Galtiyan saboot hain ki tum koshish kar rahe ho. Seekho, sudhaaro aur aage badho.",
    author: "Growth Mindset",
    category: "Wisdom",
    theme: "Learn from Failure"
  },
  {
    id: 10,
    quote: "Calm mind is the ultimate superpower. Pareshaniyon ke beech shaant rehna hi asli taakat hai.",
    author: "Inner Calm",
    category: "Mindset",
    theme: "Peace of Mind"
  },
  {
    id: 11,
    quote: "Don't count the days, make the days count. Aaj ka din poore shauk aur passion ke saath jiyo.",
    author: "Muhammad Ali",
    category: "Productivity",
    theme: "High Energy"
  },
  {
    id: 12,
    quote: "Kamyabi ek raat me nahi milti, lekin lagataar koshish karne se ek din zaroor milti hai.",
    author: "Daily Victory",
    category: "Confidence",
    theme: "Consistency"
  },
  {
    id: 13,
    quote: "Limit your distractions, multiply your opportunities. Mobile ki notifications band karo, apne sapno par dhyan do.",
    author: "Digital Minimalism",
    category: "Focus",
    theme: "Zero Distractions"
  },
  {
    id: 14,
    quote: "Apne aap ko kisi aur se compare mat karo. Tumhara muqabla sirf us kal wale tum se hai.",
    author: "Authentic Life",
    category: "Wisdom",
    theme: "Self Growth"
  },
  {
    id: 15,
    quote: "Opportunities don't just happen, you create them. Apni kismat apne dum par likho.",
    author: "Chris Grosser",
    category: "Productivity",
    theme: "Create Chances"
  },
  {
    id: 16,
    quote: "Jo log waqt ki qadr karte hain, waqt unhe unki manzil tak pohcha kar hi dam leta hai.",
    author: "Time Mastery",
    category: "Discipline",
    theme: "Respect Time"
  },
  {
    id: 17,
    quote: "Energy flows where attention goes. Apni soch ko sakaratmak (positive) aur proactive rakho.",
    author: "Mind Alignment",
    category: "Mindset",
    theme: "Positive Vibration"
  },
  {
    id: 18,
    quote: "The secret of getting ahead is getting started. Sochna kam karo, kaam shuru karo!",
    author: "Mark Twain",
    category: "Productivity",
    theme: "Start Today"
  },
  {
    id: 19,
    quote: "Zindagi me kabhi kabhi ruk kar lambi saans lena bhi zaroori hai. Recharge yourself, you are doing great.",
    author: "SARA Self Care",
    category: "Mindset",
    theme: "Recharge & Breathe"
  },
  {
    id: 20,
    quote: "Believe you can and you're halfway there. Aadha safar toh tumhare hausle se hi tay ho jata hai.",
    author: "Theodore Roosevelt",
    category: "Confidence",
    theme: "Courage"
  },
  {
    id: 21,
    quote: "Jab tak aap haar nahi maante, tab tak aapko koi hara nahi sakta. Keep pushing through!",
    author: "Unstoppable Spirit",
    category: "Confidence",
    theme: "Never Quit"
  },
  {
    id: 22,
    quote: "Simplicity is the keynote of all true elegance. Zindagi aur kaam dono ko simple rakho, confusion khatam ho jayegi.",
    author: "Coco Chanel & Wisdom",
    category: "Focus",
    theme: "Simplicity"
  },
  {
    id: 23,
    quote: "A winner is a dreamer who never gives up. Apne sapno ko kabhi kamzor mat padne do.",
    author: "Nelson Mandela",
    category: "Confidence",
    theme: "Dream Big"
  },
  {
    id: 24,
    quote: "Dimaag ko shanti aur dil ko umeed do. Aaj ka din tumhare liye naye raste kholega.",
    author: "SARA Serenity",
    category: "Mindset",
    theme: "Hope & Clarity"
  },
  {
    id: 25,
    quote: "Hard work beats talent when talent fails to work hard. Apni mehnat par kabhi shak mat karo.",
    author: "Tim Notke",
    category: "Discipline",
    theme: "Pure Grit"
  },
  {
    id: 26,
    quote: "Gratitude turns what we have into enough. Aaj un cheezon ke liye shukr ada karo jo tumhare paas hain.",
    author: "Daily Gratitude",
    category: "Wisdom",
    theme: "Gratitude"
  },
  {
    id: 27,
    quote: "Courage doesn't always roar. Sometimes courage is the quiet voice at the end of the day saying, 'I will try again tomorrow.'",
    author: "Mary Anne Radmacher",
    category: "Mindset",
    theme: "Quiet Resilience"
  },
  {
    id: 28,
    quote: "Plan your work and work your plan. Calendar aur schedule ko follow karo, success automatic ho jayegi.",
    author: "Napoleon Hill",
    category: "Productivity",
    theme: "Schedule Power"
  },
  {
    id: 29,
    quote: "Apne lakshya ko itna bada rakho ki chhote mote problems uske saamne nazar hi na aayein.",
    author: "Visionary Path",
    category: "Confidence",
    theme: "Big Vision"
  },
  {
    id: 30,
    quote: "Today is a great day to learn something new. Seekhne ki bhookh hi insaan ko sabse aage le jaati hai.",
    author: "Eternal Student",
    category: "Wisdom",
    theme: "Lifelong Learning"
  },
  {
    id: 31,
    quote: "You have survived 100% of your worst days. You are far more resilient than you know. Keep smiling!",
    author: "SARA Heartfelt Note",
    category: "Mindset",
    theme: "Inner Champion"
  }
];

/**
 * Returns a quote automatically tailored for the current day of the year/month.
 * Guaranteed to change every single day at midnight!
 */
export function getQuoteForToday(seedDate?: Date): DailyQuoteItem {
  const d = seedDate || new Date();
  // Compute day of year
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = (d.getTime() - start.getTime()) + ((start.getTimezoneOffset() - d.getTimezoneOffset()) * 60 * 1000);
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  
  const index = Math.abs(dayOfYear) % CURATED_DAILY_QUOTES.length;
  return CURATED_DAILY_QUOTES[index];
}

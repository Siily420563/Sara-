/**
 * SARA Intelligent Fuzzy Contact Search & Synchronization Engine
 * 
 * Features:
 * - Robust Levenshtein distance & similarity scoring
 * - Indian phonetic & transliteration matching (Ashu <-> Aashu, Abhishek <-> Abhisek)
 * - Devanagari Hindi to Hinglish transliteration (गाँव <-> gaon, पापा <-> papa)
 * - Emoji & punctuation stripping (Aashu ..👻 -> aashu)
 * - Token & substring matching (Abhishek Mirzapur -> mirzapur)
 * - Relationship & nickname matching (Papa, Mummy, Bhai, Dost)
 * - Complete vCard (.vcf) bulk import and export parser
 */

export interface PhoneContact {
  id: string;
  name: string;
  phone: string;
  relationship?: string;
  email?: string;
}

export interface MatchResult {
  contact: PhoneContact;
  score: number;
  matchReason: string;
}

// Hindi script common word conversions to Hinglish
const HINDI_WORD_MAP: Record<string, string> = {
  'गाँव': 'gaon',
  'गांव': 'gaon',
  'पापा': 'papa',
  'पिताजी': 'papa',
  'मम्मी': 'mummy',
  'माँ': 'maa',
  'माताजी': 'mummy',
  'भाई': 'bhai',
  'भैया': 'bhaiya',
  'दीदी': 'didi',
  'बहन': 'behen',
  'दोस्त': 'dost',
  'सर': 'sir',
  'बॉस': 'boss',
  'घर': 'ghar',
};

// Relationship synonyms dictionary for Indian English & Hindi
const RELATIONSHIP_MAP: Record<string, string[]> = {
  papa: ['papa', 'pitaji', 'father', 'dad', 'daddy', 'pop', 'bapu'],
  mummy: ['mummy', 'mom', 'mother', 'maa', 'mataji', 'ammi', 'mum'],
  bhai: ['bhai', 'bhaiya', 'brother', 'bro', 'veer', 'bhaijaan'],
  didi: ['didi', 'sister', 'sis', 'behen', 'behna', 'aapi'],
  babu: ['babu', 'shona', 'jaan', 'baby', 'sweetheart', 'darling', 'gf', 'bf', 'girlfriend', 'boyfriend'],
  wife: ['wife', 'patni', 'biwi', 'wifey', 'begum'],
  husband: ['husband', 'pati', 'shohar', 'hubby'],
  dost: ['dost', 'friend', 'yaar', 'buddy', 'pal', 'mitra'],
  boss: ['boss', 'sir', 'manager', 'lead', 'sirji'],
  home: ['home', 'ghar', 'residence', 'family'],
};

/**
 * Strips emojis, symbols, and formatting punctuation
 */
export function cleanRawText(str: string): string {
  if (!str) return '';
  let cleaned = str
    // Replace Hindi words if found
    .replace(/(गाँव|गांव|पापा|पिताजी|मम्मी|माँ|माताजी|भाई|भैया|दीदी|बहन|दोस्त|सर|बॉस|घर)/g, (match) => HINDI_WORD_MAP[match] || match)
    // Remove emojis and surrogate pairs
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, ' ')
    // Replace punctuation and parentheses with spaces
    .replace(/[\(\)\[\]\{\}\.,;:!?'"`~@#\$%\^&\*\-_+=\\/|<>👻🥰🍰❤️✨🔥]/g, ' ')
    .toLowerCase()
    .trim();

  // Collapse multiple spaces into single space
  return cleaned.replace(/\s+/g, ' ');
}

/**
 * Computes Indian phonetic key for robust typo-tolerant matching
 * Handles: aashu <-> ashu, abhishek <-> abhisek, ee <-> i, oo <-> u, w <-> v
 */
export function toPhoneticKey(str: string): string {
  if (!str) return '';
  let s = cleanRawText(str);

  // Normalize repeated vowels & common Indian variations
  s = s
    .replace(/aa+/g, 'a')
    .replace(/ee+/g, 'i')
    .replace(/oo+/g, 'u')
    .replace(/ii+/g, 'i')
    .replace(/uu+/g, 'u')
    .replace(/sh/g, 's')
    .replace(/sch/g, 's')
    .replace(/ph/g, 'f')
    .replace(/w/g, 'v')
    .replace(/ch/g, 'c')
    .replace(/ksh/g, 'x')
    .replace(/zh/g, 'j')
    .replace(/z/g, 'j')
    .replace(/dh/g, 'd')
    .replace(/th/g, 't')
    .replace(/bh/g, 'b')
    .replace(/kh/g, 'k')
    .replace(/gh/g, 'g')
    .replace(/jh/g, 'j')
    .replace(/ck/g, 'k');

  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Standard Levenshtein distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = [];
  for (let i = 0; i <= m; i++) {
    dp[i] = [i];
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return dp[m][n];
}

/**
 * Normalized similarity ratio between 0.0 and 1.0
 */
export function similarityRatio(a: string, b: string): number {
  if (!a && !b) return 1.0;
  if (!a || !b) return 0.0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(a, b);
  return Math.max(0, 1 - dist / maxLen);
}

/**
 * Normalize phone numbers by stripping non-numeric characters
 */
export function cleanPhoneNumber(phone?: string): string {
  if (!phone) return '';
  return phone.replace(/[^\d+]/g, '');
}

/**
 * Core scoring engine for a single contact against a search query
 */
export function scoreContact(contact: PhoneContact, query: string): { score: number; reason: string } {
  const qClean = cleanRawText(query);
  const qPhonetic = toPhoneticKey(query);
  if (!qClean) return { score: 0, reason: 'Empty query' };

  const rawName = contact.name || '';
  const cClean = cleanRawText(rawName);
  const cPhonetic = toPhoneticKey(rawName);
  const cRel = cleanRawText(contact.relationship || '');
  const cRelPhonetic = toPhoneticKey(contact.relationship || '');
  const cPhone = cleanPhoneNumber(contact.phone);
  const hasPhoneBonus = cPhone.length >= 6 ? 10 : 0;

  // 1. Direct Phone Number Match (e.g. user typed digits)
  const qDigits = query.replace(/[^\d]/g, '');
  if (qDigits.length >= 4 && cPhone.includes(qDigits)) {
    return { score: 95 + hasPhoneBonus, reason: 'Phone number match' };
  }

  // 2. Exact Clean String Match
  if (cClean === qClean) {
    return { score: 92 + hasPhoneBonus, reason: 'Exact name match' };
  }

  // 3. Exact Phonetic Match (e.g. "ashu" === "aashu" or "abhishek" === "abhisek")
  if (cPhonetic === qPhonetic) {
    return { score: 88 + hasPhoneBonus, reason: 'Phonetic name match' };
  }

  // 4. Token / Word Inclusion
  // Example: Query is "mirzapur", Contact is "Abhishek Mirzapur"
  // Example: Query is "bunty", Contact is "Aayushman (bunty)"
  const qWords = qClean.split(' ').filter(Boolean);
  const cWords = cClean.split(' ').filter(Boolean);

  const matchedTokensCount = qWords.filter(qw => cWords.some(cw => cw.includes(qw) || qw.includes(cw))).length;
  if (qWords.length > 0 && matchedTokensCount === qWords.length) {
    return { score: 85 + hasPhoneBonus, reason: 'Full token match' };
  }

  if (matchedTokensCount > 0) {
    const tokenScore = 70 + (matchedTokensCount / qWords.length) * 15;
    return { score: tokenScore + hasPhoneBonus, reason: 'Partial token match' };
  }

  // 5. Prefix Match (e.g. "Abhi" matches "Abhishek", "Adar" matches "Adarsh")
  if (cClean.startsWith(qClean) || qClean.startsWith(cClean)) {
    return { score: 82 + hasPhoneBonus, reason: 'Prefix match' };
  }

  // 6. Substring Match (e.g. "Dubey" in "Abhishek Dubey")
  if (cClean.includes(qClean) || qClean.includes(cClean)) {
    return { score: 78 + hasPhoneBonus, reason: 'Substring match' };
  }

  // 7. Relationship / Nickname Check
  // Example: query "Papa", contact relationship "Father" or contact name "Papa"
  for (const [key, synonyms] of Object.entries(RELATIONSHIP_MAP)) {
    const queryMatchesSynonym = synonyms.some(s => qClean.includes(s) || qPhonetic.includes(toPhoneticKey(s)));
    if (queryMatchesSynonym) {
      // Check if contact has this synonym in relationship or name
      const contactMatchesSynonym = synonyms.some(s => 
        cRel.includes(s) || 
        cClean.includes(s) || 
        cPhonetic.includes(toPhoneticKey(s))
      );
      if (contactMatchesSynonym) {
        return { score: 85 + hasPhoneBonus, reason: `Relationship match (${key})` };
      }
    }
  }

  // 8. Fuzzy Levenshtein / Similarity Match
  // Compare full string similarity and word-by-word similarity
  const fullSim = similarityRatio(cClean, qClean);
  const phoneticSim = similarityRatio(cPhonetic, qPhonetic);
  let bestWordSim = 0;

  for (const cw of cWords) {
    for (const qw of qWords) {
      const wSim = similarityRatio(cw, qw);
      const wPhoneticSim = similarityRatio(toPhoneticKey(cw), toPhoneticKey(qw));
      const maxWSim = Math.max(wSim, wPhoneticSim);
      if (maxWSim > bestWordSim) bestWordSim = maxWSim;
    }
  }

  const highestSim = Math.max(fullSim, phoneticSim, bestWordSim);

  if (highestSim >= 0.72) {
    return { score: Math.round(highestSim * 80) + hasPhoneBonus, reason: `Fuzzy similarity (${Math.round(highestSim * 100)}%)` };
  } else if (highestSim >= 0.58) {
    return { score: Math.round(highestSim * 65) + hasPhoneBonus, reason: `Approximate match (${Math.round(highestSim * 100)}%)` };
  }

  return { score: 0, reason: 'No match' };
}

/**
 * Searches and ranks contacts using fuzzy algorithm
 */
export function searchContactsFuzzy(
  query: string,
  contacts: PhoneContact[],
  limit = 10,
  minScore = 45
): MatchResult[] {
  if (!query || !query.trim() || !contacts || contacts.length === 0) {
    return [];
  }

  const results: MatchResult[] = [];

  for (const contact of contacts) {
    const { score, reason } = scoreContact(contact, query);
    if (score >= minScore) {
      results.push({
        contact,
        score,
        matchReason: reason
      });
    }
  }

  // Sort descending by score
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, limit);
}

/**
 * Finds the single best matching contact for calling or messaging
 */
export function findBestMatchingContact(
  query: string,
  contacts: PhoneContact[]
): MatchResult | null {
  const matches = searchContactsFuzzy(query, contacts, 1, 48);
  return matches.length > 0 ? matches[0] : null;
}

export interface AmbiguityResult {
  bestMatch: MatchResult | null;
  isAmbiguous: boolean;
  candidates: MatchResult[];
}

/**
 * Detects if a query matches multiple contacts ambiguously.
 * Prevents SARA from guessing when multiple people share the same name (e.g. 2 Abhisheks).
 */
export function findMatchingContactsWithAmbiguity(
  query: string,
  contacts: PhoneContact[]
): AmbiguityResult {
  if (!query || !query.trim() || !contacts || contacts.length === 0) {
    return { bestMatch: null, isAmbiguous: false, candidates: [] };
  }

  const matches = searchContactsFuzzy(query, contacts, 5, 48);
  if (matches.length === 0) {
    return { bestMatch: null, isAmbiguous: false, candidates: [] };
  }
  if (matches.length === 1) {
    return { bestMatch: matches[0], isAmbiguous: false, candidates: matches };
  }

  const top = matches[0];
  const second = matches[1];
  const scoreDiff = top.score - second.score;

  // Check if both top matches share the query token or have close scores
  const cleanQ = cleanRawText(query).toLowerCase();
  const qTokens = cleanQ.split(' ').filter(Boolean);
  const topTokens = cleanRawText(top.contact.name).toLowerCase().split(' ').filter(Boolean);
  const secondTokens = cleanRawText(second.contact.name).toLowerCase().split(' ').filter(Boolean);

  const bothShareMainToken = qTokens.some(qt => 
    topTokens.some(tt => tt === qt || tt.startsWith(qt)) &&
    secondTokens.some(st => st === qt || st.startsWith(qt))
  );

  const isCloseScore = scoreDiff <= 18;

  if (bothShareMainToken || isCloseScore) {
    return {
      bestMatch: null,
      isAmbiguous: true,
      candidates: matches.slice(0, 3)
    };
  }

  return {
    bestMatch: top,
    isAmbiguous: false,
    candidates: matches
  };
}

/**
 * Parses vCard (.vcf) formatted text (supports vCard 2.1, 3.0, 4.0)
 * Allows 1-click bulk import of 1,000+ contacts from phone export
 */
export function parseVCard(vcardText: string): Array<Omit<PhoneContact, 'id'>> {
  if (!vcardText || !vcardText.trim()) return [];

  const contacts: Array<Omit<PhoneContact, 'id'>> = [];
  // Unfold folded lines (RFC 2426: lines starting with space or tab continue previous line)
  const unfolded = vcardText.replace(/\r?\n[ \t]/g, '');
  const cards = unfolded.split(/BEGIN:VCARD/i).filter(c => c.trim().length > 0);

  for (const card of cards) {
    const lines = card.split(/\r?\n/);
    let name = '';
    let phone = '';
    let email = '';
    let relationship = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Full Name (FN)
      if (/^FN[;: ]/i.test(trimmed)) {
        const val = trimmed.replace(/^FN[;: ][^:]*:/i, '').replace(/^FN:/i, '').trim();
        if (val) name = val;
      }
      // Structured Name (N) fallback if FN not yet set
      else if (!name && /^N[;: ]/i.test(trimmed)) {
        const val = trimmed.replace(/^N[;: ][^:]*:/i, '').replace(/^N:/i, '').trim();
        const parts = val.split(';').map(p => p.trim()).filter(Boolean);
        if (parts.length > 0) {
          // Typically: Family;Given;Middle;Prefix;Suffix
          name = parts.reverse().join(' ');
        }
      }
      // Telephone (TEL)
      else if (/^TEL[;: ]/i.test(trimmed)) {
        const rawNum = trimmed.replace(/^TEL[;: ][^:]*:/i, '').replace(/^TEL:/i, '').trim();
        const clean = cleanPhoneNumber(rawNum);
        if (clean && !phone) {
          phone = clean;
        }
      }
      // Email (EMAIL)
      else if (/^EMAIL[;: ]/i.test(trimmed)) {
        const val = trimmed.replace(/^EMAIL[;: ][^:]*:/i, '').replace(/^EMAIL:/i, '').trim();
        if (val && !email) {
          email = val;
        }
      }
      // Organization / Role / Note as relationship hint
      else if (/^(NOTE|X-RELATIONSHIP|ROLE|TITLE)[;: ]/i.test(trimmed)) {
        const val = trimmed.replace(/^[A-Z\-]+[;: ][^:]*:/i, '').trim();
        if (val && !relationship) {
          relationship = val;
        }
      }
    }

    if (name || phone) {
      contacts.push({
        name: name || 'Unnamed Contact',
        phone: phone || '',
        email: email || undefined,
        relationship: relationship || undefined
      });
    }
  }

  return contacts;
}

/**
 * Formats contacts into standard vCard 3.0 (.vcf) format for export
 */
export function formatVCard(contacts: PhoneContact[]): string {
  return contacts.map(c => {
    const lines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${c.name || 'Contact'}`,
      `N:;${c.name || 'Contact'};;;`,
    ];
    if (c.phone) {
      lines.push(`TEL;TYPE=CELL:${c.phone}`);
    }
    if (c.email) {
      lines.push(`EMAIL;TYPE=HOME:${c.email}`);
    }
    if (c.relationship) {
      lines.push(`NOTE:${c.relationship}`);
    }
    lines.push('END:VCARD');
    return lines.join('\r\n');
  }).join('\r\n\r\n');
}

import { useState, useEffect } from 'react';
import { LocationContext, getCachedLocation } from './services/location';
import { idbSet, idbGet, STORES } from './db/indexedDb';

export type TemporalType = 'Upcoming' | 'Past' | 'Recurring' | 'General';

export type PersonaPresetType = 'default' | 'girlfriend' | 'boyfriend' | 'friday' | 'venom';

export interface Fact {
  id: string;
  text: string;
  date: string;
  temporalType?: TemporalType;
  resolvedTime?: string | null;
}

export interface MemoryEntry {
  id: string;
  text: string;
  dateMentioned: string;
  followUpDate: string;
  resolved: boolean;
  type?: string;
}

export interface Reminder {
  id: string;
  text: string;
  time: number;
  done: boolean;
}

export type EventCategory = 'trip' | 'birthday' | 'meeting' | 'reminder' | 'personal' | 'study' | 'health' | 'general';

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // ISO format 'YYYY-MM-DD'
  time?: string; // e.g. '15:00' or '3:00 PM'
  category?: EventCategory | string;
  description?: string;
  reminded?: boolean;
  createdAt: number;
}

export interface PhoneContact {
  id: string;
  name: string;
  phone: string;
  relationship?: string; // e.g. 'Papa', 'Mummy', 'Bhai', 'Boss', 'Friend', 'Work'
  email?: string;
}

export interface UserPersona {
  name: string;
  age: string;
  habits: string;
  userPhotoUrl?: string; // We can leave it in type for backward compatibility
  saraAvatarUrl?: string;
  saraName?: string;
  personaType?: PersonaPresetType;
  personaAvatars?: Partial<Record<PersonaPresetType, string>>;
}

export interface DailyInsight {
  date: string;
  tipOrQuote: string;
  category?: 'productivity' | 'quote' | 'mindset' | string;
}

export const DEFAULT_PERSONA_AVATARS: Record<PersonaPresetType, string> = {
  default: '/default-avatar.svg',
  girlfriend: '/girlfriend-avatar.svg',
  boyfriend: '/boyfriend-avatar.svg',
  friday: '/friday-avatar.svg',
  venom: '/venom-avatar.svg'
};

export function getPersonaAvatar(persona?: UserPersona, typeOverride?: PersonaPresetType): string {
  const type: PersonaPresetType = typeOverride || persona?.personaType || 'default';
  if (persona?.personaAvatars && persona.personaAvatars[type]) {
    return persona.personaAvatars[type]!;
  }
  // Check backward-compatibility: if legacy saraAvatarUrl was set to a custom upload data: url
  if (!typeOverride && persona?.saraAvatarUrl && persona.saraAvatarUrl.startsWith('data:')) {
    return persona.saraAvatarUrl;
  }
  return DEFAULT_PERSONA_AVATARS[type] || '/default-avatar.svg';
}

export interface AppState {
  apiKey: string;
  persona: UserPersona;
  facts: Fact[];
  memories: MemoryEntry[];
  reminders: Reminder[];
  events: CalendarEvent[];
  contacts: PhoneContact[];
  playbackSpeed: number;
  voicePitch: number;
  autoExtractMemory: boolean;
  lastGreetingDate?: string;
  lastGreetingType?: 'full' | 'short';
  lastInteractionTimestamp?: number;
  dailyInsight?: DailyInsight;
  locationContext?: LocationContext;
}

/**
 * Helper to compute companion name.
 * If user provided a name, use it.
 * If no custom name was entered, check personaType:
 * - 'girlfriend' -> "Girlfriend"
 * - 'friday' -> "Friday"
 * - Default -> "Sara"
 */
export function getSaraName(persona?: UserPersona): string {
  if (persona?.saraName && persona.saraName.trim()) {
    if (persona.saraName.trim().toLowerCase() === 'sarah') {
      return 'Sara';
    }
    return persona.saraName.trim();
  }
  if (persona?.personaType === 'girlfriend') {
    return 'Girlfriend';
  }
  if (persona?.personaType === 'boyfriend') {
    return 'Boyfriend';
  }
  if (persona?.personaType === 'friday') {
    return 'Friday';
  }
  if (persona?.personaType === 'venom') {
    return 'Venom';
  }
  return 'Sara';
}

const defaultState: AppState = {
  apiKey: '',
  persona: { name: '', age: '', habits: '', saraAvatarUrl: '/default-avatar.svg', saraName: '', personaType: 'default' },
  facts: [],
  memories: [],
  reminders: [],
  events: [],
  contacts: [],
  playbackSpeed: 1,
  voicePitch: 0,
  autoExtractMemory: true,
  lastGreetingDate: '',
  lastGreetingType: undefined,
  lastInteractionTimestamp: 0,
  dailyInsight: undefined,
  locationContext: getCachedLocation() || undefined,
};

export function useAppState() {
  const [state, setState] = useState<AppState>(() => {
    try {
      const stored = localStorage.getItem('sara_state');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.persona) {
          const activeType = parsed.persona.personaType || 'default';
          if (!parsed.persona.personaAvatars) {
            parsed.persona.personaAvatars = {};
          }
          // Preserve any existing custom avatar uploaded
          if (parsed.persona.saraAvatarUrl && parsed.persona.saraAvatarUrl.startsWith('data:') && !parsed.persona.personaAvatars[activeType]) {
            parsed.persona.personaAvatars[activeType] = parsed.persona.saraAvatarUrl;
          }
          parsed.persona.saraAvatarUrl = getPersonaAvatar(parsed.persona, activeType);
        }
        if (parsed.voicePitch === 120 || parsed.voicePitch === -120) {
          parsed.voicePitch = 0;
        }
        if (!parsed.locationContext) {
          parsed.locationContext = getCachedLocation() || undefined;
        }
        return { ...defaultState, ...parsed };
      }
    } catch(e) {}
    return defaultState;
  });

  useEffect(() => {
    try {
      localStorage.setItem('sara_state', JSON.stringify(state));
      // Mirror safely into IndexedDB for persistent storage and high-durability protection
      idbSet(STORES.APP_STATE, { key: 'sara_state', ...state }).catch(() => {});
    } catch (e) {
      console.warn('Persistence save error:', e);
    }
  }, [state]);

  // Fallback IDB restore on app mount if localStorage was empty or missing contacts
  useEffect(() => {
    idbGet(STORES.APP_STATE, 'sara_state').then((savedState: any) => {
      if (savedState) {
        setState(prev => {
          let updated = false;
          let newContacts = prev.contacts;
          if ((!prev.contacts || prev.contacts.length === 0) && savedState.contacts && savedState.contacts.length > 0) {
            newContacts = savedState.contacts;
            updated = true;
          }
          if (updated) {
            return { ...prev, contacts: newContacts };
          }
          return prev;
        });
      }
    }).catch(() => {});
  }, []);

  const updateState = (updates: Partial<AppState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const updateLocationContext = (location: LocationContext | null | undefined) => {
    setState(prev => {
      const next = { ...prev };
      if (!location) {
        delete next.locationContext;
      } else {
        next.locationContext = location;
      }
      return next;
    });
  };

  const addFact = (text: string, temporalType: TemporalType = 'General', resolvedTime: string | null = null) => {
    const newFact: Fact = { id: Date.now().toString(), text, date: new Date().toLocaleDateString(), temporalType, resolvedTime };
    setState(prev => ({ ...prev, facts: [...prev.facts, newFact] }));
  };

  const removeFact = (id: string) => {
    setState(prev => ({ ...prev, facts: prev.facts.filter(f => f.id !== id) }));
  };
  
  const editFact = (id: string, newText: string, temporalType?: TemporalType, resolvedTime?: string | null) => {
    setState(prev => ({
      ...prev,
      facts: prev.facts.map(f => f.id === id ? { ...f, text: newText, temporalType: temporalType || f.temporalType, resolvedTime: resolvedTime !== undefined ? resolvedTime : f.resolvedTime } : f)
    }));
  };

  const addMemory = (text: string, followUpDate?: string, type: string = 'plan') => {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const newMem: MemoryEntry = {
      id: Date.now().toString(),
      text,
      dateMentioned: today,
      followUpDate: followUpDate || tomorrow,
      resolved: false,
      type
    };
    setState(prev => ({ ...prev, memories: [...(prev.memories || []), newMem] }));
  };

  const resolveMemory = (id: string) => {
    setState(prev => ({
      ...prev,
      memories: (prev.memories || []).map(m => m.id === id ? { ...m, resolved: true } : m)
    }));
  };
  
  const addReminder = (text: string, time: number) => {
    const newRem: Reminder = { id: Date.now().toString(), text, time, done: false };
    setState(prev => ({ ...prev, reminders: [...prev.reminders, newRem] }));
  };
  
  const markReminderDone = (id: string) => {
    setState(prev => ({ ...prev, reminders: prev.reminders.map(r => r.id === id ? { ...r, done: true } : r) }));
  };

  const deleteReminder = (id: string) => {
    setState(prev => ({ ...prev, reminders: prev.reminders.filter(r => r.id !== id) }));
  };

  const addCalendarEvent = (eventData: Omit<CalendarEvent, 'id' | 'createdAt'>): CalendarEvent => {
    const rawCat = (eventData.category || 'general').toLowerCase().trim();
    let sanitizedCategory: EventCategory = 'general';
    if (['trip', 'birthday', 'meeting', 'reminder', 'personal', 'study', 'health', 'general'].includes(rawCat)) {
      sanitizedCategory = rawCat as EventCategory;
    } else if (rawCat.includes('trip') || rawCat.includes('travel') || rawCat.includes('tour') || rawCat.includes('flight')) {
      sanitizedCategory = 'trip';
    } else if (rawCat.includes('birth') || rawCat.includes('party') || rawCat.includes('anniversary')) {
      sanitizedCategory = 'birthday';
    } else if (rawCat.includes('meet') || rawCat.includes('work') || rawCat.includes('office') || rawCat.includes('interview')) {
      sanitizedCategory = 'meeting';
    } else if (rawCat.includes('study') || rawCat.includes('exam') || rawCat.includes('test') || rawCat.includes('neet') || rawCat.includes('class')) {
      sanitizedCategory = 'study';
    } else if (rawCat.includes('health') || rawCat.includes('doc') || rawCat.includes('med') || rawCat.includes('gym')) {
      sanitizedCategory = 'health';
    } else if (rawCat.includes('remind') || rawCat.includes('todo') || rawCat.includes('task')) {
      sanitizedCategory = 'reminder';
    } else if (rawCat.includes('person') || rawCat.includes('family')) {
      sanitizedCategory = 'personal';
    }

    const newEvent: CalendarEvent = {
      ...eventData,
      category: sanitizedCategory,
      id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
      reminded: false,
      createdAt: Date.now()
    };
    setState(prev => ({
      ...prev,
      events: [...(prev.events || []), newEvent]
    }));
    return newEvent;
  };

  const deleteCalendarEvent = (id: string) => {
    setState(prev => ({
      ...prev,
      events: (prev.events || []).filter(e => e.id !== id)
    }));
  };

  const editCalendarEvent = (id: string, updates: Partial<CalendarEvent>) => {
    setState(prev => ({
      ...prev,
      events: (prev.events || []).map(e => e.id === id ? { ...e, ...updates } : e)
    }));
  };

  const markEventReminded = (id: string) => {
    setState(prev => ({
      ...prev,
      events: (prev.events || []).map(e => e.id === id ? { ...e, reminded: true } : e)
    }));
  };

  const updateGreetingState = (date: string, type: 'full' | 'short') => {
    const now = Date.now();
    setState(prev => ({
      ...prev,
      lastGreetingDate: date,
      lastGreetingType: type,
      lastInteractionTimestamp: now
    }));
  };

  const updatePersonaAvatar = (preset: PersonaPresetType, avatarUrl: string) => {
    setState(prev => {
      const currentAvatars = prev.persona.personaAvatars || {};
      const updatedAvatars = {
        ...currentAvatars,
        [preset]: avatarUrl
      };
      const isCurrentPreset = (prev.persona.personaType || 'default') === preset;
      return {
        ...prev,
        persona: {
          ...prev.persona,
          personaAvatars: updatedAvatars,
          saraAvatarUrl: isCurrentPreset ? avatarUrl : (prev.persona.saraAvatarUrl || avatarUrl)
        }
      };
    });
  };

  const resetPersonaAvatar = (preset: PersonaPresetType) => {
    setState(prev => {
      const updatedAvatars = { ...(prev.persona.personaAvatars || {}) };
      delete updatedAvatars[preset];
      const defaultAvatar = DEFAULT_PERSONA_AVATARS[preset] || '/default-avatar.svg';
      const isCurrentPreset = (prev.persona.personaType || 'default') === preset;
      return {
        ...prev,
        persona: {
          ...prev.persona,
          personaAvatars: updatedAvatars,
          saraAvatarUrl: isCurrentPreset ? defaultAvatar : prev.persona.saraAvatarUrl
        }
      };
    });
  };

  const addContact = (contact: Omit<PhoneContact, 'id'>) => {
    const newContact: PhoneContact = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
      name: contact.name.trim(),
      phone: contact.phone.trim(),
      relationship: contact.relationship?.trim(),
      email: contact.email?.trim()
    };
    setState(prev => ({
      ...prev,
      contacts: [...(prev.contacts || []), newContact]
    }));
  };

  const removeContact = (id: string) => {
    setState(prev => ({
      ...prev,
      contacts: (prev.contacts || []).filter(c => c.id !== id)
    }));
  };

  const editContact = (id: string, updates: Partial<PhoneContact>) => {
    setState(prev => ({
      ...prev,
      contacts: (prev.contacts || []).map(c => c.id === id ? { ...c, ...updates } : c)
    }));
  };

  const clearAllContacts = () => {
    setState(prev => ({
      ...prev,
      contacts: []
    }));
  };

  const importContacts = (newContacts: Array<Omit<PhoneContact, 'id'>>, replaceAll = false) => {
    setState(prev => {
      const existing = replaceAll ? [] : (prev.contacts || []);
      const added: PhoneContact[] = [];
      newContacts.forEach(c => {
        const rawPhone = c.phone ? String(c.phone).trim() : '';
        const cleanPhone = rawPhone.replace(/[^\d+]/g, '');
        const cleanName = (c.name || '').trim();
        if (!cleanName && !cleanPhone) return;

        // Check if identical contact already exists
        const exists = existing.some(e => {
          const eCleanPhone = (e.phone || '').replace(/[^\d+]/g, '');
          if (cleanPhone && eCleanPhone && cleanPhone === eCleanPhone) return true;
          if (cleanName && e.name.trim().toLowerCase() === cleanName.toLowerCase()) return true;
          return false;
        });

        if (!exists) {
          added.push({
            id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
            name: cleanName || 'Contact',
            phone: rawPhone,
            relationship: c.relationship ? c.relationship.trim() : undefined,
            email: c.email ? c.email.trim() : undefined
          });
        }
      });
      return {
        ...prev,
        contacts: [...existing, ...added]
      };
    });
  };

  return { 
    state, 
    updateState, 
    updateLocationContext, 
    addFact, 
    removeFact, 
    editFact, 
    addMemory, 
    resolveMemory, 
    addReminder, 
    markReminderDone, 
    deleteReminder, 
    addCalendarEvent,
    deleteCalendarEvent,
    editCalendarEvent,
    markEventReminded,
    updateGreetingState, 
    updatePersonaAvatar, 
    resetPersonaAvatar, 
    addContact, 
    removeContact, 
    editContact, 
    importContacts, 
    clearAllContacts 
  };
}

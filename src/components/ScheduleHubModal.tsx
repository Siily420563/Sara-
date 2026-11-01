import React, { useState, useMemo } from 'react';
import { 
  Bell, 
  Clock, 
  Calendar as CalendarIcon, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Volume2, 
  AlertCircle, 
  X, 
  Sparkles, 
  ChevronLeft, 
  ChevronRight, 
  Quote, 
  RefreshCw, 
  Copy, 
  Check, 
  MapPin, 
  Gift, 
  Briefcase, 
  Tag,
  CalendarDays
} from 'lucide-react';
import { Reminder, CalendarEvent, EventCategory } from '../store';
import { playAlarmChime } from '../audio';
import { CURATED_DAILY_QUOTES, getQuoteForToday, DailyQuoteItem } from '../data/dailyQuotes';

export type HubTab = 'quotes' | 'alarms' | 'calendar';

interface Props {
  initialTab?: HubTab;
  reminders: Reminder[];
  events: CalendarEvent[];
  onClose: () => void;
  // Alarm handlers
  onAddReminder: (text: string, time: number) => void;
  onMarkDone: (id: string) => void;
  onDeleteReminder: (id: string) => void;
  onTestAlarm: () => void;
  notifPermission: NotificationPermission;
  onRequestPermission: () => void;
  // Calendar handlers
  onAddEvent: (event: Omit<CalendarEvent, 'id' | 'createdAt'>) => void;
  onDeleteEvent: (id: string) => void;
  onEditEvent?: (id: string, updates: Partial<CalendarEvent>) => void;
  // Quote handlers
  onSpeakText?: (text: string) => void;
  onSpeakQuote?: (text: string) => void;
  dailyAiInsight?: { tipOrQuote: string; category?: string };
  dailyInsight?: { tipOrQuote: string; category?: string };
  onRefreshAiInsight?: () => void;
  onRefreshInsight?: () => void;
  loadingAiInsight?: boolean;
  loadingInsight?: boolean;
  saraName?: string;
}

export const CATEGORY_META: Record<string, { label: string; icon: string; color: string; border: string; bg: string }> = {
  trip: { label: 'Trip & Travel', icon: '✈️', color: 'text-sky-400', border: 'border-sky-500/30', bg: 'bg-sky-500/10' },
  birthday: { label: 'Birthday', icon: '🎂', color: 'text-pink-400', border: 'border-pink-500/30', bg: 'bg-pink-500/10' },
  meeting: { label: 'Meeting & Work', icon: '💼', color: 'text-purple-400', border: 'border-purple-500/30', bg: 'bg-purple-500/10' },
  reminder: { label: 'Reminder', icon: '⏰', color: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/10' },
  personal: { label: 'Personal Plan', icon: '⭐', color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10' },
  study: { label: 'Study & Exam', icon: '📚', color: 'text-indigo-400', border: 'border-indigo-500/30', bg: 'bg-indigo-500/10' },
  health: { label: 'Health & Care', icon: '🩺', color: 'text-rose-400', border: 'border-rose-500/30', bg: 'bg-rose-500/10' },
  general: { label: 'General Event', icon: '📌', color: 'text-cyan-400', border: 'border-cyan-500/30', bg: 'bg-cyan-500/10' }
};

export function getCategoryMeta(category?: string | null) {
  if (!category) return CATEGORY_META.general;
  const key = String(category).toLowerCase().trim();
  if (CATEGORY_META[key]) return CATEGORY_META[key];
  if (key.includes('trip') || key.includes('travel') || key.includes('tour') || key.includes('flight')) return CATEGORY_META.trip;
  if (key.includes('birth') || key.includes('party') || key.includes('anniversary')) return CATEGORY_META.birthday;
  if (key.includes('meet') || key.includes('work') || key.includes('office') || key.includes('interview')) return CATEGORY_META.meeting;
  if (key.includes('study') || key.includes('exam') || key.includes('test') || key.includes('neet') || key.includes('class')) return CATEGORY_META.study;
  if (key.includes('health') || key.includes('doc') || key.includes('med') || key.includes('gym')) return CATEGORY_META.health;
  if (key.includes('remind') || key.includes('alarm') || key.includes('todo') || key.includes('task')) return CATEGORY_META.reminder;
  if (key.includes('person') || key.includes('family')) return CATEGORY_META.personal;
  return CATEGORY_META.general;
}

export default function ScheduleHubModal({
  initialTab = 'quotes',
  reminders,
  events,
  onClose,
  onAddReminder,
  onMarkDone,
  onDeleteReminder,
  onTestAlarm,
  notifPermission,
  onRequestPermission,
  onAddEvent,
  onDeleteEvent,
  onSpeakText,
  onSpeakQuote,
  dailyAiInsight,
  dailyInsight,
  onRefreshAiInsight,
  onRefreshInsight,
  loadingAiInsight,
  loadingInsight = false,
  saraName = 'SARA'
}: Props) {
  const activeSpeak = onSpeakQuote || onSpeakText;
  const activeAiInsight = dailyInsight || dailyAiInsight;
  const activeRefreshInsight = onRefreshInsight || onRefreshAiInsight;
  const isLoadingInsight = loadingInsight || (loadingAiInsight ?? false);
  const [activeTab, setActiveTab] = useState<HubTab>(initialTab);

  // --- QUOTES STATE ---
  const [quoteIndexOffset, setQuoteIndexOffset] = useState(0);
  const [copiedQuote, setCopiedQuote] = useState(false);

  const todayQuote = useMemo<DailyQuoteItem>(() => {
    const base = getQuoteForToday();
    if (quoteIndexOffset === 0) return base;
    const all = CURATED_DAILY_QUOTES;
    const newIdx = (all.findIndex(q => q.id === base.id) + quoteIndexOffset + all.length * 10) % all.length;
    return all[newIdx];
  }, [quoteIndexOffset]);

  const activeDisplayQuote = activeAiInsight?.tipOrQuote || todayQuote.quote;
  const activeDisplayCategory = activeAiInsight?.category || todayQuote.category;
  const activeDisplayAuthor = activeAiInsight ? `${saraName} Personalized Insight` : todayQuote.author;

  const handleCopyQuote = () => {
    navigator.clipboard?.writeText?.(`"${activeDisplayQuote}" — ${activeDisplayAuthor}`);
    setCopiedQuote(true);
    setTimeout(() => setCopiedQuote(false), 2000);
  };

  // --- ALARMS STATE ---
  const [newReminderText, setNewReminderText] = useState('');
  const [timeOffsetMinutes, setTimeOffsetMinutes] = useState<number | 'custom'>(5);
  const [customDateTime, setCustomDateTime] = useState('');
  const [testActive, setTestActive] = useState(false);

  const handleCreateReminder = (e: React.FormEvent) => {
    e.preventDefault();
    const text = newReminderText.trim() || 'Alarm / Reminder';
    let targetTime = Date.now();

    if (timeOffsetMinutes === 'custom') {
      if (!customDateTime) return;
      targetTime = new Date(customDateTime).getTime();
    } else {
      targetTime = Date.now() + (timeOffsetMinutes * 60 * 1000);
    }

    onAddReminder(text, targetTime);
    setNewReminderText('');
    setTimeOffsetMinutes(5);
  };

  const handleTestChime = () => {
    setTestActive(true);
    playAlarmChime();
    onTestAlarm();
    setTimeout(() => setTestActive(false), 2000);
  };

  const activeReminders = reminders.filter(r => !r.done && r.time > Date.now());
  const dueOrDoneReminders = reminders.filter(r => r.done || r.time <= Date.now());

  const formatRemaining = (targetTime: number) => {
    const diff = targetTime - Date.now();
    if (diff <= 0) return 'Due now';
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    if (mins < 60) return `In ${mins}m ${secs}s`;
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `In ${hours}h ${remMins}m`;
  };

  // --- CALENDAR STATE ---
  const now = new Date();
  const istDateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now).split('-');
  const istYear = parseInt(istDateParts[0], 10);
  const istMonth = parseInt(istDateParts[1], 10) - 1;
  const todayIso = `${istDateParts[0]}-${istDateParts[1]}-${istDateParts[2]}`;

  const [calendarViewYear, setCalendarViewYear] = useState(istYear);
  const [calendarViewMonth, setCalendarViewMonth] = useState(istMonth); // 0-indexed
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);

  // New Event Form State
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState(todayIso);
  const [newEventTime, setNewEventTime] = useState('');
  const [newEventCategory, setNewEventCategory] = useState<EventCategory>('meeting');
  const [newEventDesc, setNewEventDesc] = useState('');
  const [showAddEventForm, setShowAddEventForm] = useState(false);

  // Compute Days for the active month view
  const daysInMonth = new Date(calendarViewYear, calendarViewMonth + 1, 0).getDate();
  const firstDayWeekday = (new Date(calendarViewYear, calendarViewMonth, 1).getDay() + 6) % 7; // Monday = 0
  const monthName = new Date(calendarViewYear, calendarViewMonth, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const handlePrevMonth = () => {
    if (calendarViewMonth === 0) {
      setCalendarViewMonth(11);
      setCalendarViewYear(prev => prev - 1);
    } else {
      setCalendarViewMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarViewMonth === 11) {
      setCalendarViewMonth(0);
      setCalendarViewYear(prev => prev + 1);
    } else {
      setCalendarViewMonth(prev => prev + 1);
    }
  };

  const handleGoToday = () => {
    setCalendarViewYear(istYear);
    setCalendarViewMonth(istMonth);
    setSelectedDate(todayIso);
    setNewEventDate(todayIso);
  };

  // Selected Day Events
  const eventsOnSelectedDate = useMemo(() => {
    return (events || []).filter(e => e.date === selectedDate);
  }, [events, selectedDate]);

  // Map of events count/categories per date
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    (events || []).forEach(e => {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    });
    return map;
  }, [events]);

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim()) return;

    onAddEvent({
      title: newEventTitle.trim(),
      date: newEventDate || selectedDate,
      time: newEventTime.trim() || undefined,
      category: newEventCategory,
      description: newEventDesc.trim() || undefined
    });

    setNewEventTitle('');
    setNewEventTime('');
    setNewEventDesc('');
    setShowAddEventForm(false);
  };

  const activeRemindersCount = activeReminders.length;
  const todayEventsCount = (eventsByDate[todayIso] || []).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 animate-fade-in">
      <div className="bg-[#0B111A] border border-[#1E3A5F] rounded-2xl max-w-2xl w-full shadow-2xl flex flex-col overflow-hidden text-gray-100 max-h-[92vh]">
        
        {/* Header with Title & Close Button */}
        <div className="p-4 sm:p-5 border-b border-[#1E3A5F] bg-[#080D14] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/40 text-cyan-300 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.2)]">
              <CalendarDays size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Schedule Hub
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-semibold font-mono uppercase tracking-wider">
                  SARA Companion
                </span>
              </h2>
              <p className="text-xs text-gray-400">Daily Quotes • Alarms & Timers • In-App Calendar</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-[#162A40] rounded-xl transition-colors"
            title="Close Hub"
          >
            <X size={20} />
          </button>
        </div>

        {/* Unified 3-Section Navigation Bar */}
        <div className="flex border-b border-[#1E3A5F] bg-[#070B12] p-1.5 gap-1.5 overflow-x-auto">
          {/* Tab 1: Daily Quotes */}
          <button
            onClick={() => setActiveTab('quotes')}
            className={`flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'quotes'
                ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/10 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#0E1726] border border-transparent'
            }`}
          >
            <Sparkles size={16} className={activeTab === 'quotes' ? 'text-amber-400' : 'text-gray-500'} />
            <span>Daily Quotes</span>
          </button>

          {/* Tab 2: Alarms & Timers */}
          <button
            onClick={() => setActiveTab('alarms')}
            className={`flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all relative ${
              activeTab === 'alarms'
                ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/10 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#0E1726] border border-transparent'
            }`}
          >
            <Clock size={16} className={activeTab === 'alarms' ? 'text-cyan-400' : 'text-gray-500'} />
            <span>Alarms & Timers</span>
            {activeRemindersCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-cyan-500 text-black text-[10px] font-extrabold flex items-center justify-center shadow">
                {activeRemindersCount}
              </span>
            )}
          </button>

          {/* Tab 3: Calendar */}
          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all relative ${
              activeTab === 'calendar'
                ? 'bg-gradient-to-r from-purple-500/20 to-indigo-500/10 text-purple-300 border border-purple-500/40 shadow-[0_0_12px_rgba(168,85,247,0.2)]'
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#0E1726] border border-transparent'
            }`}
          >
            <CalendarIcon size={16} className={activeTab === 'calendar' ? 'text-purple-400' : 'text-gray-500'} />
            <span>Calendar</span>
            {todayEventsCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-purple-500 text-white text-[10px] font-extrabold flex items-center justify-center shadow">
                {todayEventsCount}
              </span>
            )}
          </button>
        </div>

        {/* Main Tab Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 custom-scrollbar flex-1">

          {/* ========================================================= */}
          {/* TAB 1: DAILY QUOTES & PRODUCTIVITY INSIGHTS                */}
          {/* ========================================================= */}
          {activeTab === 'quotes' && (
            <div className="space-y-4 animate-fade-in">
              {/* Top Banner with Today's Date & Theme */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-[#121E30] via-[#0E1826] to-[#0A111C] border border-[#1E3A5F] shadow-lg relative overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles size={14} className="text-amber-400 animate-pulse" />
                      Daily Thought • {new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 font-semibold">
                    {activeDisplayCategory}
                  </span>
                </div>

                {/* Big Quote Typography */}
                <div className="my-3 flex items-start gap-3">
                  <Quote size={24} className="text-amber-400/70 shrink-0 mt-1" />
                  <p className="text-sm sm:text-base font-medium text-gray-100 leading-relaxed italic">
                    "{activeDisplayQuote}"
                  </p>
                </div>

                {/* Attribution & Controls */}
                <div className="mt-4 pt-3 border-t border-[#1C324E] flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="text-gray-400 font-medium flex items-center gap-2">
                    <span className="text-amber-300 font-semibold">— {activeDisplayAuthor}</span>
                    {todayQuote.theme && (
                      <span className="text-[10px] text-gray-500">• Theme: {todayQuote.theme}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {activeSpeak && (
                      <button
                        onClick={() => activeSpeak(activeDisplayQuote)}
                        className="px-2.5 py-1.5 bg-[#16263A] hover:bg-[#1E3654] text-cyan-300 hover:text-white border border-[#234266] rounded-lg transition-all flex items-center gap-1.5"
                        title="Listen to Quote"
                      >
                        <Volume2 size={14} />
                        <span>Listen</span>
                      </button>
                    )}

                    <button
                      onClick={handleCopyQuote}
                      className="px-2.5 py-1.5 bg-[#16263A] hover:bg-[#1E3654] text-gray-300 hover:text-white border border-[#234266] rounded-lg transition-all flex items-center gap-1.5"
                      title="Copy Quote"
                    >
                      {copiedQuote ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      <span>{copiedQuote ? 'Copied' : 'Copy'}</span>
                    </button>

                    <button
                      onClick={() => {
                        setQuoteIndexOffset(prev => prev + 1);
                        if (activeRefreshInsight) activeRefreshInsight();
                      }}
                      disabled={isLoadingInsight}
                      className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg transition-all flex items-center gap-1.5"
                      title="Next Quote"
                    >
                      <RefreshCw size={14} className={isLoadingInsight ? 'animate-spin' : ''} />
                      <span>{isLoadingInsight ? 'Thinking...' : 'Next Quote'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Curated Daily Rotation Info */}
              <div className="p-3.5 rounded-xl bg-[#090F19] border border-[#172B42] text-xs text-gray-300 flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles size={14} />
                </div>
                <div>
                  <h4 className="font-semibold text-white">Daily Rotation Guarantee</h4>
                  <p className="text-gray-400 text-[11px] mt-0.5 leading-relaxed">
                    Quotes rotate automatically every 24 hours at midnight based on the calendar day. You can also ask {saraName} anytime: <span className="text-amber-300">"Aaj ka daily quote sunao"</span> or <span className="text-amber-300">"Mujhe ek motivational quote do"</span>!
                  </p>
                </div>
              </div>

              {/* Quick Wisdom Snippets Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-xl bg-[#0C1523] border border-[#1A2E47]">
                  <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block mb-1">Focus Principle</span>
                  <p className="text-xs text-gray-300">"Pehle sabse zaroori kaam poora karo, baaki cheezein khud ba khud asaan ho jayengi."</p>
                </div>
                <div className="p-3 rounded-xl bg-[#0C1523] border border-[#1A2E47]">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">Mindset Tip</span>
                  <p className="text-xs text-gray-300">"Kal ki chinta me aaj ka sukoon mat gavao. Focus on what you can control right now."</p>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: ALARMS & TIMERS                                    */}
          {/* ========================================================= */}
          {activeTab === 'alarms' && (
            <div className="space-y-4 animate-fade-in">
              {/* Notification Permission Banner */}
              {notifPermission !== 'granted' && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <AlertCircle size={18} className="text-amber-400 shrink-0" />
                    <span>Enable notifications so alarms ring even when your phone is locked or app is closed.</span>
                  </div>
                  <button
                    type="button"
                    onClick={onRequestPermission}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg text-xs shrink-0 transition-all shadow"
                  >
                    Enable
                  </button>
                </div>
              )}

              {/* Quick Sound & Vibration Test */}
              <div className="bg-[#0e1624] border border-[#1e3a5f]/60 p-3.5 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
                    <Volume2 size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white">Test Alarm Chime & Notification</h4>
                    <p className="text-[11px] text-gray-400">Preview the 3-tone synthesizer alert and push vibration</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleTestChime}
                  disabled={testActive}
                  className="px-3.5 py-1.5 bg-teal-600/30 hover:bg-teal-600/50 border border-teal-500/40 text-teal-200 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 shrink-0"
                >
                  <Sparkles size={13} className={testActive ? 'animate-spin' : ''} />
                  {testActive ? 'Ringing...' : 'Test Alarm'}
                </button>
              </div>

              {/* Quick Set Alarm Form */}
              <form onSubmit={handleCreateReminder} className="bg-[#090F18] border border-[#192E47] p-4 rounded-xl space-y-3">
                <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Plus size={14} /> Quick Set Alarm / Reminder
                </h3>

                <input
                  type="text"
                  value={newReminderText}
                  onChange={(e) => setNewReminderText(e.target.value)}
                  placeholder="e.g. Medicine time, Meeting with client, Water reminder"
                  className="w-full bg-[#0F1A2A] border border-[#1E3A5F] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-cyan-400"
                />

                {/* Quick Timer Buttons */}
                <div className="flex flex-wrap gap-2 text-xs">
                  {[
                    { label: '+1 Min (Test)', val: 1 },
                    { label: '+5 Min', val: 5 },
                    { label: '+15 Min', val: 15 },
                    { label: '+30 Min', val: 30 },
                    { label: '+1 Hour', val: 60 },
                  ].map(btn => (
                    <button
                      key={btn.val}
                      type="button"
                      onClick={() => setTimeOffsetMinutes(btn.val)}
                      className={`px-3 py-1.5 rounded-lg border font-medium transition-all ${
                        timeOffsetMinutes === btn.val
                          ? 'bg-cyan-500 text-black border-cyan-400 font-bold shadow'
                          : 'bg-[#0E1624] text-gray-300 border-[#1C334E] hover:border-cyan-500/50'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => setTimeOffsetMinutes('custom')}
                    className={`px-3 py-1.5 rounded-lg border font-medium transition-all ${
                      timeOffsetMinutes === 'custom'
                        ? 'bg-cyan-500 text-black border-cyan-400 font-bold shadow'
                        : 'bg-[#0E1624] text-gray-300 border-[#1C334E] hover:border-cyan-500/50'
                    }`}
                  >
                    Custom Date/Time
                  </button>
                </div>

                {timeOffsetMinutes === 'custom' && (
                  <div className="pt-2">
                    <input
                      type="datetime-local"
                      value={customDateTime}
                      onChange={(e) => setCustomDateTime(e.target.value)}
                      className="w-full bg-[#0F1A2A] border border-[#1E3A5F] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  <Bell size={15} /> Set Alarm
                </button>
              </form>

              {/* Active Alarms List */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Active Alarms ({activeReminders.length})</span>
                  <span className="text-[10px] text-cyan-400 font-mono">Live Countdowns</span>
                </h3>

                {activeReminders.length === 0 ? (
                  <div className="p-6 text-center rounded-xl bg-[#090E17] border border-[#162538] text-xs text-gray-500">
                    No active alarms. Say <span className="text-cyan-400">"5 minute baad reminder lagao"</span> to {saraName} or set one above!
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activeReminders.map(rem => (
                      <div
                        key={rem.id}
                        className="p-3 rounded-xl bg-[#0E1726] border border-[#1E3756] flex items-center justify-between gap-3 shadow-sm hover:border-cyan-500/40 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                            <Clock size={16} />
                          </div>
                          <div>
                            <div className="text-xs sm:text-sm font-semibold text-white">{rem.text}</div>
                            <div className="text-[11px] text-gray-400 flex items-center gap-2 mt-0.5">
                              <span>{new Date(rem.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              <span className="text-cyan-400 font-mono font-semibold">({formatRemaining(rem.time)})</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => onMarkDone(rem.id)}
                            className="p-1.5 text-gray-400 hover:text-emerald-400 hover:bg-[#152538] rounded-lg transition-colors"
                            title="Mark Done"
                          >
                            <CheckCircle2 size={16} />
                          </button>
                          <button
                            onClick={() => onDeleteReminder(rem.id)}
                            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-[#152538] rounded-lg transition-colors"
                            title="Delete Alarm"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Past / Completed Alarms */}
              {dueOrDoneReminders.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-[#162538]">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Past / Triggered ({dueOrDoneReminders.length})
                  </h4>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                    {dueOrDoneReminders.slice(-10).reverse().map(rem => (
                      <div key={rem.id} className="p-2.5 rounded-lg bg-[#080D15] border border-[#142030] flex items-center justify-between text-xs text-gray-400">
                        <span className="line-through">{rem.text}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-500">
                            {new Date(rem.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <button onClick={() => onDeleteReminder(rem.id)} className="text-gray-500 hover:text-red-400">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: IN-APP CALENDAR & SCHEDULE EVENTS                  */}
          {/* ========================================================= */}
          {activeTab === 'calendar' && (
            <div className="space-y-4 animate-fade-in">

              {/* Calendar Month Header & Controls */}
              <div className="p-3.5 rounded-2xl bg-[#090F18] border border-[#192E47] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-white capitalize">
                    {monthName}
                  </h3>
                  <button
                    onClick={handleGoToday}
                    className="px-2 py-0.5 rounded-md bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 text-[10px] font-semibold"
                  >
                    Today
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={handlePrevMonth}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-[#152538] rounded-lg transition-colors"
                    title="Previous Month"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    onClick={handleNextMonth}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-[#152538] rounded-lg transition-colors"
                    title="Next Month"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>

              {/* Monthly Calendar Grid */}
              <div className="bg-[#090F18] border border-[#192E47] rounded-2xl p-3">
                {/* Weekday headers */}
                <div className="grid grid-cols-7 gap-1 text-center mb-1 text-[11px] font-bold text-gray-400 font-mono">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                    <div key={day} className="py-1">{day}</div>
                  ))}
                </div>

                {/* Day Cells */}
                <div className="grid grid-cols-7 gap-1">
                  {/* Empty cells for weekday offset */}
                  {Array.from({ length: firstDayWeekday }).map((_, i) => (
                    <div key={`empty-${i}`} className="h-10 sm:h-12 rounded-lg bg-transparent" />
                  ))}

                  {/* Days of Month */}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const dayNum = i + 1;
                    const dateStr = `${calendarViewYear}-${String(calendarViewMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                    const isToday = dateStr === todayIso;
                    const isSelected = dateStr === selectedDate;
                    const dayEvents = eventsByDate[dateStr] || [];

                    return (
                      <button
                        key={dateStr}
                        onClick={() => {
                          setSelectedDate(dateStr);
                          setNewEventDate(dateStr);
                        }}
                        className={`h-10 sm:h-12 rounded-xl flex flex-col items-center justify-between p-1 transition-all relative group ${
                          isSelected
                            ? 'bg-purple-600/30 border-2 border-purple-400 text-white font-bold shadow-[0_0_10px_rgba(168,85,247,0.3)]'
                            : isToday
                            ? 'bg-[#15253B] border border-cyan-400/60 text-cyan-300 font-bold'
                            : 'bg-[#0D1624] hover:bg-[#152236] border border-[#182B42] text-gray-200'
                        }`}
                      >
                        <span className={`text-[11px] sm:text-xs leading-none ${isToday ? 'text-cyan-300 font-extrabold' : ''}`}>
                          {dayNum}
                        </span>

                        {/* Event indicator dots */}
                        {dayEvents.length > 0 && (
                          <div className="flex items-center gap-0.5 mt-auto">
                            {dayEvents.slice(0, 3).map((ev, idx) => (
                              <span
                                key={idx}
                                className={`w-1.5 h-1.5 rounded-full ${
                                  ev.category === 'trip' ? 'bg-sky-400' :
                                  ev.category === 'birthday' ? 'bg-pink-400' :
                                  ev.category === 'meeting' ? 'bg-purple-400' :
                                  ev.category === 'reminder' ? 'bg-amber-400' : 'bg-emerald-400'
                                }`}
                              />
                            ))}
                            {dayEvents.length > 3 && (
                              <span className="text-[8px] text-gray-400 font-bold leading-none">+</span>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selected Day View & Event List */}
              <div className="p-4 rounded-2xl bg-[#090F18] border border-[#192E47] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                      <span>Events for {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      {selectedDate === todayIso && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">Today</span>
                      )}
                    </h4>
                    <p className="text-[11px] text-gray-400">
                      {eventsOnSelectedDate.length} {eventsOnSelectedDate.length === 1 ? 'event' : 'events'} scheduled
                    </p>
                  </div>

                  <button
                    onClick={() => setShowAddEventForm(prev => !prev)}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow"
                  >
                    <Plus size={14} />
                    <span>{showAddEventForm ? 'Close Form' : 'Add Event'}</span>
                  </button>
                </div>

                {/* Add Event Form Modal/Expansion */}
                {showAddEventForm && (
                  <form onSubmit={handleCreateEvent} className="p-3.5 rounded-xl bg-[#0F1A2A] border border-[#233F63] space-y-3 animate-fade-in">
                    <h5 className="text-xs font-bold text-purple-300 uppercase tracking-wider">
                      Add New Event to Calendar
                    </h5>

                    <input
                      type="text"
                      value={newEventTitle}
                      onChange={(e) => setNewEventTitle(e.target.value)}
                      placeholder="Event Title (e.g. Trip to Prayagraj, Rahul Birthday, Team Meeting)"
                      required
                      className="w-full bg-[#090E17] border border-[#1E3A5F] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-1">Date</label>
                        <input
                          type="date"
                          value={newEventDate}
                          onChange={(e) => setNewEventDate(e.target.value)}
                          required
                          className="w-full bg-[#090E17] border border-[#1E3A5F] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-gray-400 block mb-1">Time (Optional)</label>
                        <input
                          type="time"
                          value={newEventTime}
                          onChange={(e) => setNewEventTime(e.target.value)}
                          placeholder="HH:MM"
                          className="w-full bg-[#090E17] border border-[#1E3A5F] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400"
                        />
                      </div>
                    </div>

                    {/* Category Selection */}
                    <div>
                      <label className="text-[10px] text-gray-400 block mb-1">Category</label>
                      <div className="flex flex-wrap gap-1.5 text-xs">
                        {(['trip', 'birthday', 'meeting', 'study', 'health', 'reminder', 'personal', 'general'] as EventCategory[]).map(cat => {
                          const meta = getCategoryMeta(cat);
                          const isSel = newEventCategory === cat;
                          return (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setNewEventCategory(cat)}
                              className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all flex items-center gap-1 ${
                                isSel
                                  ? `${meta.bg} ${meta.border} ${meta.color} font-bold shadow`
                                  : 'bg-[#090E17] text-gray-400 border-[#1B2F49] hover:border-gray-500'
                              }`}
                            >
                              <span>{meta.icon}</span>
                              <span>{meta.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Optional Description */}
                    <input
                      type="text"
                      value={newEventDesc}
                      onChange={(e) => setNewEventDesc(e.target.value)}
                      placeholder="Optional notes or details"
                      className="w-full bg-[#090E17] border border-[#1E3A5F] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400"
                    />

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddEventForm(false)}
                        className="px-3 py-1.5 text-xs text-gray-400 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold rounded-xl text-xs transition-all shadow"
                      >
                        Save to Calendar
                      </button>
                    </div>
                  </form>
                )}

                {/* Events list for selected date */}
                {eventsOnSelectedDate.length === 0 ? (
                  <div className="p-5 text-center rounded-xl bg-[#0C1420] border border-[#17283E] text-xs text-gray-400">
                    No events scheduled for this day.
                    <p className="text-[11px] text-gray-500 mt-1">
                      Click <strong className="text-purple-300">Add Event</strong> above, or tell {saraName} in voice: <span className="text-purple-300 font-medium">"Kal trip pe jana hai"</span> or <span className="text-purple-300 font-medium">"13 Sept ko meeting hai"</span>!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {eventsOnSelectedDate.map(ev => {
                      const meta = getCategoryMeta(ev?.category);
                      return (
                        <div
                          key={ev.id}
                          className="p-3 rounded-xl bg-[#0C1523] border border-[#1A2F4B] flex items-center justify-between gap-3 hover:border-purple-500/40 transition-all shadow-sm"
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-xl mt-0.5">{meta?.icon || '📌'}</span>
                            <div>
                              <div className="text-xs sm:text-sm font-semibold text-white flex items-center gap-2">
                                <span>{ev.title}</span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${meta?.bg || 'bg-cyan-500/10'} ${meta?.border || 'border-cyan-500/30'} ${meta?.color || 'text-cyan-400'} font-semibold border`}>
                                  {meta?.label || 'Event'}
                                </span>
                              </div>
                              {ev.time && (
                                <div className="text-[11px] text-cyan-300 font-mono font-medium flex items-center gap-1 mt-0.5">
                                  <Clock size={12} />
                                  <span>{ev.time}</span>
                                </div>
                              )}
                              {ev.description && (
                                <p className="text-[11px] text-gray-400 mt-1">{ev.description}</p>
                              )}
                            </div>
                          </div>

                          <button
                            onClick={() => onDeleteEvent(ev.id)}
                            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-[#152538] rounded-lg transition-colors"
                            title="Delete Event"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Natural Voice Command Tips */}
              <div className="p-3.5 rounded-xl bg-[#090F19] border border-[#172B42] text-xs text-gray-300 flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-300 flex items-center justify-center shrink-0 mt-0.5">
                  <CalendarIcon size={14} />
                </div>
                <div>
                  <h5 className="font-semibold text-white">Voice Calendar Scheduling</h5>
                  <p className="text-gray-400 text-[11px] mt-0.5 leading-relaxed">
                    You can speak naturally with {saraName} to schedule anything:
                    <br />
                    • <span className="text-purple-300">"Kal trip pe jana hai"</span> (automatically marks tomorrow)
                    <br />
                    • <span className="text-purple-300">"Parso 3 baje Prayagraj jaana hai"</span> (marks date + 3:00 PM)
                    <br />
                    • <span className="text-purple-300">"13 tareek ko meeting hai"</span> (resolves to this or next month and confirms warmly)
                  </p>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 border-t border-[#1E3A5F] bg-[#080D14] flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Timezone: India Standard Time (IST - Asia/Kolkata)</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#162A40] hover:bg-[#1E3654] text-white rounded-lg transition-colors font-medium"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}

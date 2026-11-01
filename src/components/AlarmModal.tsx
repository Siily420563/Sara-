import React, { useState } from 'react';
import { Bell, Clock, Plus, Trash2, CheckCircle2, Volume2, AlertCircle, X, Sparkles, Timer, Check } from 'lucide-react';
import { Reminder } from '../store';
import { playAlarmChime } from '../audio';

interface Props {
  reminders: Reminder[];
  onClose: () => void;
  onAddReminder: (text: string, time: number) => void;
  onMarkDone: (id: string) => void;
  onDeleteReminder: (id: string) => void;
  onTestAlarm: () => void;
  notifPermission: NotificationPermission;
  onRequestPermission: () => void;
  saraName?: string;
}

export default function AlarmModal({
  reminders,
  onClose,
  onAddReminder,
  onMarkDone,
  onDeleteReminder,
  onTestAlarm,
  notifPermission,
  onRequestPermission,
  saraName = 'SARA'
}: Props) {
  const [newText, setNewText] = useState('');
  const [timeOffsetMinutes, setTimeOffsetMinutes] = useState<number | 'custom'>(5);
  const [customDateTime, setCustomDateTime] = useState('');
  const [testActive, setTestActive] = useState(false);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const text = newText.trim() || 'Alarm / Reminder';
    let targetTime = Date.now();

    if (timeOffsetMinutes === 'custom') {
      if (!customDateTime) return;
      targetTime = new Date(customDateTime).getTime();
    } else {
      targetTime = Date.now() + (timeOffsetMinutes * 60 * 1000);
    }

    onAddReminder(text, targetTime);
    setNewText('');
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-[#0B111A] border border-[#1E3A5F] rounded-2xl max-w-lg w-full shadow-2xl flex flex-col overflow-hidden text-gray-100 max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#1E3A5F] bg-[#080D14] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
              <Clock size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Alarms & Reminders
              </h2>
              <p className="text-xs text-gray-400">Triggered by {saraName} voice or scheduled timers</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-[#162A40] rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-5 custom-scrollbar flex-1">
          
          {/* Notification Permission Banner */}
          {notifPermission !== 'granted' && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <AlertCircle size={18} className="text-amber-400 shrink-0" />
                <span>Enable notifications so alarms ring even when your phone is locked or app is in background.</span>
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
          <form onSubmit={handleCreate} className="bg-[#090F18] border border-[#192E47] p-4 rounded-xl space-y-3">
            <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
              <Plus size={14} /> Quick Set Alarm / Reminder
            </h3>

            <input
              type="text"
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
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
              ].map(opt => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setTimeOffsetMinutes(opt.val)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                    timeOffsetMinutes === opt.val
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                      : 'bg-[#121E30] border-[#1E3654] text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setTimeOffsetMinutes('custom')}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  timeOffsetMinutes === 'custom'
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                    : 'bg-[#121E30] border-[#1E3654] text-gray-400 hover:text-gray-200'
                }`}
              >
                Custom Time
              </button>
            </div>

            {timeOffsetMinutes === 'custom' && (
              <input
                type="datetime-local"
                value={customDateTime}
                onChange={(e) => setCustomDateTime(e.target.value)}
                className="w-full bg-[#0F1A2A] border border-[#1E3A5F] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
              />
            )}

            <button
              type="submit"
              className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-semibold shadow-md transition-all flex items-center justify-center gap-1.5"
            >
              <Timer size={14} />
              Set Alarm
            </button>
          </form>

          {/* Active Alarms */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
              <span>Scheduled Alarms ({activeReminders.length})</span>
            </h3>

            {activeReminders.length === 0 ? (
              <div className="p-5 rounded-xl border border-dashed border-[#1E3A5F] text-center text-xs text-gray-400">
                No upcoming alarms scheduled. You can set one above or simply tell {saraName} in chat or voice call: "5 minute baad reminder lagao"!
              </div>
            ) : (
              activeReminders.map(r => (
                <div
                  key={r.id}
                  className="bg-[#0e1624] border border-[#1e3a5f] p-3.5 rounded-xl flex items-center justify-between gap-3 group hover:border-cyan-500/40 transition-all"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Bell size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs sm:text-sm font-semibold text-white truncate">{r.text}</h4>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-cyan-300">
                        <span className="font-mono bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
                          {formatRemaining(r.time)}
                        </span>
                        <span className="text-gray-400">
                          {new Date(r.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onMarkDone(r.id)}
                      className="p-1.5 text-gray-400 hover:text-emerald-400 hover:bg-emerald-950/30 rounded-lg transition-colors"
                      title="Mark Done"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteReminder(r.id)}
                      className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Past / Triggered Alarms */}
          {dueOrDoneReminders.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-[#1A2E47]">
              <h3 className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-gray-400" />
                <span>Past Alarms ({dueOrDoneReminders.length})</span>
              </h3>
              <div className="space-y-2 max-h-36 overflow-y-auto custom-scrollbar">
                {dueOrDoneReminders.slice(-5).reverse().map(r => (
                  <div
                    key={r.id}
                    className="bg-[#090F18]/80 border border-[#162A40] p-2.5 rounded-lg flex items-center justify-between text-xs text-gray-400"
                  >
                    <span className="line-through truncate flex-1 mr-2">{r.text}</span>
                    <button
                      type="button"
                      onClick={() => onDeleteReminder(r.id)}
                      className="p-1 hover:text-red-400 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#1E3A5F] bg-[#080D14] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#14263D] hover:bg-[#1C3656] text-gray-200 rounded-xl text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}

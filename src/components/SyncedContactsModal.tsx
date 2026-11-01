import React, { useState, useMemo } from 'react';
import { 
  X, 
  Search, 
  User, 
  Phone, 
  Tag, 
  Edit3, 
  Trash2, 
  Plus, 
  Check, 
  AlertCircle, 
  PhoneCall, 
  MessageSquare, 
  ShieldCheck, 
  Sparkles,
  Users
} from 'lucide-react';
import { PhoneContact } from '../store';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  contacts: PhoneContact[];
  onAddContact: (contact: Omit<PhoneContact, 'id'>) => void;
  onEditContact: (id: string, updates: Partial<PhoneContact>) => void;
  onRemoveContact: (id: string) => void;
  onClearAllContacts?: () => void;
}

const COMMON_RELATIONSHIPS = [
  'Family',
  'Papa / Father',
  'Mummy / Mother',
  'Bhai / Brother',
  'Behen / Sister',
  'Dost / Friend',
  'Work / Office',
  'College / School',
  'Other'
];

export default function SyncedContactsModal({
  isOpen,
  onClose,
  contacts,
  onAddContact,
  onEditContact,
  onRemoveContact,
  onClearAllContacts
}: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; phone: string; relationship: string }>({
    name: '',
    phone: '',
    relationship: ''
  });

  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newForm, setNewForm] = useState<{ name: string; phone: string; relationship: string }>({
    name: '',
    phone: '',
    relationship: ''
  });

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const q = searchQuery.toLowerCase().trim();
    return contacts.filter(c => 
      c.name.toLowerCase().includes(q) ||
      c.phone.replace(/[^\d+]/g, '').includes(q) ||
      (c.relationship && c.relationship.toLowerCase().includes(q))
    );
  }, [contacts, searchQuery]);

  if (!isOpen) return null;

  const handleStartEdit = (contact: PhoneContact) => {
    setEditingContactId(contact.id);
    setEditForm({
      name: contact.name,
      phone: contact.phone,
      relationship: contact.relationship || ''
    });
  };

  const handleSaveEdit = (id: string) => {
    if (!editForm.name.trim() || !editForm.phone.trim()) {
      showToast('Name aur Phone number dono zaroori hain!');
      return;
    }
    onEditContact(id, {
      name: editForm.name.trim(),
      phone: editForm.phone.trim(),
      relationship: editForm.relationship.trim() || undefined
    });
    setEditingContactId(null);
    showToast('Contact update ho gaya! ✅');
  };

  const handleSaveNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newForm.name.trim() || !newForm.phone.trim()) {
      showToast('Name aur Phone number dono fill karein!');
      return;
    }
    onAddContact({
      name: newForm.name.trim(),
      phone: newForm.phone.trim(),
      relationship: newForm.relationship.trim() || undefined
    });
    setNewForm({ name: '', phone: '', relationship: '' });
    setIsAddingNew(false);
    showToast('Naya contact successfully add ho gaya! 👤');
  };

  const handleDelete = (id: string) => {
    onRemoveContact(id);
    setDeleteConfirmId(null);
    showToast('Contact delete kar diya gaya.');
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 animate-fade-in">
      <div 
        id="synced-contacts-modal"
        className="bg-[#0B121E] border border-cyan-500/30 rounded-2xl max-w-xl w-full max-h-[90vh] shadow-2xl flex flex-col overflow-hidden text-gray-200"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-cyan-900/40 flex items-center justify-between bg-[#080E18]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center shrink-0">
              <Users size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                  Synced Contacts
                </h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-teal-500/15 border border-teal-500/40 text-teal-300 font-semibold">
                  {contacts.length} Total
                </span>
              </div>
              <p className="text-xs text-blue-300/70 mt-0.5">
                SARA inhi contacts se calling aur messaging perform karti hai
              </p>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Action & Search Bar */}
        <div className="p-3 sm:p-4 bg-[#0D1626] border-b border-blue-900/30 flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400/60" />
            <input 
              type="text"
              placeholder="Search by name, phone or relation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl bg-[#080E18] border border-blue-900/40 focus:border-teal-500/60 focus:outline-none text-white placeholder-blue-300/40"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-0.5"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAddingNew(!isAddingNew)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shrink-0 ${
                isAddingNew
                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  : 'bg-teal-600 hover:bg-teal-500 text-white shadow-md shadow-teal-700/20'
              }`}
            >
              {isAddingNew ? <X size={14} /> : <Plus size={14} />}
              <span>{isAddingNew ? 'Cancel' : 'Add Contact'}</span>
            </button>

            {contacts.length > 0 && onClearAllContacts && (
              <button
                type="button"
                onClick={() => setShowClearAllConfirm(true)}
                className="px-2.5 py-2 rounded-xl text-xs font-semibold text-rose-400/80 hover:text-rose-300 hover:bg-rose-950/40 border border-rose-900/40 transition-all shrink-0"
                title="Delete all contacts"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Notification Toast */}
        {toastMessage && (
          <div className="bg-teal-950/90 border-b border-teal-500/40 text-teal-200 text-xs py-2 px-4 flex items-center justify-between gap-2 animate-fade-in">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-teal-400" />
              <span>{toastMessage}</span>
            </div>
            <button type="button" onClick={() => setToastMessage(null)} className="text-teal-300 hover:text-white">
              <X size={12} />
            </button>
          </div>
        )}

        {/* Clear All Confirmation Alert */}
        {showClearAllConfirm && (
          <div className="p-3.5 bg-rose-950/40 border-b border-rose-800/40 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-rose-200 font-medium">
              <AlertCircle size={16} className="text-rose-400 shrink-0" />
              <span>Kya aap sach me saare contacts delete karna chahte hain?</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowClearAllConfirm(false)}
                className="px-2.5 py-1 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onClearAllContacts) onClearAllContacts();
                  setShowClearAllConfirm(false);
                  showToast('Saare contacts delete ho gaye.');
                }}
                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
              >
                Delete All
              </button>
            </div>
          </div>
        )}

        {/* Add New Contact Form Panel */}
        {isAddingNew && (
          <form 
            onSubmit={handleSaveNew}
            className="p-4 bg-[#0A1322] border-b border-teal-500/30 space-y-3 animate-fade-in"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-teal-300 uppercase tracking-wider flex items-center gap-1.5">
                <Plus size={14} /> Naya Contact Add Karein
              </span>
              <span className="text-[11px] text-blue-300/60">SARA ke offline brain me save hoga</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-medium text-gray-300 block mb-1">Contact Name *</label>
                <div className="relative">
                  <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400/60" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Abhishek Mirzapur"
                    value={newForm.name}
                    onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-[#060B14] border border-blue-900/50 focus:border-teal-500 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-gray-300 block mb-1">Phone Number *</label>
                <div className="relative">
                  <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400/60" />
                  <input
                    type="tel"
                    required
                    placeholder="e.g. +91 9876543210"
                    value={newForm.phone}
                    onChange={(e) => setNewForm({ ...newForm, phone: e.target.value })}
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-[#060B14] border border-blue-900/50 focus:border-teal-500 text-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 items-start sm:items-center justify-between pt-1">
              <div className="flex-1 w-full sm:w-auto">
                <label className="text-[11px] font-medium text-gray-300 block mb-1">Relationship / Tag (Optional)</label>
                <div className="relative">
                  <Tag size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400/60" />
                  <input
                    type="text"
                    placeholder="e.g. Papa, Mummy, Dost, Colleague"
                    value={newForm.relationship}
                    onChange={(e) => setNewForm({ ...newForm, relationship: e.target.value })}
                    list="relation-suggestions"
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-[#060B14] border border-blue-900/50 focus:border-teal-500 text-white"
                  />
                  <datalist id="relation-suggestions">
                    {COMMON_RELATIONSHIPS.map((rel, idx) => (
                      <option key={idx} value={rel} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center mt-2 sm:mt-4">
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 text-xs font-medium hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md"
                >
                  <Check size={13} /> Save Contact
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Contacts Scrollable List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 divide-y divide-blue-950/50">
          {filteredContacts.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center justify-center text-gray-400">
              <div className="w-14 h-14 rounded-2xl bg-blue-950/40 border border-blue-900/40 flex items-center justify-center text-blue-400 mb-3">
                <Users size={24} />
              </div>
              <p className="text-sm font-semibold text-gray-200">
                {searchQuery ? `"${searchQuery}" ke sath koi contact nahi mila` : 'Abhi koi contact synced nahi hai'}
              </p>
              <p className="text-xs text-blue-300/60 mt-1 max-w-sm">
                Aap upar <strong>"Add Contact"</strong> button se manually contact save kar sakte hain, ya Permissions tab se Sync kar sakte hain.
              </p>
            </div>
          ) : (
            filteredContacts.map(contact => {
              const isEditing = editingContactId === contact.id;
              const isConfirmingDelete = deleteConfirmId === contact.id;

              return (
                <div 
                  key={contact.id}
                  className="pt-2.5 first:pt-0"
                >
                  {isEditing ? (
                    /* Inline Edit Card */
                    <div className="p-3.5 rounded-xl bg-[#09111D] border border-cyan-500/50 space-y-3">
                      <div className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                        <Edit3 size={13} /> Contact Edit Karein
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-semibold text-gray-300 block mb-1">Name</label>
                          <input 
                            type="text"
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-[#060B14] border border-cyan-800/60 focus:border-cyan-400 text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-gray-300 block mb-1">Phone Number</label>
                          <input 
                            type="tel"
                            value={editForm.phone}
                            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                            className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-[#060B14] border border-cyan-800/60 focus:border-cyan-400 text-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-semibold text-gray-300 block mb-1">Relationship / Tag</label>
                        <input 
                          type="text"
                          placeholder="e.g. Papa, Mummy, Dost, College"
                          value={editForm.relationship}
                          onChange={(e) => setEditForm({ ...editForm, relationship: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-[#060B14] border border-cyan-800/60 focus:border-cyan-400 text-white"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingContactId(null)}
                          className="px-3 py-1 rounded-lg bg-gray-800 text-gray-300 text-xs font-medium hover:bg-gray-700"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(contact.id)}
                          className="px-3.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5"
                        >
                          <Check size={13} /> Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Display Contact Card */
                    <div className="p-3 rounded-xl bg-[#09111D] border border-blue-900/30 hover:border-cyan-700/50 transition-all flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Avatar Initial */}
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500/20 to-cyan-500/10 border border-teal-500/30 text-teal-300 font-bold text-sm flex items-center justify-center shrink-0">
                          {contact.name.charAt(0).toUpperCase()}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-white truncate">
                              {contact.name}
                            </span>
                            {contact.relationship && (
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-cyan-950/70 border border-cyan-700/40 text-cyan-300 font-medium shrink-0">
                                {contact.relationship}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-blue-300/80 font-mono mt-0.5">
                            <Phone size={11} className="text-blue-400 shrink-0" />
                            <span>{contact.phone}</span>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isConfirmingDelete ? (
                          <div className="flex items-center gap-1 bg-rose-950/60 p-1 rounded-lg border border-rose-800/50">
                            <span className="text-[10px] text-rose-300 px-1">Delete?</span>
                            <button
                              type="button"
                              onClick={() => handleDelete(contact.id)}
                              className="px-2 py-1 rounded bg-rose-600 text-white text-[10px] font-bold hover:bg-rose-500"
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-2 py-1 rounded bg-gray-800 text-gray-300 text-[10px] hover:bg-gray-700"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleStartEdit(contact)}
                              className="p-1.5 rounded-lg text-blue-300 hover:text-white hover:bg-blue-900/40 border border-transparent hover:border-blue-700/40 transition-colors"
                              title="Edit Contact"
                            >
                              <Edit3 size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(contact.id)}
                              className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-transparent hover:border-rose-800/40 transition-colors"
                              title="Delete Contact"
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Note */}
        <div className="p-3 bg-[#080E18] border-t border-blue-900/30 flex items-center justify-between text-[11px] text-blue-300/60">
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={13} className="text-teal-400" />
            <span>Contacts are secured offline on your device in IndexedDB storage.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-blue-950/60 hover:bg-blue-900/60 border border-blue-800/40 text-blue-200 text-xs font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

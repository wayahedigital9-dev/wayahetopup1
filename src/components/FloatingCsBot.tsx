import React, { useState } from 'react';
import { 
  Bot, 
  MessageCircle, 
  X, 
  Terminal, 
  Send, 
  ExternalLink, 
  Search, 
  Sparkles, 
  ShieldCheck, 
  Clock, 
  Cpu
} from 'lucide-react';
import { AppSettings } from '../types';

interface FloatingCsBotProps {
  settings: AppSettings;
  onNavigate: (tab: string) => void;
  onShowToast: (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  isDark?: boolean;
}

export const FloatingCsBot: React.FC<FloatingCsBotProps> = ({
  settings,
  onNavigate,
  onShowToast,
  isDark = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [userQuery, setUserQuery] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'bot' | 'user'; text: string; time: string }>>([
    {
      sender: 'bot',
      text: 'Halo! Saya Robot CS Programmer WayaheDigital 🤖💻. Ada yang bisa saya bantu terkait transaksi, voucher WiFi, akun premium, atau Token API Key AI?',
      time: 'Baru saja'
    }
  ]);

  const cleanPhone = (settings.supportWhatsApp || '081234567890').replace(/[^0-9]/g, '');
  const waTarget = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;

  const handleSendQuery = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!userQuery.trim()) return;

    const currentText = userQuery.trim();
    const timeNow = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    setChatMessages(prev => [...prev, { sender: 'user', text: currentText, time: timeNow }]);
    setUserQuery('');

    // Bot automated friendly responses
    setTimeout(() => {
      let reply = 'Terima kasih atas pesan Anda! Silakan langsung hubungi Admin CS kami di WhatsApp agar dibantu langsung oleh tim teknis kami dalam hitungan menit.';
      const lower = currentText.toLowerCase();

      if (lower.includes('invoice') || lower.includes('pesanan') || lower.includes('status') || lower.includes('cek')) {
        reply = 'Untuk memeriksa status pembayaran atau invoice pesanan Anda, silakan gunakan fitur Lacak Pesanan dengan memasukkan nomor invoice Anda.';
      } else if (lower.includes('api') || lower.includes('token') || lower.includes('key') || lower.includes('openai') || lower.includes('claude')) {
        reply = 'Token API Key AI (OpenAI GPT-4o, Claude 3.5 Sonnet, DeepSeek R1, Gemini Pro) tersedia dan aktif instan! Token akan langsung terhubung ke akun Anda.';
      } else if (lower.includes('premium') || lower.includes('netflix') || lower.includes('spotify') || lower.includes('garansi')) {
        reply = 'Semua akun premium dijamin 100% legal dan bergaransi penuh anti-screen sharing selama masa aktif!';
      } else if (lower.includes('saldo') || lower.includes('top up') || lower.includes('daftar')) {
        reply = 'Setiap pembeli wajib mendaftar akun member untuk memiliki dashboard pribadi, brankas saldo dompet, dan riwayat pesanan.';
      }

      setChatMessages(prev => [...prev, { sender: 'bot', text: reply, time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }]);
    }, 600);
  };

  const handleOpenWhatsApp = (customMsg?: string) => {
    const text = customMsg || `Halo Admin CS WayaheDigital, saya butuh bantuan seputar layanan di website WayaheDigital.`;
    const url = `https://wa.me/${waTarget}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    onShowToast('Menghubungkan ke Admin CS', 'Membuka WhatsApp Admin WayaheDigital 24 Jam...', 'info');
  };

  return (
    <div className="fixed bottom-20 lg:bottom-6 right-4 sm:right-6 z-40">
      {/* POPUP FLYOUT WINDOW */}
      {isOpen && (
        <div 
          className={`absolute bottom-16 right-0 w-[92vw] sm:w-[380px] rounded-3xl shadow-2xl border transition-all animate-in fade-in slide-in-from-bottom-5 duration-200 overflow-hidden flex flex-col ${
            isDark 
              ? 'bg-[#181D19] border-[#2C382E] text-[#F5F7F2]' 
              : 'bg-white border-slate-200 text-slate-800 shadow-slate-300/50'
          }`}
          style={{ maxHeight: 'calc(100vh - 120px)' }}
        >
          {/* Header CS Programmer */}
          <div className="p-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white flex items-center justify-between relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-15 pointer-events-none">
              <Cpu size={110} />
            </div>

            <div className="flex items-center gap-3 relative z-10">
              {/* Robot Programmer Avatar with Coding Badge */}
              <div className="relative">
                <div className="w-11 h-11 rounded-2xl bg-slate-900 border-2 border-emerald-300 flex items-center justify-center text-emerald-400 shadow-md">
                  <Bot size={24} className="animate-pulse" />
                </div>
                {/* 24H Live beacon badge */}
                <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-slate-900" />
              </div>

              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-space font-black text-sm tracking-tight">CS Programmer 24 Jam</h3>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 bg-emerald-400 text-slate-950 font-bold rounded">
                    ONLINE
                  </span>
                </div>
                <p className="text-[11px] text-emerald-100 flex items-center gap-1">
                  <Clock size={11} />
                  <span>Respon Cepat &amp; Terhubung ke Admin CS</span>
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 text-white flex items-center justify-center transition-all cursor-pointer relative z-10"
              title="Tutup Chat"
            >
              <X size={16} />
            </button>
          </div>

          {/* Quick FAQ / Topics Shortcut Chips */}
          <div className={`px-3 py-2 border-b flex items-center gap-1.5 overflow-x-auto scrollbar-none text-[11px] ${
            isDark ? 'bg-[#131714] border-[#242D26]' : 'bg-slate-50 border-slate-100'
          }`}>
            <button
              onClick={() => handleOpenWhatsApp('Halo Admin, saya butuh bantuan pembelian Token API Key AI.')}
              className={`px-2.5 py-1 rounded-full whitespace-nowrap font-medium transition-all cursor-pointer flex items-center gap-1 ${
                isDark 
                  ? 'bg-[#1E2620] hover:bg-[#28352B] text-[#C7FF4D] border border-[#38483C]' 
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
              }`}
            >
              <Terminal size={11} />
              <span>Token API Key AI</span>
            </button>

            <button
              onClick={() => handleOpenWhatsApp('Halo Admin, saya ingin klaim garansi / bantuan Akun Premium.')}
              className={`px-2.5 py-1 rounded-full whitespace-nowrap font-medium transition-all cursor-pointer flex items-center gap-1 ${
                isDark 
                  ? 'bg-[#1E2620] hover:bg-[#28352B] text-purple-300 border border-[#38483C]' 
                  : 'bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200'
              }`}
            >
              <Sparkles size={11} />
              <span>Akun Premium</span>
            </button>

            <button
              onClick={() => {
                setIsOpen(false);
                onNavigate('home');
                const el = document.getElementById('section-invoice-tracker');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className={`px-2.5 py-1 rounded-full whitespace-nowrap font-medium transition-all cursor-pointer flex items-center gap-1 ${
                isDark 
                  ? 'bg-[#1E2620] hover:bg-[#28352B] text-amber-300 border border-[#38483C]' 
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200'
              }`}
            >
              <Search size={11} />
              <span>Cek Pesanan</span>
            </button>
          </div>

          {/* Message Thread History */}
          <div className={`p-4 space-y-3 overflow-y-auto flex-1 text-xs max-h-[260px] ${
            isDark ? 'bg-[#151916]' : 'bg-slate-50/70'
          }`}>
            {chatMessages.map((msg, idx) => (
              <div 
                key={idx}
                className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'bot' && (
                  <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <Bot size={15} />
                  </div>
                )}
                <div 
                  className={`p-3 rounded-2xl max-w-[82%] leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-emerald-600 text-white rounded-br-xs'
                      : isDark
                        ? 'bg-[#212822] text-[#E3E8DF] border border-[#2F3A30] rounded-bl-xs'
                        : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs shadow-xs'
                  }`}
                >
                  <p>{msg.text}</p>
                  <span className={`text-[9px] mt-1 block opacity-60 text-right`}>
                    {msg.time}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Input text & Send Bot */}
          <form onSubmit={handleSendQuery} className={`p-3 border-t flex items-center gap-2 ${
            isDark ? 'bg-[#181D19] border-[#2C382E]' : 'bg-white border-slate-100'
          }`}>
            <input
              type="text"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              placeholder="Ketik pertanyaan untuk CS Programmer..."
              className={`flex-1 text-xs py-2 px-3 rounded-xl border focus:outline-none transition-all ${
                isDark 
                  ? 'bg-[#111412] border-[#2D3930] text-[#F5F7F2] placeholder-[#6A786E] focus:border-emerald-500' 
                  : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:border-emerald-500'
              }`}
            />
            <button
              type="submit"
              disabled={!userQuery.trim()}
              className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white transition-all cursor-pointer"
            >
              <Send size={15} />
            </button>
          </form>

          {/* Footer Direct WhatsApp Connect Action */}
          <div className={`p-3 border-t space-y-2 ${
            isDark ? 'bg-[#121513] border-[#242D26]' : 'bg-slate-100 border-slate-200'
          }`}>
            <button
              onClick={() => handleOpenWhatsApp()}
              className="w-full py-2.5 px-4 rounded-xl bg-[#25D366] hover:bg-[#20BD5A] text-white font-space font-bold text-xs flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
            >
              <MessageCircle size={16} />
              <span>Hubungi Langsung Admin CS via WhatsApp</span>
              <ExternalLink size={13} />
            </button>
            <div className="flex items-center justify-between text-[10px] opacity-70 px-1">
              <span className="flex items-center gap-1">
                <ShieldCheck size={11} className="text-emerald-500" />
                <span>Layanan Resmi Terpercaya</span>
              </span>
              <span>24/7 Aktif Setiap Hari</span>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING TRIGGER BUTTON (PROGRAMMER ROBOT WITH HEADSET & CODING GLOW) */}
      <div className="relative group">
        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Hubungi CS Programmer 24 Jam"
          className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl sm:rounded-3xl bg-gradient-to-tr from-emerald-700 via-teal-600 to-emerald-500 text-white shadow-xl shadow-emerald-900/40 hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 flex items-center justify-center border-2 border-emerald-300 cursor-pointer overflow-hidden"
        >
          {/* Subtle circuit pattern glow */}
          <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:8px_8px] opacity-15" />

          {/* Robot Programmer Character Design */}
          <div className="relative z-10 flex flex-col items-center justify-center">
            <div className="relative">
              <Bot size={26} className="text-white drop-shadow-md" />
              {/* Terminal Code brackets overlay badge */}
              <span className="absolute -bottom-1 -right-2 text-[8px] font-mono font-black bg-slate-950 text-[#C7FF4D] px-1 py-0.2 rounded border border-emerald-400">
                &lt;/&gt;
              </span>
            </div>
            <span className="text-[8px] font-space font-black uppercase tracking-tighter mt-0.5 text-emerald-100">
              CS 24H
            </span>
          </div>

          {/* Online green indicator pulse */}
          <span className="absolute top-1.5 right-1.5 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400 border border-slate-900" />
          </span>
        </button>

        {/* Teaser Tooltip when closed */}
        {!isOpen && (
          <div className="hidden sm:block absolute bottom-2 right-18 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div className={`px-3 py-1.5 rounded-xl shadow-lg border text-xs font-space font-bold whitespace-nowrap flex items-center gap-1.5 ${
              isDark 
                ? 'bg-[#181D19] border-[#2C382E] text-[#C7FF4D]' 
                : 'bg-white border-slate-200 text-slate-800'
            }`}>
              <Bot size={13} className="text-emerald-500" />
              <span>Butuh Bantuan? Hubungi CS 24 Jam</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

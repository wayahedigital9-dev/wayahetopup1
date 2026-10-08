import React, { useState, useMemo, useEffect } from 'react';
import { 
  Zap, 
  Search, 
  ArrowRight, 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  Flame, 
  Gamepad2, 
  Smartphone, 
  Wifi, 
  Radio, 
  Sparkles, 
  CreditCard, 
  ReceiptText, 
  Star, 
  Check, 
  ChevronRight, 
  ChevronLeft,
  ChevronDown,
  Headphones, 
  Tv, 
  Layers,
  Copy,
  Terminal,
  ExternalLink,
  Crown,
  Share2,
  Boxes,
  HelpCircle,
  LogIn,
  UserPlus,
  Wrench,
  AlertTriangle
} from 'lucide-react';
import { Product, Order, PromoBanner, User, HeroPromoSlide } from '../types';
import { formatRupiah, detectOperator } from '../utils/operator';
import { ProductLogo } from '../components/ProductLogo';
import { storage, INITIAL_BANNERS, INITIAL_PREMIUM_PRODUCTS, INITIAL_AI_TOKEN_PRODUCTS, INITIAL_HERO_SLIDES } from '../services/storage';
import { GameTopUpModal, SelectedGameInfo } from '../components/GameTopUpModal';
import { useTheme } from '../context/ThemeContext';

interface HomePageProps {
  products: Product[];
  banners?: PromoBanner[];
  currentUser?: User | null;
  onNavigate: (tab: string) => void;
  onSelectProductToCheckout: (product: Product, targetNumber?: string) => void;
  onOrderCreated?: (order: Order, snapToken: string) => void;
  onShowToast?: (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  isAdmin?: boolean;
}

const OPERATOR_PREFIXES: Record<string, string> = {
  'Telkomsel': '0812',
  'Indosat': '0857',
  'XL': '0878',
  'Tri': '0896',
  'Smartfren': '0881',
  'Axis': '0838',
};

export const PREMIUM_CATEGORY_PILLS = [
  'Semua',
  'Editing',
  'Aplikasi Premium',
  'Streaming',
  'Musik',
  'Lainnya',
  'editing',
  'VPN',
  'AI & Tools',
  'AI',
  'Akun Premium',
];

export const matchesPremiumCategory = (product: Product, selectedCat: string): boolean => {
  if (!selectedCat || selectedCat === 'Semua') return true;

  const prodCat = (product.digiflazzCategory || (product as any).category || '').toLowerCase();
  const prodName = (product.name || '').toLowerCase();
  const prodDesc = (product.description || '').toLowerCase();
  const prodProvider = (product.provider || '').toLowerCase();
  const fullText = `${prodCat} ${prodName} ${prodDesc} ${prodProvider}`;

  const target = selectedCat.toLowerCase();

  // 1. Direct match with category name
  if (prodCat === target) return true;

  // 2. Editing / editing
  if (target === 'editing') {
    return (
      prodCat.includes('editing') ||
      fullText.includes('canva') ||
      fullText.includes('capcut') ||
      fullText.includes('lightroom') ||
      fullText.includes('photoshop') ||
      fullText.includes('picsart') ||
      fullText.includes('vsco') ||
      fullText.includes('remini') ||
      fullText.includes('filmora') ||
      fullText.includes('corel')
    );
  }

  // 3. Aplikasi Premium / Akun Premium
  if (target === 'aplikasi premium' || target === 'akun premium') {
    return (
      prodCat.includes('aplikasi') ||
      prodCat.includes('akun') ||
      fullText.includes('office') ||
      fullText.includes('365') ||
      fullText.includes('google one') ||
      fullText.includes('zoom') ||
      fullText.includes('drive') ||
      fullText.includes('windows') ||
      fullText.includes('microsoft') ||
      fullText.includes('canva') ||
      fullText.includes('grammarly') ||
      fullText.includes('duolingo')
    );
  }

  // 4. Streaming
  if (target === 'streaming') {
    return (
      prodCat.includes('streaming') ||
      fullText.includes('netflix') ||
      fullText.includes('viu') ||
      fullText.includes('disney') ||
      fullText.includes('vidio') ||
      fullText.includes('wetv') ||
      fullText.includes('prime') ||
      fullText.includes('hbo') ||
      fullText.includes('iqiyi') ||
      fullText.includes('youtube') ||
      fullText.includes('catchplay') ||
      fullText.includes('bstation') ||
      fullText.includes('vision+')
    );
  }

  // 5. Musik
  if (target === 'musik') {
    return (
      prodCat.includes('musik') ||
      prodCat.includes('music') ||
      fullText.includes('spotify') ||
      fullText.includes('apple music') ||
      fullText.includes('youtube music') ||
      fullText.includes('joox') ||
      fullText.includes('deezer') ||
      fullText.includes('tidal') ||
      fullText.includes('resso')
    );
  }

  // 6. VPN
  if (target === 'vpn') {
    return (
      prodCat.includes('vpn') ||
      fullText.includes('vpn') ||
      fullText.includes('nord') ||
      fullText.includes('expressvpn') ||
      fullText.includes('surfshark') ||
      fullText.includes('warp')
    );
  }

  // 7. AI & Tools / AI
  if (target === 'ai & tools' || target === 'ai') {
    return (
      prodCat.includes('ai') ||
      prodCat.includes('tool') ||
      product.id.startsWith('ai-') ||
      fullText.includes('chatgpt') ||
      fullText.includes('gpt') ||
      fullText.includes('claude') ||
      fullText.includes('gemini') ||
      fullText.includes('deepseek') ||
      fullText.includes('midjourney') ||
      fullText.includes('turnitin') ||
      fullText.includes('quillbot') ||
      fullText.includes('openai') ||
      fullText.includes('perplexity')
    );
  }

  // 8. Lainnya
  if (target === 'lainnya') {
    if (prodCat.includes('lain')) return true;
    const isKnownMajor =
      prodCat.includes('streaming') ||
      prodCat.includes('editing') ||
      prodCat.includes('musik') ||
      prodCat.includes('music') ||
      prodCat.includes('vpn') ||
      prodCat.includes('ai') ||
      fullText.includes('netflix') ||
      fullText.includes('spotify') ||
      fullText.includes('canva') ||
      fullText.includes('nord') ||
      fullText.includes('chatgpt');
    return !isKnownMajor;
  }

  return prodCat.includes(target) || fullText.includes(target);
};

const LIVE_TICKERS = [
  '⚡ 12 detik lalu Reza baru saja beli 86 Diamonds MLBB (Instan)',
  '⚡ 27 detik lalu Dimas isi Pulsa Telkomsel Rp 50.000 (Sukses)',
  '⚡ 45 detik lalu Sarah beli Voucher WiFi 7 Hari Warga (Aktif)',
  '⚡ 1 menit lalu Kevin top up Valorant 475 Points kilat (Sukses)',
  '⚡ 1.5 menit lalu Aditya beli Paket Internet OMG 14GB (Otomatis)'
];

export function HomePage({
  products,
  banners = [],
  currentUser = null,
  onNavigate,
  onSelectProductToCheckout,
  onShowToast = () => {},
}: HomePageProps) {
  const { isDark } = useTheme();
  const appSettings = storage.getSettings();
  const categoryStatus = appSettings.categoryStatus || {};

  // Global Filters & Search
  const [activeCategoryTab, setActiveCategoryTab] = useState<string>('all');
  const [catalogSearch, setCatalogSearch] = useState<string>('');
  const [gameSortOption, setGameSortOption] = useState<'populer' | 'termurah' | 'termahal'>('populer');

  // Live Purchase Ticker state
  const [tickerIndex, setTickerIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setTickerIndex(prev => (prev + 1) % LIVE_TICKERS.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  // Interactive Promo Products Carousel Slides (Dikelola dinamis dari Admin & Storage)
  const [heroSlidesList, setHeroSlidesList] = useState<HeroPromoSlide[]>(() => storage.getHeroSlides());

  useEffect(() => {
    const handleSync = () => {
      setHeroSlidesList(storage.getHeroSlides());
    };
    window.addEventListener('storage_synced', handleSync);
    return () => window.removeEventListener('storage_synced', handleSync);
  }, []);

  const promoSlides = useMemo(() => {
    const activeList = heroSlidesList.filter(s => s.isActive !== false);
    const list = activeList.length > 0 ? activeList : INITIAL_HERO_SLIDES;

    const resolveAction = (target?: string) => {
      const t = (target || '').toLowerCase().trim();
      if (t === 'game' || t.includes('game')) {
        return () => {
          const el = document.getElementById('katalog-game-unggulan');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        };
      }
      if (t === 'kuota' || t.includes('kuota')) {
        return () => {
          setPulsaOrKuotaTab('kuota');
          const el = document.getElementById('pulsa-kuota-section');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        };
      }
      if (t === 'pulsa' || t.includes('pulsa')) {
        return () => {
          setPulsaOrKuotaTab('pulsa');
          const el = document.getElementById('pulsa-kuota-section');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        };
      }
      if (t === 'premium' || t.includes('premium') || t.includes('aplikasi') || t.includes('akun')) {
        return () => {
          const el = document.getElementById('katalog-akun-premium');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        };
      }
      if (t === 'ai' || t.includes('ai') || t.includes('token') || t.includes('api')) {
        return () => {
          const el = document.getElementById('api-gateway-ai');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        };
      }
      if (t === 'wifi' || t.includes('wifi') || t.includes('hotspot')) {
        return () => {
          onNavigate('wifi');
        };
      }
      if (t === 'transaksi' || t.includes('transaksi')) {
        return () => onNavigate('transaksi');
      }
      return () => {};
    };

    return list.map(slide => ({
      ...slide,
      ctaAction: resolveAction(slide.ctaCategory),
      secondaryCtaAction: resolveAction(slide.secondaryCtaAction || slide.ctaCategory),
    }));
  }, [heroSlidesList, onNavigate]);

  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const [isBannerHovered, setIsBannerHovered] = useState<boolean>(false);

  // Auto slide banner every 5 seconds (pause on hover)
  useEffect(() => {
    if (isBannerHovered) return;
    const interval = setInterval(() => {
      setCurrentSlideIndex(prev => (prev + 1) % promoSlides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [isBannerHovered, promoSlides.length]);

  const handlePrevSlide = () => {
    setCurrentSlideIndex(prev => (prev - 1 + promoSlides.length) % promoSlides.length);
  };

  const handleNextSlide = () => {
    setCurrentSlideIndex(prev => (prev + 1) % promoSlides.length);
  };

  // Quick Pulsa & Kuota Widget State
  const [pulsaOrKuotaTab, setPulsaOrKuotaTab] = useState<'pulsa' | 'kuota'>('kuota');
  const [pulsaPhone, setPulsaPhone] = useState<string>('081298432210');
  const [selectedPulsaProvider, setSelectedPulsaProvider] = useState<string>('Telkomsel');
  const [selectedPulsaProductId, setSelectedPulsaProductId] = useState<string>('');

  // Selected Game for Top Up Modal
  const [selectedGameModal, setSelectedGameModal] = useState<SelectedGameInfo | null>(null);

  // Invoice Tracking Input State
  const [trackingInvoiceInput, setTrackingInvoiceInput] = useState<string>('');

  // FAQ Accordion State
  const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(0);

  // Code terminal active tab (Default Node.js Clouvia Router)
  const [codeSnippetTab, setCodeSnippetTab] = useState<'curl' | 'node' | 'python'>('node');

  // Phone input handling
  const handlePhoneChange = (val: string) => {
    const digits = val.replace(/[^0-9]/g, '');
    setPulsaPhone(digits);
    const detected = detectOperator(digits);
    if (detected) {
      setSelectedPulsaProvider(detected);
    }
  };

  const handleProviderSelect = (provName: string) => {
    setSelectedPulsaProvider(provName);
    const prefix = OPERATOR_PREFIXES[provName] || '0812';
    setPulsaPhone(prev => {
      const clean = (prev || '').replace(/[^0-9]/g, '');
      if (!clean || clean.length < 4) {
        return prefix + '98432210';
      }
      return prefix + clean.slice(4);
    });
  };

  const detectedOp = detectOperator(pulsaPhone) || selectedPulsaProvider;

  // Active products categorized
  const activeProducts = useMemo(() => products.filter((p) => p.isActive), [products]);
  const gameProducts = useMemo(() => activeProducts.filter((p) => p.categoryId === 'game'), [activeProducts]);
  const pulsaProducts = useMemo(() => activeProducts.filter((p) => p.categoryId === 'pulsa'), [activeProducts]);
  const kuotaProducts = useMemo(() => activeProducts.filter((p) => p.categoryId === 'kuota'), [activeProducts]);
  const wifiProducts = useMemo(() => activeProducts.filter((p) => p.categoryId === 'wifi'), [activeProducts]);

  // Subkategori Akun Premium terpilih (sesuai filter pills di screenshot)
  const [selectedPremiumCategory, setSelectedPremiumCategory] = useState<string>('Semua');

  // Dynamic Premium Products (editable by admin in dashboard and includes synced products)
  const premiumProductsList = useMemo(() => {
    const list = activeProducts.filter(p => p.categoryId === 'premium');
    if (list.length > 0) return list;
    return INITIAL_PREMIUM_PRODUCTS;
  }, [activeProducts]);

  // Compute available categories dynamically (primary pills + dynamic categories from synced products)
  const availablePremiumCategories = useMemo(() => {
    const existingLower = new Set(PREMIUM_CATEGORY_PILLS.map(c => c.toLowerCase()));
    const dynamicCats: string[] = [];

    premiumProductsList.forEach(p => {
      const rawCat = p.digiflazzCategory || (p as any).category;
      if (rawCat && typeof rawCat === 'string' && !existingLower.has(rawCat.toLowerCase())) {
        existingLower.add(rawCat.toLowerCase());
        dynamicCats.push(rawCat);
      }
    });

    return [...PREMIUM_CATEGORY_PILLS, ...dynamicCats];
  }, [premiumProductsList]);

  // Filtered premium products according to selected category pill
  const displayedPremiumProducts = useMemo(() => {
    return premiumProductsList.filter(p => matchesPremiumCategory(p, selectedPremiumCategory));
  }, [premiumProductsList, selectedPremiumCategory]);

  // Dynamic AI Token API Key Products (termasuk Clouvia AI Gateway Tambahan)
  const aiTokenProductsList = useMemo(() => {
    const list = activeProducts.filter(p => p.categoryId === 'ai_gateway' || p.categoryId === 'gateway_tambahan' || p.id.startsWith('ai-') || p.id.startsWith('clv-'));
    if (list.length > 0) return list;
    return INITIAL_AI_TOKEN_PRODUCTS;
  }, [activeProducts]);

  // Dynamic Pulsa/Kuota Grid Items for bottom box
  const pulsaGridProducts = useMemo(() => {
    const op = (selectedPulsaProvider || detectedOp || '').toLowerCase();
    const targetCat = pulsaOrKuotaTab;
    
    // Match provider & category (pulsa or kuota)
    let list = activeProducts.filter(p => 
      p.categoryId === targetCat && 
      p.provider.toLowerCase().includes(op)
    );

    if (list.length === 0) {
      list = activeProducts.filter(p => 
        p.categoryId === targetCat &&
        (p.name.toLowerCase().includes(op) || (p.description || '').toLowerCase().includes(op))
      );
    }

    if (list.length === 0) {
      list = activeProducts.filter(p => p.categoryId === targetCat);
    }

    return list.sort((a, b) => a.sellingPrice - b.sellingPrice);
  }, [activeProducts, selectedPulsaProvider, detectedOp, pulsaOrKuotaTab]);

  // Keep selected product id valid
  useEffect(() => {
    if (pulsaGridProducts.length > 0) {
      const exists = pulsaGridProducts.some(p => p.id === selectedPulsaProductId);
      if (!exists) {
        setSelectedPulsaProductId(pulsaGridProducts[0].id);
      }
    }
  }, [pulsaGridProducts, selectedPulsaProductId]);

  // Filtered products list for main search
  const filteredProducts = useMemo(() => {
    let list = activeProducts;

    if (catalogSearch.trim()) {
      const q = catalogSearch.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.provider.toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q) ||
          (p.quotaDetails || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [activeProducts, catalogSearch]);

  // Quick Recharge Execution
  const handleExecuteQuickPulsa = (productToBuy?: Product) => {
    if (!currentUser) {
      onShowToast(
        'Wajib Daftar Akun Terlebih Dahulu',
        'Semua pembeli wajib mendaftar akun untuk melakukan pembelian dan mengakses brankas saldo Anda.',
        'warning'
      );
      onNavigate('daftar');
      return;
    }

    if (!pulsaPhone || pulsaPhone.length < 9) {
      onShowToast('Nomor Belum Lengkap', 'Masukkan nomor handphone tujuan minimal 9 digit', 'warning');
      return;
    }

    const match = productToBuy || pulsaGridProducts.find(p => p.id === selectedPulsaProductId) || pulsaGridProducts[0];

    if (match) {
      onSelectProductToCheckout(match, pulsaPhone);
    } else {
      onNavigate(pulsaOrKuotaTab);
    }
  };

  // Copy promo code helper
  const handleCopyPromoCode = (code: string) => {
    if (navigator && navigator.clipboard) {
      navigator.clipboard.writeText(code).then(() => {
        onShowToast('Kode Promo Disalin', `Kode "${code}" siap digunakan di halaman checkout!`, 'success');
      }).catch(() => {
        onShowToast('Kode Promo', `Kode: ${code}`, 'info');
      });
    } else {
      onShowToast('Kode Promo', `Kode: ${code}`, 'info');
    }
  };

  // Featured 10 Game List as in reference mockup
  const featuredGamesCatalog = [
    {
      id: 'mlbb',
      title: 'Mobile Legends',
      publisher: 'Moonton',
      rating: '4.9',
      startingPrice: 'Mulai Rp 1.500',
      badge: 'DISKON -35%',
      badgeColor: 'bg-rose-50 text-rose-600 border-rose-200',
      tag: '1 Detik',
      image: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80',
      category: 'mobile',
      provider: 'Mobile Legends'
    },
    {
      id: 'ff',
      title: 'Free Fire (ID)',
      publisher: 'Garena',
      rating: '4.8',
      startingPrice: 'Mulai Rp 1.000',
      badge: 'DISKON -15%',
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
      tag: '1 Detik',
      image: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&w=600&q=80',
      category: 'mobile',
      provider: 'Free Fire'
    },
    {
      id: 'pubgm',
      title: 'PUBG Mobile UC',
      publisher: 'Tencent',
      rating: '4.9',
      startingPrice: 'Mulai Rp 14.500',
      badge: 'RESMI',
      badgeColor: 'bg-sky-50 text-sky-700 border-sky-200',
      tag: 'Instant',
      image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=600&q=80',
      category: 'mobile',
      provider: 'PUBG Mobile'
    },
    {
      id: 'valorant',
      title: 'VALORANT FP',
      publisher: 'Riot Games',
      rating: '4.9',
      startingPrice: 'Mulai Rp 13.000',
      badge: 'KILAT',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      tag: 'Auto',
      image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=600&q=80',
      category: 'pc',
      provider: 'Valorant'
    },
    {
      id: 'genshin',
      title: 'Genshin Impact',
      publisher: 'HoYoverse',
      rating: '4.9',
      startingPrice: 'Mulai Rp 16.500',
      badge: 'POPULER',
      badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
      tag: 'Bonus Coin',
      image: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=600&q=80',
      category: 'pc',
      provider: 'Genshin Impact'
    },
    {
      id: 'hok',
      title: 'Honor of Kings',
      publisher: 'Tencent Games',
      rating: '4.8',
      startingPrice: 'Mulai Rp 1.200',
      badge: 'NEW',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
      tag: '1 Detik',
      image: 'https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=600&q=80',
      category: 'mobile',
      provider: 'Honor of Kings'
    },
    {
      id: 'magicchess',
      title: 'Magic Chess: Go',
      publisher: 'Moonton',
      rating: '4.8',
      startingPrice: 'Mulai Rp 14.700',
      badge: 'PROMO',
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
      tag: 'Auto Send',
      image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
      category: 'mobile',
      provider: 'Mobile Legends'
    },
    {
      id: 'pb',
      title: 'Point Blank PB',
      publisher: 'Zepetto',
      rating: '4.7',
      startingPrice: 'Mulai Rp 11.500',
      badge: 'NOSTALGIA',
      badgeColor: 'bg-slate-100 text-slate-800 border-slate-300',
      tag: 'Voucher',
      image: 'https://images.unsplash.com/photo-1579373903781-fd5c0c30c4cd?auto=format&fit=crop&w=600&q=80',
      category: 'pc',
      provider: 'Point Blank'
    },
    {
      id: 'codm',
      title: 'Call of Duty CP',
      publisher: 'Activision',
      rating: '4.9',
      startingPrice: 'Mulai Rp 15.000',
      badge: 'TOP TIER',
      badgeColor: 'bg-lime-50 text-lime-800 border-lime-300',
      tag: 'CP Kilat',
      image: 'https://images.unsplash.com/photo-1542751110-97427bbecf20?auto=format&fit=crop&w=600&q=80',
      category: 'mobile',
      provider: 'Call of Duty'
    },
    {
      id: 'roblox',
      title: 'Roblox Robux',
      publisher: 'Roblox Corp',
      rating: '4.9',
      startingPrice: 'Mulai Rp 12.200',
      badge: 'TERLARIS',
      badgeColor: 'bg-red-50 text-red-700 border-red-200',
      tag: 'Instant Fast',
      image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80',
      category: 'pc',
      provider: 'Roblox'
    }
  ];

  // Curated Premium Subscription Apps as in reference mockup
  const premiumAppsList = [
    {
      id: 'netflix',
      name: 'Netflix Premium',
      category: 'Streaming Video',
      description: '1 Bulan Ultra HD 4K, 1 Profil Private PIN, Garansi Penuh Anti On-Screen Sharing.',
      price: 24500,
      badge: '4K UHD',
      badgeColor: 'bg-red-50 text-red-600 border-red-200'
    },
    {
      id: 'spotify',
      name: 'Spotify Individual',
      category: 'Audio Streaming',
      description: 'Akun Baru / Perpanjang Resmi, Bebas Iklan, Download Offline Musik & Podcast.',
      price: 10900,
      badge: 'RESMI',
      badgeColor: 'bg-emerald-50 text-emerald-600 border-emerald-200'
    },
    {
      id: 'viu',
      name: 'Viu Total Protection',
      category: 'Video & Drama',
      description: 'Tanpa Iklan, Akses All Drama Asia VIP, Kualitas 1080p FHD, Support TV & Mobile.',
      price: 13000,
      badge: 'FAMILY SAFE',
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200'
    },
    {
      id: 'canva',
      name: 'Canva Pro Tim',
      category: 'Desain Grafis',
      description: 'Akses 100M+ Elemen & Template, Brand Kit, Hapus Background 1 Klik, Cloud 1TB.',
      price: 12000,
      badge: 'PRO DESIGN',
      badgeColor: 'bg-sky-50 text-sky-700 border-sky-200'
    },
    {
      id: 'chatgpt',
      name: 'ChatGPT Plus 1 Bln',
      category: 'Generative AI GPT-4o',
      description: 'Akses GPT-4o Unlimited, DALL-E 3, Canvas, Code Interpreter & Voice Chat.',
      price: 45000,
      badge: 'AI PRO',
      badgeColor: 'bg-purple-50 text-purple-700 border-purple-200'
    }
  ];

  // Default Telco packages for mockup Pulsa & Kuota section
  const telcoOfferPackages = [
    {
      id: 'omg-14gb',
      name: 'Internet OMG! 14 GB',
      quota: '14 GB Kuota Utama 24 Jam (Semua Jaringan) + 2 GB Kuota Nonton',
      price: 44500,
      tag: 'BEST SELLER',
      operator: 'Telkomsel'
    },
    {
      id: 'max-25gb',
      name: 'InternetMax 25 GB',
      quota: '20 GB Kuota Reguler Nasional + 5 GB Kuota Lokal & Chat Apps',
      price: 75000,
      tag: 'TERPOPULER',
      operator: 'Telkomsel'
    },
    {
      id: 'giga-50gb',
      name: 'GigaMAX GO 50 GB',
      quota: '30 GB Kuota Utama Kuota Penuh + 20 GB Kuota Streaming & Games VIP',
      price: 125000,
      tag: 'STREAMING PASS',
      operator: 'Telkomsel'
    },
    {
      id: 'pulsa-70k',
      name: 'Pulsa Kilat 70.000',
      quota: 'Pulsa Reguler Rp 70.000 aktif langsung menambah masa aktif 45 hari',
      price: 72500,
      tag: 'PULSA SIAP PAKAI',
      operator: 'Telkomsel'
    }
  ];

  // Curated compact items: limited to 4 items so it's clean and not overwhelming
  const compactTelcoItems = useMemo(() => {
    const list = pulsaGridProducts.length > 0 ? pulsaGridProducts : telcoOfferPackages;
    if (pulsaOrKuotaTab === 'pulsa') {
      const popular = list.filter((p: any) => (p.sellingPrice || p.price || 0) >= 10000);
      if (popular.length >= 4) return popular.slice(0, 4);
    }
    return list.slice(0, 4);
  }, [pulsaGridProducts, telcoOfferPackages, pulsaOrKuotaTab]);

  // Execute track order navigation
  const handleTrackInvoice = () => {
    if (!trackingInvoiceInput.trim()) {
      onShowToast('Nomor Invoice Kosong', 'Masukkan nomor invoice atau ID pesanan Anda', 'warning');
      return;
    }
    onNavigate('transaksi');
  };

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#101211] text-[#F5F7F2] selection:bg-[#C7FF4D] selection:text-[#101211]' : 'bg-[#F8FAFC] text-[#0F172A] selection:bg-[#FACC15] selection:text-[#0F172A]'} font-jakarta relative overflow-x-hidden pb-16 transition-colors duration-300`}>
      
      {/* Ambient Optical Highlights for Depth */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {isDark ? (
          <>
            <div className="absolute top-[-5%] left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-[radial-gradient(ellipse_at_center,rgba(199,255,77,0.06)_0%,transparent_70%)] blur-3xl"></div>
            <div className="absolute top-[35%] right-[-10%] w-[550px] h-[450px] bg-[radial-gradient(ellipse_at_center,rgba(56,189,248,0.05)_0%,transparent_70%)] blur-3xl"></div>
            <div className="absolute top-[65%] left-[-10%] w-[600px] h-[500px] bg-[radial-gradient(ellipse_at_center,rgba(34,197,94,0.04)_0%,transparent_70%)] blur-3xl"></div>
          </>
        ) : (
          <>
            <div className="absolute top-[-5%] left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-[radial-gradient(ellipse_at_center,rgba(250,204,21,0.06)_0%,transparent_70%)] blur-3xl"></div>
            <div className="absolute top-[35%] right-[-10%] w-[550px] h-[450px] bg-[radial-gradient(ellipse_at_center,rgba(56,189,248,0.06)_0%,transparent_70%)] blur-3xl"></div>
            <div className="absolute top-[65%] left-[-10%] w-[600px] h-[500px] bg-[radial-gradient(ellipse_at_center,rgba(34,197,94,0.05)_0%,transparent_70%)] blur-3xl"></div>
          </>
        )}
      </div>

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 space-y-7 relative z-10">

        {/* 1. HERO SLIDING PROMO PRODUCTS BANNER */}
        {(() => {
          const activeSlide = promoSlides[currentSlideIndex] || promoSlides[0];
          return (
            <section 
              className="relative rounded-2xl sm:rounded-3xl p-6 sm:p-8 lg:p-9 overflow-hidden border border-slate-800 shadow-xl bg-gradient-to-br from-[#0B132B] via-[#1C2541] to-[#0A1128] text-white group transition-all duration-500"
              onMouseEnter={() => setIsBannerHovered(true)}
              onMouseLeave={() => setIsBannerHovered(false)}
            >
              {/* Subtle Ambient Rim Glows */}
              <div className="absolute -top-24 -right-24 w-88 h-88 bg-amber-400/10 blur-3xl pointer-events-none rounded-full" />
              <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-sky-400/10 blur-3xl pointer-events-none rounded-full" />

              {/* Carousel Slide Controls (Top Right) */}
              <div className="absolute top-4 sm:top-6 right-4 sm:right-6 z-20 flex items-center gap-1.5">
                <button
                  onClick={handlePrevSlide}
                  aria-label="Promo Sebelumnya"
                  className="w-8 h-8 rounded-full bg-slate-900/80 hover:bg-[#FACC15] text-white hover:text-slate-900 border border-slate-700 flex items-center justify-center transition-all cursor-pointer shadow-md backdrop-blur-md"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={handleNextSlide}
                  aria-label="Promo Selanjutnya"
                  className="w-8 h-8 rounded-full bg-slate-900/80 hover:bg-[#FACC15] text-white hover:text-slate-900 border border-slate-700 flex items-center justify-center transition-all cursor-pointer shadow-md backdrop-blur-md"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 lg:gap-10 pb-4">
                {/* Left Content */}
                <div className="space-y-4 max-w-2xl">
                  {/* Promo Badge */}
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-bold font-space uppercase tracking-wider">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                      {activeSlide.badge}
                    </span>
                  </div>

                  {/* Headline */}
                  <div>
                    <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-[40px] font-bold font-space text-white tracking-tight leading-tight drop-shadow-sm min-h-[58px] sm:min-h-[72px] flex items-center">
                      {activeSlide.title}
                    </h1>
                    <p className="text-xs sm:text-sm md:text-base text-slate-300 mt-2 font-jakarta leading-relaxed max-w-xl min-h-[44px]">
                      {activeSlide.subtitle}
                    </p>
                  </div>

                  {/* Highlight Feature Tags */}
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    {activeSlide.tags.map((tag, idx) => (
                      <span 
                        key={idx}
                        className="px-2.5 py-1 rounded-lg bg-slate-900/70 border border-slate-700/80 text-slate-200 text-[11px] font-semibold font-jakarta"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      onClick={activeSlide.ctaAction}
                      className="px-6 py-3 rounded-xl bg-[#FACC15] hover:bg-[#EAB308] active:bg-amber-500 text-[#0B132B] font-space font-bold text-xs sm:text-sm tracking-wide shadow-md transition-all transform hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer flex items-center gap-2"
                    >
                      <Zap size={16} className="fill-[#0B132B]" />
                      <span>{activeSlide.ctaText}</span>
                    </button>

                    <button
                      onClick={activeSlide.secondaryCtaAction}
                      className="px-5 py-3 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-white border border-slate-700 font-space font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <span>{activeSlide.secondaryCtaText}</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>

                {/* Right Promo Product Showcase Card (Replaces old static Live Event box) */}
                <div className="w-full lg:w-84 shrink-0 p-4 sm:p-5 rounded-2xl bg-[#0F172A]/90 border border-slate-700/80 backdrop-blur-md shadow-2xl flex flex-col justify-between space-y-3.5">
                  <div className="flex items-center justify-between border-b border-slate-700/80 pb-2.5">
                    <div className="flex items-center gap-1.5">
                      <Sparkles size={14} className="text-[#FACC15]" />
                      <span className="text-[11px] font-space font-bold uppercase text-slate-200 tracking-wider">
                        {activeSlide.cardTitle}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FACC15]/20 text-[#FACC15] border border-[#FACC15]/30">
                      {activeSlide.cardSubtitle}
                    </span>
                  </div>

                  {/* Dynamic Product Items List for Active Slide */}
                  <div className="space-y-2">
                    {activeSlide.cardItems.map((item, idx) => (
                      <div 
                        key={idx}
                        className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/70 flex items-center justify-between transition-colors"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-bold text-white truncate font-jakarta">
                            {item.name}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {item.sub}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-bold text-[#FACC15] font-space block">
                            {item.price}
                          </span>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            {item.discount}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Server & Processing Status */}
                  <div className="pt-1 flex items-center justify-between text-[11px] text-slate-300 border-t border-slate-700/80">
                    <span className="flex items-center gap-1.5 text-slate-400 text-[10px]">
                      {activeSlide.serverStatus}
                    </span>
                    <button
                      onClick={activeSlide.ctaAction}
                      className="text-[11px] font-space font-bold text-[#FACC15] hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <span>Beli Sekarang</span>
                      <ChevronRight size={12} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Bottom Carousel Indicator Dots */}
              <div className="pt-2 flex items-center justify-center gap-2">
                {promoSlides.map((slide, idx) => (
                  <button
                    key={slide.id}
                    onClick={() => setCurrentSlideIndex(idx)}
                    aria-label={`Pilih Slide ${idx + 1}`}
                    className={`transition-all duration-300 cursor-pointer ${
                      currentSlideIndex === idx
                        ? 'w-7 h-2 rounded-full bg-[#FACC15] shadow-xs'
                        : 'w-2 h-2 rounded-full bg-slate-600/70 hover:bg-slate-400'
                    }`}
                  />
                ))}
              </div>
            </section>
          );
        })()}

        {/* 1.1 MEMBER ACCESS & STATUS BAR */}
        <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
          isDark 
            ? 'bg-gradient-to-r from-[#1B1F1C] via-[#1E251F] to-[#141815] border-[#2E3A31]' 
            : 'bg-gradient-to-r from-amber-50/90 via-white to-amber-50/50 border-amber-200/80 shadow-xs'
        } flex flex-col sm:flex-row sm:items-center justify-between gap-3.5`}>
          {currentUser ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-400/20 text-amber-400 border border-amber-400/30 flex items-center justify-center shrink-0">
                <Crown size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs sm:text-sm font-bold font-space ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Halo, {currentUser.name}
                  </span>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-400 border border-amber-400/30 uppercase">
                    {currentUser.memberTier || 'VIP_GOLD'}
                  </span>
                </div>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'} font-jakarta mt-0.5`}>
                  Sisa Saldo: <b className="text-emerald-400 font-space">{formatRupiah(currentUser.balance || 0)}</b> • Poin Hadiah: <b className="text-amber-400">{currentUser.rewardPoints || 0} Pts</b>
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-400/20 text-amber-500 border border-amber-400/30 flex items-center justify-center shrink-0">
                <Crown size={20} />
              </div>
              <div>
                <p className={`text-xs sm:text-sm font-bold font-space ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Masuk Akun Member WayaheDigital
                </p>
                <p className={`text-[11px] sm:text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'} font-jakarta mt-0.5`}>
                  Daftar atau masuk akun sekarang untuk pantau saldo dompet, riwayat pesanan & dapatkan kupon diskon member.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            {currentUser ? (
              <button
                onClick={() => onNavigate('akun')}
                className="px-4 py-2 rounded-xl bg-[#FACC15] hover:bg-[#EAB308] text-slate-900 font-space font-bold text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <span>Buka Dashboard Member</span>
                <ChevronRight size={14} />
              </button>
            ) : (
              <>
                <button
                  onClick={() => onNavigate('akun')}
                  className="px-4 py-2 rounded-xl bg-[#FACC15] hover:bg-[#EAB308] text-slate-900 font-space font-bold text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <LogIn size={13} />
                  <span>Masuk Akun</span>
                </button>
                <button
                  onClick={() => onNavigate('daftar')}
                  className={`px-3.5 py-2 rounded-xl ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700' : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'} border font-space font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer`}
                >
                  <UserPlus size={13} />
                  <span>Daftar Member</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* 2. REALTIME LIVE TRANSACTION TICKER STRIP */}
        <div className={`flex items-center gap-2.5 px-4 py-2 rounded-xl ${isDark ? 'bg-[#1B1F1C] border-[#28302A] text-[#F5F7F2]' : 'bg-white border-slate-200 text-slate-700'} border text-xs shadow-xs overflow-hidden transition-colors`}>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
          <div className="truncate font-jakarta">
            {LIVE_TICKERS[tickerIndex]}
          </div>
        </div>

        {/* 3. KATEGORI LAYANAN DIGITAL (10 SQUIRCLE TILES MATRIX) */}
        <section id="katalog-layanan" className="space-y-3.5 scroll-mt-20">
          <div className={`flex items-center justify-between border-l-2 ${isDark ? 'border-[#C7FF4D]' : 'border-amber-500'} pl-3`}>
            <div>
              <h2 className={`text-base sm:text-lg font-bold font-space ${isDark ? 'text-[#F5F7F2]' : 'text-slate-900'} tracking-tight`}>
                Kategori Layanan Digital
              </h2>
              <p className={`text-[11px] ${isDark ? 'text-[#A4ADA6]' : 'text-slate-500'}`}>Pilihan kategori transaksi favorit 24 jam nonstop</p>
            </div>
            <button
              onClick={() => {
                const el = document.getElementById('katalog-game-unggulan');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className={`text-xs ${isDark ? 'text-[#C7FF4D] hover:underline' : 'text-amber-600 hover:text-amber-700'} font-space font-bold flex items-center gap-1 cursor-pointer`}
            >
              <span>Semua Layanan</span>
              <ChevronRight size={13} />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { id: 'cat-game', catKey: 'game', label: 'Top Up Game', desc: 'MLBB, FF, Valo, Steam', icon: Gamepad2, badge: 'Populer', iconStyle: isDark ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' : 'bg-amber-50 text-amber-600 border-amber-200/60', action: () => {
                if (categoryStatus.game === false) {
                  onShowToast('Top Up Game', 'Maintenance akan segera kembali', 'warning');
                  return;
                }
                const el = document.getElementById('katalog-game-unggulan');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }},
              { id: 'cat-pulsa', catKey: 'pulsa', label: 'Pulsa & Data', desc: 'Semua Operator 24 Jam', icon: Smartphone, badge: 'Auto 5s', iconStyle: isDark ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-emerald-50 text-emerald-600 border-emerald-200/60', action: () => {
                if (categoryStatus.pulsa === false && categoryStatus.kuota === false) {
                  onShowToast('Pulsa & Data', 'Maintenance akan segera kembali', 'warning');
                  return;
                }
                const el = document.getElementById('section-pulsa-kuota');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }},
              { id: 'cat-pln', catKey: 'pln', label: 'PLN & Token', desc: 'Token Listrik Prabayar', icon: Zap, iconStyle: isDark ? 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30' : 'bg-yellow-50 text-yellow-600 border-yellow-200/60', action: () => {
                if (categoryStatus.pln === false) {
                  onShowToast('Token PLN', 'Maintenance akan segera kembali', 'warning');
                  return;
                }
                onShowToast('Token PLN', 'Masukkan nomor meter di menu pulsa/tagihan', 'info');
              }},
              { id: 'cat-voucher', catKey: 'wifi', label: 'Voucher Digital', desc: 'WiFi RT/RW Net & Game', icon: Radio, iconStyle: isDark ? 'bg-blue-500/15 text-blue-300 border-blue-500/30' : 'bg-blue-50 text-blue-600 border-blue-200/60', action: () => {
                if (categoryStatus.wifi === false) {
                  onShowToast('Voucher WiFi', 'Maintenance akan segera kembali', 'warning');
                  return;
                }
                onNavigate('wifi');
              }},
              { id: 'cat-premium', catKey: 'premium', label: 'App Premium', desc: 'Netflix, Spotify, Viu, AI', icon: Crown, badge: 'Garansi', iconStyle: isDark ? 'bg-purple-500/15 text-purple-300 border-purple-500/30' : 'bg-purple-50 text-purple-600 border-purple-200/60', action: () => {
                if (categoryStatus.premium === false) {
                  onShowToast('App Premium', 'Maintenance akan segera kembali', 'warning');
                  return;
                }
                const el = document.getElementById('section-premium-apps');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }},
              { id: 'cat-smm', catKey: 'smm', label: 'Sosmed SMM', desc: 'Follower & Like Cepat', icon: Share2, iconStyle: isDark ? 'bg-rose-500/15 text-rose-300 border-rose-500/30' : 'bg-rose-50 text-rose-600 border-rose-200/60', action: () => {
                if (categoryStatus.smm === false) {
                  onShowToast('Sosmed SMM', 'Maintenance akan segera kembali', 'warning');
                  return;
                }
                onShowToast('Sosmed SMM', 'Layanan SMM diproses server 24 jam otomatis', 'info');
              }},
              { id: 'cat-roblox', label: 'Roblox RFT', desc: 'Robux Kilat & Giftcard', icon: Boxes, iconStyle: isDark ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' : 'bg-indigo-50 text-indigo-600 border-indigo-200/60', action: () => {
                const robloxGame = featuredGamesCatalog.find(g => g.id === 'roblox');
                if (robloxGame) setSelectedGameModal(robloxGame as any);
              }},
              { id: 'cat-steam', label: 'Steam & TF2', desc: 'Wallet IDR & Global Key', icon: Flame, iconStyle: isDark ? 'bg-orange-500/15 text-orange-300 border-orange-500/30' : 'bg-orange-50 text-orange-600 border-orange-200/60', action: () => onShowToast('Steam Wallet', 'Voucher Steam Wallet IDR terkirim otomatis', 'info') },
              { id: 'cat-tax', label: 'Payment TAX', desc: 'Pascabayar & PBB Online', icon: ReceiptText, iconStyle: isDark ? 'bg-teal-500/15 text-teal-300 border-teal-500/30' : 'bg-teal-50 text-teal-600 border-teal-200/60', action: () => onShowToast('Pascabayar', 'Pascabayar siap diproses secara real-time', 'info') },
              { id: 'cat-jasa', label: 'Jasa Sosmed', desc: 'Verified & Optimasi Akun', icon: ShieldCheck, iconStyle: isDark ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' : 'bg-cyan-50 text-cyan-600 border-cyan-200/60', action: () => onShowToast('Jasa Sosmed', 'Hubungi CS WhatsApp kami untuk bantuan optimasi', 'info') },
            ].map((cat) => {
              const IconComp = cat.icon;
              const isMaintenance = cat.catKey ? categoryStatus[cat.catKey] === false : false;

              return (
                <button
                  key={cat.id}
                  onClick={cat.action}
                  className={`p-3.5 rounded-2xl ${
                    isMaintenance
                      ? isDark
                        ? 'bg-amber-950/20 border-amber-600/40 text-amber-200'
                        : 'bg-amber-50/70 border-amber-300 text-amber-900'
                      : isDark
                      ? 'bg-[#1B1F1C] border-[#28302A] hover:border-[#3E4C41] text-[#F5F7F2]'
                      : 'bg-white border-slate-200 hover:border-slate-300 text-slate-900'
                  } border flex items-center gap-3 transition-all duration-200 cursor-pointer group text-left relative overflow-hidden shadow-xs hover:-translate-y-0.5`}
                >
                  <div className={`w-10 h-10 rounded-xl ${cat.iconStyle} border flex items-center justify-center transition-transform group-hover:scale-105 shrink-0`}>
                    <IconComp size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`font-space font-bold text-xs ${isDark ? 'text-[#F5F7F2] group-hover:text-[#C7FF4D]' : 'text-slate-900 group-hover:text-amber-600'} transition-colors truncate`}>
                        {cat.label}
                      </span>
                      {isMaintenance ? (
                        <span className="text-[8px] font-extrabold px-1.5 py-0.2 rounded bg-amber-500 text-slate-950 uppercase tracking-tighter">
                          Maintenance
                        </span>
                      ) : cat.badge ? (
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${isDark ? 'bg-[#C7FF4D]/15 text-[#C7FF4D]' : 'bg-amber-100 text-amber-700'} uppercase`}>
                          {cat.badge}
                        </span>
                      ) : null}
                    </div>
                    <p className={`text-[10px] ${isMaintenance ? 'text-amber-600 dark:text-amber-400 font-bold' : isDark ? 'text-[#A4ADA6]' : 'text-slate-500'} truncate font-jakarta`}>
                      {isMaintenance ? 'Maintenance akan segera kembali' : cat.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Mini Sandbox Promo Strip */}
          <div className={`p-3 rounded-2xl ${isDark ? 'bg-[#1B1F1C] border-[#28302A]' : 'bg-white border-slate-200'} border flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs`}>
            <div className="flex items-center gap-2.5">
              <span className={`px-2 py-0.5 rounded-md ${isDark ? 'bg-sky-500/15 border-sky-500/30 text-sky-300' : 'bg-blue-50 border-blue-200 text-blue-700'} border text-[10px] font-bold font-space uppercase`}>
                API GATEWAY AI
              </span>
              <span className={`text-xs ${isDark ? 'text-[#A4ADA6]' : 'text-slate-600'} font-jakarta`}>
                Integrasi H2H Website &amp; Bot Otomatis: <strong className={isDark ? 'text-[#F5F7F2]' : 'text-slate-900'}>1-3 Detik Live Transaksi</strong>
              </span>
            </div>
            <button
              onClick={() => {
                const el = document.getElementById('section-api-sandbox');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className={`text-xs font-space font-bold ${isDark ? 'text-[#C7FF4D] hover:underline' : 'text-amber-600 hover:text-amber-700 hover:underline'} flex items-center gap-1 cursor-pointer shrink-0`}
            >
              <span>Buka Developer Sandbox</span>
              <ChevronRight size={13} />
            </button>
          </div>
        </section>

        {/* 4. THREE STAT METRICS BAR */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          <div className={`p-4.5 rounded-2xl ${isDark ? 'bg-[#1B1F1C] border-[#28302A]' : 'bg-white border-slate-200'} border flex items-center gap-3.5 shadow-xs`}>
            <div className={`w-11 h-11 rounded-xl ${isDark ? 'bg-amber-500/15 border-amber-500/30 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-600'} border flex items-center justify-center shrink-0`}>
              <Zap size={22} />
            </div>
            <div>
              <div className={`font-space font-bold text-2xl ${isDark ? 'text-[#F5F7F2]' : 'text-slate-900'}`}>
                142.980+
              </div>
              <p className={`text-xs ${isDark ? 'text-[#A4ADA6]' : 'text-slate-600'} font-jakarta`}>
                Transaksi Sukses (24 Jam Terakhir)
              </p>
              <span className="text-[10px] text-emerald-500 font-medium">● 99.98% Pemrosesan Otomatis</span>
            </div>
          </div>

          <div className={`p-4.5 rounded-2xl ${isDark ? 'bg-[#1B1F1C] border-[#28302A]' : 'bg-white border-slate-200'} border flex items-center gap-3.5 shadow-xs`}>
            <div className={`w-11 h-11 rounded-xl ${isDark ? 'bg-blue-500/15 border-blue-500/30 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-600'} border flex items-center justify-center shrink-0`}>
              <ShieldCheck size={22} />
            </div>
            <div>
              <div className={`font-space font-bold text-2xl ${isDark ? 'text-[#F5F7F2]' : 'text-slate-900'}`}>
                8.420+
              </div>
              <p className={`text-xs ${isDark ? 'text-[#A4ADA6]' : 'text-slate-600'} font-jakarta`}>
                Mitra Reseller Aktif
              </p>
              <span className={`text-[10px] ${isDark ? 'text-[#68736B]' : 'text-slate-500'}`}>Tersebar di 128 Kota Indonesia</span>
            </div>
          </div>

          <div className={`p-4.5 rounded-2xl ${isDark ? 'bg-[#1B1F1C] border-[#28302A]' : 'bg-white border-slate-200'} border flex items-center gap-3.5 shadow-xs`}>
            <div className={`w-11 h-11 rounded-xl ${isDark ? 'bg-amber-500/15 border-amber-500/30 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-500'} border flex items-center justify-center shrink-0`}>
              <Star size={22} className="fill-amber-400 text-amber-500" />
            </div>
            <div>
              <div className={`font-space font-bold text-2xl ${isDark ? 'text-[#F5F7F2]' : 'text-slate-900'} flex items-center gap-1.5`}>
                <span>4.96</span>
                <span className="text-xs text-amber-500 font-normal">★★★★★</span>
              </div>
              <p className={`text-xs ${isDark ? 'text-[#A4ADA6]' : 'text-slate-600'} font-jakarta`}>
                Rating Kepuasan Pelanggan
              </p>
              <span className={`text-[10px] ${isDark ? 'text-[#68736B]' : 'text-slate-500'}`}>Berdasarkan 58.700+ Ulasan Pelanggan</span>
            </div>
          </div>
        </section>


        {/* 6. KATALOG PRODUK GAME UNGGULAN (10 GAME CARDS MATRIX) */}
        <section id="katalog-game-unggulan" className="space-y-4 scroll-mt-20">
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-l-2 ${isDark ? 'border-[#C7FF4D]' : 'border-amber-500'} pl-3`}>
            <div>
              <span className={`text-[10px] font-space font-bold ${isDark ? 'text-[#C7FF4D]' : 'text-amber-600'} uppercase tracking-wider block`}>
                PILIHAN GAME TERLARIS
              </span>
              <h2 className={`text-base sm:text-xl font-bold font-space ${isDark ? 'text-[#F5F7F2]' : 'text-slate-900'} tracking-tight`}>
                Katalog Produk Game Unggulan
              </h2>
              <p className={`text-xs ${isDark ? 'text-[#A4ADA6]' : 'text-slate-500'}`}>Daftar game terfavorit dengan nominal terlengkap se-Indonesia</p>
            </div>

            {/* Sort Filter Selector */}
            <div className="flex items-center gap-2">
              <span className={`text-xs ${isDark ? 'text-[#A4ADA6]' : 'text-slate-500'} hidden md:inline`}>Urutkan:</span>
              <div className="relative">
                <select
                  value={gameSortOption}
                  onChange={(e) => setGameSortOption(e.target.value as any)}
                  className={`px-3 py-1.5 rounded-xl ${isDark ? 'bg-[#1B1F1C] border-[#28302A] text-[#F5F7F2] focus:border-[#C7FF4D]' : 'bg-white border-slate-200 text-slate-900 focus:border-amber-400'} border text-xs font-space font-semibold cursor-pointer shadow-xs`}
                >
                  <option value="populer">Paling Populer</option>
                  <option value="termurah">Harga Termurah</option>
                  <option value="termahal">Rating Tertinggi</option>
                </select>
              </div>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: 'all', label: 'Semua Produk' },
              { id: 'mobile', label: 'Game Populer' },
              { id: 'pc', label: 'Game PC & Console' },
              { id: 'pulsa', label: 'Pulsa & Token', action: () => {
                const el = document.getElementById('section-pulsa-kuota');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }},
              { id: 'premium', label: 'Aplikasi Premium & AI', action: () => {
                const el = document.getElementById('section-premium-apps');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }},
              { id: 'wifi', label: 'Voucher WiFi', action: () => onNavigate('wifi') },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.action) tab.action();
                  else setActiveCategoryTab(tab.id);
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-space font-semibold transition-all cursor-pointer shrink-0 ${
                  activeCategoryTab === tab.id
                    ? isDark
                      ? 'bg-[#1E251F] text-[#C7FF4D] border border-[#3E4C41] font-bold shadow-xs'
                      : 'bg-slate-900 text-white font-bold shadow-xs'
                    : isDark
                      ? 'bg-[#1B1F1C] hover:bg-[#28322A] text-[#A4ADA6] hover:text-[#F5F7F2] border border-[#28302A]'
                      : 'bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 10 Games Grid (5 Columns on Desktop, 2 on Mobile) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {featuredGamesCatalog
              .filter(game => {
                if (activeCategoryTab === 'all') return true;
                if (activeCategoryTab === 'mobile') return game.category === 'mobile';
                if (activeCategoryTab === 'pc') return game.category === 'pc';
                return true;
              })
              .map((game) => (
                <div
                  key={game.id}
                  onClick={() => setSelectedGameModal(game as any)}
                  className={`group relative rounded-2xl ${isDark ? 'bg-[#1B1F1C] border-[#28302A] hover:border-[#C7FF4D]' : 'bg-white border-slate-200 hover:border-amber-400'} border p-3 flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer`}
                >
                  {/* Poster Image */}
                  <div className="relative w-full h-32 sm:h-36 rounded-xl overflow-hidden mb-2.5 bg-slate-900">
                    <img
                      src={game.image}
                      alt={game.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                    {/* Badge Overlays */}
                    <div className="absolute top-2 left-2">
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-space font-bold border ${game.badgeColor}`}>
                        {game.badge}
                      </span>
                    </div>

                    <div className="absolute bottom-2 right-2">
                      <span className={`px-1.5 py-0.5 rounded bg-black/75 backdrop-blur-md text-[9px] font-mono ${isDark ? 'text-[#C7FF4D]' : 'text-amber-300'}`}>
                        {game.tag}
                      </span>
                    </div>
                  </div>

                  {/* Title & Publisher */}
                  <div className="space-y-1 flex-1">
                    <div className={`flex items-center justify-between text-[11px] ${isDark ? 'text-[#A4ADA6]' : 'text-slate-500'}`}>
                      <span className="truncate">{game.publisher}</span>
                      <span className={`${isDark ? 'text-amber-400' : 'text-amber-500'} flex items-center gap-0.5 font-bold font-mono text-[10px]`}>
                        ★ {game.rating}
                      </span>
                    </div>

                    <h3 className={`font-space font-bold text-xs sm:text-sm ${isDark ? 'text-[#F5F7F2] group-hover:text-[#C7FF4D]' : 'text-slate-900 group-hover:text-amber-600'} transition-colors truncate`}>
                      {game.title}
                    </h3>

                    <p className={`text-xs font-space font-bold ${isDark ? 'text-[#C7FF4D]' : 'text-slate-900'}`}>
                      {game.startingPrice}
                    </p>
                  </div>

                  {/* Quick Select Button */}
                  <div className={`mt-2.5 pt-2 border-t ${isDark ? 'border-[#28302A]' : 'border-slate-100'}`}>
                    <button
                      type="button"
                      className={`w-full py-1.5 rounded-xl ${isDark ? 'bg-[#28322A] group-hover:bg-[#C7FF4D] text-[#F5F7F2] group-hover:text-[#101211]' : 'bg-slate-100 group-hover:bg-[#FACC15] text-slate-800 group-hover:text-slate-900'} text-[11px] font-space font-bold transition-all text-center cursor-pointer`}
                    >
                      Pilih Nominal
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </section>

        {/* 7. AKUN & LANGGANAN PREMIUM (ICON GAMBAR DAPAT DIEDIT DI DASHBOARD ADMIN) */}
        <section id="section-premium-apps" className="space-y-3.5 scroll-mt-20">
          <div id="katalog-akun-premium" className="scroll-mt-24" />
          <div className={`flex items-center justify-between border-l-2 ${isDark ? 'border-[#C7FF4D]' : 'border-amber-500'} pl-3`}>
            <div>
              <span className={`text-[10px] font-space font-bold ${isDark ? 'text-[#C7FF4D]' : 'text-amber-600'} uppercase tracking-wider block`}>
                LAYANAN STREAMING &amp; PRODUCTIVITY
              </span>
              <h2 className={`text-base sm:text-lg font-bold font-space ${isDark ? 'text-[#F5F7F2]' : 'text-slate-900'} tracking-tight`}>
                Katalog Akun &amp; Langganan Premium
              </h2>
              <p className={`text-xs ${isDark ? 'text-[#A4ADA6]' : 'text-slate-500'}`}>Private Akun &amp; Garansi Anti On-Screen Sharing (Tersinkronisasi Otomatis dari Dashboard Admin)</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${isDark ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200'} border hidden sm:inline-block`}>
                100% Legal Garansi Akun
              </span>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${isDark ? 'bg-blue-500/15 text-blue-300 border-blue-500/30' : 'bg-blue-50 text-blue-700 border-blue-200'} border`}>
                {displayedPremiumProducts.length} Produk
              </span>
            </div>
          </div>

          {/* HORIZONTAL PILL SUB-CATEGORY FILTER BAR (SESUAI GAMBAR DILAMPIRKAN PENGGUNA) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none py-1">
            {availablePremiumCategories.map((subCat) => {
              const isSelected = selectedPremiumCategory === subCat;
              return (
                <button
                  key={subCat}
                  type="button"
                  onClick={() => setSelectedPremiumCategory(subCat)}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer shrink-0 border ${
                    isSelected
                      ? 'border-blue-600 text-blue-600 bg-blue-50/70 font-bold shadow-xs dark:bg-blue-600/15 dark:border-blue-500 dark:text-blue-400'
                      : isDark
                      ? 'border-[#28302A] text-[#A4ADA6] bg-[#1B1F1C] hover:bg-[#252B26] hover:text-[#F5F7F2]'
                      : 'border-slate-200 text-slate-700 bg-white hover:bg-slate-50 hover:text-slate-900 shadow-xs'
                  }`}
                >
                  {subCat}
                </button>
              );
            })}
          </div>

          {categoryStatus.premium === false ? (
            <div className={`py-12 px-6 text-center rounded-3xl border ${isDark ? 'border-amber-500/30 bg-amber-500/10' : 'border-amber-300 bg-amber-50/70'} shadow-sm`}>
              <div className="w-16 h-16 mx-auto rounded-3xl bg-amber-500/20 text-amber-500 flex items-center justify-center mb-3">
                <Wrench size={30} />
              </div>
              <h3 className="font-black text-lg sm:text-xl text-amber-500 mb-1">
                Maintenance akan segera kembali
              </h3>
              <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'} max-w-md mx-auto`}>
                Layanan Akun Aplikasi Premium sedang dalam pemeliharaan sistem atau sinkronisasi lisensi baru. Silakan kembali beberapa saat lagi.
              </p>
            </div>
          ) : displayedPremiumProducts.length === 0 ? (
            <div className={`py-12 px-4 text-center rounded-2xl border border-dashed ${isDark ? 'border-[#28302A] bg-[#1B1F1C]/40' : 'border-slate-200 bg-slate-50/60'}`}>
              <Sparkles className="mx-auto w-8 h-8 text-blue-500 mb-2 opacity-60" />
              <h3 className={`font-bold text-sm ${isDark ? 'text-[#F5F7F2]' : 'text-slate-800'}`}>
                Belum ada produk untuk kategori "{selectedPremiumCategory}"
              </h3>
              <p className={`text-xs ${isDark ? 'text-[#A4ADA6]' : 'text-slate-500'} mt-1 max-w-sm mx-auto`}>
                Produk akun premium baru dapat disinkronkan langsung oleh admin melalui menu Dashboard Admin &gt; Produk Premium.
              </p>
              <button
                type="button"
                onClick={() => setSelectedPremiumCategory('Semua')}
                className="mt-3 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer shadow-xs"
              >
                Tampilkan Semua Kategori
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
              {displayedPremiumProducts.map((app) => {
                const hasVars = Boolean(app.hasVariants && app.variants && app.variants.length > 0);
                const minVarPrice = hasVars ? Math.min(...app.variants!.map(v => v.sellingPrice)) : app.sellingPrice;

                return (
                  <div
                    key={app.id}
                    className={`p-3.5 rounded-2xl ${isDark ? 'bg-[#1B1F1C] border-[#28302A] hover:border-[#3E4C41]' : 'bg-white border-slate-200 hover:border-slate-300'} border hover:shadow-md flex flex-col justify-between space-y-3 transition-all hover:-translate-y-0.5 group`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2.5">
                        {/* Icon Gambar Akun Premium */}
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden shadow-sm shrink-0 flex items-center justify-center bg-slate-900 border border-slate-700/60">
                          <ProductLogo
                            provider={app.provider || app.name}
                            name={app.name}
                            iconUrl={app.iconUrl}
                            category="premium"
                            size="xl"
                            className="w-full h-full"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          {hasVars && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-blue-500/15 text-blue-400 border-blue-500/30">
                              {app.variants!.length} Varian
                            </span>
                          )}
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-purple-500/15 text-purple-400 border-purple-500/30">
                            {app.badge || 'VIP'}
                          </span>
                        </div>
                      </div>

                      <span className={`text-[10px] ${isDark ? 'text-[#A4ADA6]' : 'text-slate-500'} font-space block`}>
                        {app.provider || 'Premium'}
                      </span>

                      <h3 className={`font-space font-bold text-sm ${isDark ? 'text-[#F5F7F2]' : 'text-slate-900'} mt-0.5 line-clamp-1`}>
                        {app.name}
                      </h3>

                      <p className={`text-[11px] ${isDark ? 'text-[#A4ADA6]' : 'text-slate-500'} mt-1 font-jakarta leading-relaxed line-clamp-2`}>
                        {app.description}
                      </p>
                    </div>

                    <div className={`pt-2 border-t ${isDark ? 'border-[#28302A]' : 'border-slate-100'} flex items-center justify-between mt-auto`}>
                      <div>
                        <span className={`text-[9px] ${isDark ? 'text-[#68736B]' : 'text-slate-400'} block`}>
                          {hasVars ? 'Mulai dari' : 'Harga'}
                        </span>
                        <span className={`font-space font-bold text-xs sm:text-sm ${isDark ? 'text-[#C7FF4D]' : 'text-slate-900'}`}>
                          {formatRupiah(minVarPrice)}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          if (!currentUser) {
                            onShowToast(
                              'Wajib Daftar Akun Terlebih Dahulu',
                              'Semua pembeli wajib mendaftar akun untuk melakukan pembelian dan mengakses brankas saldo Anda.',
                              'warning'
                            );
                            onNavigate('daftar');
                            return;
                          }
                          onSelectProductToCheckout(app);
                        }}
                        className={`px-3.5 py-1.5 rounded-lg ${isDark ? 'bg-[#C7FF4D] hover:bg-[#D7FF75] text-[#101211] font-bold shadow-lime-glow' : 'bg-[#FACC15] hover:bg-[#EAB308] text-slate-900'} font-space font-bold text-xs transition-all cursor-pointer shadow-xs`}
                      >
                        Beli
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 8. PULSA & KUOTA DATA INTERNET (COMMAND DECK) */}
        <section id="section-pulsa-kuota" className={`rounded-2xl sm:rounded-3xl p-5 sm:p-7 ${isDark ? 'bg-[#1B1F1C] border-[#28302A]' : 'bg-white border-slate-200'} border shadow-sm space-y-5 scroll-mt-20`}>
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-l-2 ${isDark ? 'border-[#C7FF4D]' : 'border-amber-500'} pl-3`}>
            <div>
              <span className={`text-[10px] font-space font-bold ${isDark ? 'text-[#C7FF4D]' : 'text-amber-600'} uppercase tracking-wider block`}>
                ISI ULANG REGULER &amp; PAKET DATA
              </span>
              <h2 className={`text-base sm:text-xl font-bold font-space ${isDark ? 'text-[#F5F7F2]' : 'text-slate-900'} tracking-tight`}>
                Pulsa &amp; Kuota Data Internet
              </h2>
              <p className={`text-xs ${isDark ? 'text-[#A4ADA6]' : 'text-slate-500'}`}>Pilih isi pulsa reguler atau paket kuota internet hemat dengan icon resmi tiap operator</p>
            </div>

            {/* TAB TOGGLE: PULSA vs KUOTA */}
            <div className={`p-1 rounded-xl border flex items-center gap-1 self-start sm:self-center ${isDark ? 'bg-[#141815] border-[#28302A]' : 'bg-slate-100 border-slate-200'}`}>
              <button
                type="button"
                onClick={() => setPulsaOrKuotaTab('pulsa')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-space font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  pulsaOrKuotaTab === 'pulsa'
                    ? isDark
                      ? 'bg-[#C7FF4D] text-[#101211] shadow-lime-glow'
                      : 'bg-white text-slate-900 shadow-xs'
                    : isDark
                      ? 'text-[#A4ADA6] hover:text-white'
                      : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Smartphone size={14} />
                <span>📱 Pulsa Reguler</span>
              </button>

              <button
                type="button"
                onClick={() => setPulsaOrKuotaTab('kuota')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-space font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  pulsaOrKuotaTab === 'kuota'
                    ? isDark
                      ? 'bg-[#C7FF4D] text-[#101211] shadow-lime-glow'
                      : 'bg-white text-slate-900 shadow-xs'
                    : isDark
                      ? 'text-[#A4ADA6] hover:text-white'
                      : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Wifi size={14} />
                <span>🌐 Paket Kuota Data</span>
              </button>
            </div>
          </div>

          {/* Form Rows: Operator + Phone Input */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Phone Number Input with Carrier Badge */}
            <div className="space-y-1.5">
              <label className={`text-xs font-space font-bold ${isDark ? 'text-[#F5F7F2]' : 'text-slate-900'} uppercase tracking-wider block`}>
                Nomor Handphone Penerima
              </label>
              <div className={`flex items-center ${isDark ? 'bg-[#141815] border-[#28302A] focus-within:border-[#C7FF4D]' : 'bg-slate-50 border-slate-200 focus-within:border-amber-400 focus-within:bg-white'} border rounded-xl px-3.5 py-2.5 transition-all shadow-inner`}>
                <div className="mr-2.5 shrink-0">
                  <ProductLogo provider={detectedOp} size="xs" />
                </div>
                <input
                  type="tel"
                  value={pulsaPhone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="08xx - xxxx - xxxx"
                  className={`bg-transparent ${isDark ? 'text-[#F5F7F2] placeholder-[#68736B]' : 'text-slate-900 placeholder-slate-400'} font-mono text-sm sm:text-base font-bold focus:outline-none flex-1`}
                />
                <span className={`px-2.5 py-1 rounded-md ${isDark ? 'bg-[#1B1F1C] text-[#C7FF4D] border-[#3E4C41]' : 'bg-white text-slate-800 border-slate-200'} border text-[10px] font-space font-bold uppercase shrink-0 shadow-xs`}>
                  {detectedOp}
                </span>
              </div>
            </div>

            {/* Provider Selector Pills WITH OFFICIAL OPERATOR ICONS */}
            <div className="space-y-1.5">
              <label className={`text-xs font-space font-bold ${isDark ? 'text-[#F5F7F2]' : 'text-slate-900'} uppercase tracking-wider block`}>
                Pilihan Operator (Icon Provider)
              </label>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {[
                  { name: 'Telkomsel', code: 'T-Sel', iconProvider: 'Telkomsel' },
                  { name: 'Indosat', code: 'ISAT', iconProvider: 'Indosat' },
                  { name: 'XL Axiata', code: 'XL', iconProvider: 'XL' },
                  { name: 'Tri', code: '3', iconProvider: 'Tri' },
                  { name: 'Smartfren', code: 'Smart', iconProvider: 'Smartfren' },
                  { name: 'Axis', code: 'Axis', iconProvider: 'Axis' },
                ].map((op) => {
                  const isMatch = (selectedPulsaProvider || detectedOp).toLowerCase().includes(op.code.toLowerCase()) ||
                    (selectedPulsaProvider || detectedOp).toLowerCase().includes(op.name.toLowerCase().split(' ')[0]);
                  return (
                    <button
                      key={op.name}
                      onClick={() => handleProviderSelect(op.name.split(' ')[0])}
                      className={`px-3 py-2 rounded-xl border text-xs font-space font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                        isMatch
                          ? isDark
                            ? 'bg-[#1E251F] border-[#3E4C41] text-[#C7FF4D] shadow-xs'
                            : 'bg-slate-900 border-slate-900 text-white shadow-xs'
                          : isDark
                            ? 'bg-[#141815] border-[#28302A] text-[#A4ADA6] hover:text-[#F5F7F2] hover:bg-[#1B1F1C]'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <ProductLogo provider={op.iconProvider} size="xs" showBadgeBorder={false} />
                      <span>{op.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Telco Packages / Denominations Grid with Provider Icon */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <span className={`text-xs font-space font-bold ${isDark ? 'text-[#A4ADA6]' : 'text-slate-600'} uppercase tracking-wider block`}>
                PILIHAN UTAMA {pulsaOrKuotaTab === 'pulsa' ? 'PULSA' : 'KUOTA'} ({detectedOp})
              </span>
              <button
                type="button"
                onClick={() => onNavigate(pulsaOrKuotaTab)}
                className={`text-xs font-space font-bold ${
                  isDark ? 'text-[#C7FF4D] hover:underline' : 'text-amber-600 hover:text-amber-700'
                } flex items-center gap-1 cursor-pointer`}
              >
                <span>Lihat Semua ({pulsaGridProducts.length})</span>
                <ChevronRight size={13} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {compactTelcoItems.map((pkg: any) => (
                <div
                  key={pkg.id}
                  className={`p-3.5 rounded-2xl ${isDark ? 'bg-[#141815] border-[#28302A] hover:border-[#3E4C41] hover:bg-[#1B1F1C]' : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-white'} border flex flex-col justify-between space-y-3 transition-all hover:shadow-xs`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <ProductLogo provider={pkg.provider || selectedPulsaProvider || detectedOp} size="xs" />
                        <span className={`text-[9px] font-space font-bold px-1.5 py-0.5 rounded ${isDark ? 'bg-[#C7FF4D]/15 text-[#C7FF4D]' : 'bg-amber-100 text-amber-800'} uppercase`}>
                          {pkg.badge || pkg.tag || (pulsaOrKuotaTab === 'pulsa' ? 'PULSA' : 'KUOTA')}
                        </span>
                      </div>
                      <span className={`text-[10px] ${isDark ? 'text-[#A4ADA6]' : 'text-slate-500'} font-space`}>
                        {pkg.provider || detectedOp}
                      </span>
                    </div>

                    <h3 className={`font-space font-bold text-xs sm:text-sm ${isDark ? 'text-[#F5F7F2]' : 'text-slate-900'}`}>
                      {pkg.name}
                    </h3>
                    <p className={`text-[11px] ${isDark ? 'text-[#A4ADA6]' : 'text-slate-500'} mt-1 font-jakarta leading-relaxed line-clamp-2`}>
                      {pkg.quotaDetails || pkg.description || pkg.quota || 'Proses otomatis 24 jam langsung masuk'}
                    </p>
                  </div>

                  <div className={`pt-2 border-t ${isDark ? 'border-[#28302A]' : 'border-slate-200/80'} flex items-center justify-between`}>
                    <div>
                      <span className={`text-[9px] ${isDark ? 'text-[#68736B]' : 'text-slate-400'} block`}>Harga</span>
                      <span className={`font-space font-bold text-sm ${isDark ? 'text-[#C7FF4D]' : 'text-slate-900'}`}>
                        {formatRupiah(pkg.sellingPrice || pkg.price)}
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        handleExecuteQuickPulsa(pkg);
                      }}
                      className={`px-3.5 py-1.5 rounded-lg ${isDark ? 'bg-[#C7FF4D] hover:bg-[#D7FF75] text-[#101211] font-bold shadow-lime-glow' : 'bg-[#FACC15] hover:bg-[#EAB308] text-slate-900'} font-space font-bold text-xs transition-all cursor-pointer shadow-xs`}
                    >
                      {pulsaOrKuotaTab === 'pulsa' ? 'Isi Pulsa' : 'Beli Kuota'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 9. VOUCHER WIFI RT/RW NET SECTION (PRESERVED FEATURE) */}
        {wifiProducts.length > 0 && (
          <section id="section-wifi-vouchers" className="space-y-3.5 scroll-mt-20">
            <div className={`flex items-center justify-between border-l-2 ${isDark ? 'border-[#C7FF4D]' : 'border-amber-500'} pl-3`}>
              <div>
                <span className={`text-[10px] font-space font-bold ${isDark ? 'text-[#C7FF4D]' : 'text-amber-600'} uppercase tracking-wider block`}>
                  INTERNET WARGA CEPAT
                </span>
                <h2 className={`text-base sm:text-lg font-bold font-space ${isDark ? 'text-[#F5F7F2]' : 'text-slate-900'} tracking-tight`}>
                  Voucher WiFi RT/RW Net
                </h2>
                <p className={`text-xs ${isDark ? 'text-[#A4ADA6]' : 'text-slate-500'}`}>Kode voucher login hotspot warga terkirim instan setelah pembayaran</p>
              </div>
              <button
                onClick={() => onNavigate('wifi')}
                className={`text-xs ${isDark ? 'text-[#C7FF4D] hover:underline' : 'text-amber-600 hover:text-amber-700'} font-space font-bold flex items-center gap-1 cursor-pointer`}
              >
                <span>Lihat Semua Lokasi</span>
                <ChevronRight size={13} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {wifiProducts.slice(0, 6).map((wifi) => (
                <div
                  key={wifi.id}
                  className={`p-4 rounded-2xl ${isDark ? 'bg-[#1B1F1C] border-[#28302A] hover:border-[#3E4C41]' : 'bg-white border-slate-200 hover:border-slate-300'} border hover:shadow-md flex items-center justify-between gap-3 transition-all hover:-translate-y-0.5`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${isDark ? 'bg-blue-500/15 border-blue-500/30 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-600'} border flex items-center justify-center shrink-0`}>
                      <Radio size={18} />
                    </div>
                    <div>
                      <h3 className={`font-space font-bold text-xs sm:text-sm ${isDark ? 'text-[#F5F7F2]' : 'text-slate-900'} line-clamp-1`}>{wifi.name}</h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {wifi.duration && (
                          <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded ${isDark ? 'bg-[#C7FF4D]/15 text-[#C7FF4D]' : 'bg-amber-100 text-amber-800'}`}>
                            {wifi.duration}
                          </span>
                        )}
                        <span className={`text-[10px] ${isDark ? 'text-[#C7FF4D]' : 'text-slate-600'} font-bold`}>
                          {formatRupiah(wifi.sellingPrice)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => onSelectProductToCheckout(wifi)}
                    className={`px-3.5 py-1.5 rounded-xl ${isDark ? 'bg-[#C7FF4D] hover:bg-[#D7FF75] text-[#101211] font-bold shadow-lime-glow' : 'bg-[#FACC15] hover:bg-[#EAB308] text-slate-900'} font-space font-bold text-xs transition-all cursor-pointer shadow-xs shrink-0`}
                  >
                    Beli
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 10. API GATEWAY AI & DEVELOPER SANDBOX SECTION (KHUSUS JUALAN TOKEN API KEY AI) */}
        <section id="section-api-sandbox" className="rounded-2xl sm:rounded-3xl p-5 sm:p-7 bg-gradient-to-br from-[#0B132B] via-[#0F172A] to-[#0A101D] border border-slate-800 shadow-xl space-y-6 scroll-mt-20 text-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-l-2 border-[#C7FF4D] pl-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-[#C7FF4D]/20 border border-[#C7FF4D]/40 text-[#C7FF4D] text-[10px] font-space font-bold uppercase">
                  ⚡ JUALAN TOKEN API KEY AI RESMI &amp; DEVELOPER SANDBOX
                </span>
              </div>
              <h2 className="text-base sm:text-xl font-bold font-space text-white tracking-tight mt-1">
                API Gateway AI &amp; Developer Sandbox
              </h2>
              <p className="text-xs text-slate-300">
                Pusat pembelian Token API Key AI resmi: OpenAI GPT-4o, Claude 3.5 Sonnet, DeepSeek R1, Gemini Pro &amp; Midjourney. Aktif instan, siap integrasi bot WA/Telegram &amp; aplikasi!
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="text-emerald-400">● Saldo Resmi Instan</span>
              <span className="text-slate-600">|</span>
              <span className="text-[#C7FF4D]">&lt; 150ms Latency</span>
            </div>
          </div>

          {/* AI Token API Key Products Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {aiTokenProductsList.map((aiProd) => (
              <div 
                key={aiProd.id}
                className="p-4 rounded-2xl bg-slate-900/90 border border-slate-700/80 hover:border-[#C7FF4D]/60 transition-all flex flex-col justify-between space-y-3 relative group"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center border border-slate-700 shrink-0">
                        <ProductLogo provider={aiProd.provider} iconUrl={aiProd.iconUrl} size="sm" />
                      </div>
                      <div className="overflow-hidden">
                        <span className="text-[10px] font-mono text-slate-400 block truncate">{aiProd.provider}</span>
                        <h3 className="font-space font-bold text-sm text-white line-clamp-1">{aiProd.name}</h3>
                      </div>
                    </div>
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-[#C7FF4D]/15 text-[#C7FF4D] border border-[#C7FF4D]/30 font-bold uppercase shrink-0">
                      {aiProd.badge || 'TOKEN AI'}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-300 line-clamp-2 mt-2 leading-relaxed font-jakarta">
                    {aiProd.description}
                  </p>

                  <ul className="space-y-1.5 text-xs text-slate-300 mt-3 pt-3 border-t border-slate-800">
                    <li className="flex items-center gap-1.5">
                      <Check size={13} className="text-emerald-400 shrink-0" />
                      <span>Format Key: <strong className="font-mono text-[11px] text-amber-300">sk-...</strong> (Resmi Aktif)</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check size={13} className="text-emerald-400 shrink-0" />
                      <span>Masa Aktif: {aiProd.duration || 'Aktif 3 Bulan'}</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check size={13} className="text-emerald-400 shrink-0" />
                      <span>Support Bot WA, Telegram, Webhook &amp; SDK</span>
                    </li>
                  </ul>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] text-slate-400 block font-space">Harga Resmi</span>
                    <span className="font-space font-bold text-base text-[#C7FF4D]">
                      {formatRupiah(aiProd.sellingPrice)}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      if (!currentUser) {
                        onShowToast(
                          'Wajib Daftar Akun Terlebih Dahulu',
                          'Semua pembeli wajib mendaftar akun untuk membeli Token API Key AI dan mengakses brankas saldo Anda.',
                          'warning'
                        );
                        onNavigate('daftar');
                        return;
                      }
                      onSelectProductToCheckout(aiProd);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-[#C7FF4D] hover:bg-[#D7FF75] text-[#0B132B] font-space font-bold text-xs transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    <span>Beli Token</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Interactive Code Terminal Box */}
          <div className="rounded-2xl bg-[#090D1A] border border-slate-800 overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500/80"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></span>
                </div>
                <span className="text-xs font-mono text-slate-400 ml-2">clouvia_router.js • Clouvia AI Gateway &amp; Developer Sandbox (router.clouvia.id/v1)</span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCodeSnippetTab('node')}
                  className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold cursor-pointer transition-colors ${
                    codeSnippetTab === 'node' ? 'bg-[#C7FF4D] text-[#0B132B]' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Node.js
                </button>
                <button
                  onClick={() => setCodeSnippetTab('curl')}
                  className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold cursor-pointer transition-colors ${
                    codeSnippetTab === 'curl' ? 'bg-[#C7FF4D] text-[#0B132B]' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  cURL
                </button>
                <button
                  onClick={() => setCodeSnippetTab('python')}
                  className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold cursor-pointer transition-colors ${
                    codeSnippetTab === 'python' ? 'bg-[#C7FF4D] text-[#0B132B]' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Python
                </button>
                <button
                  onClick={() => {
                    handleCopyPromoCode(
                      codeSnippetTab === 'node'
                        ? `import OpenAI from 'openai';\n\nconst client = new OpenAI({\n  apiKey: process.env.CLOUVIA_API_KEY || 'clv_live_xxxxxxxxxxxxxxxxxxxxxxxx',\n  baseURL: 'https://router.clouvia.id/v1'\n});\n\nconst response = await client.chat.completions.create({\n  model: 'coding-high',\n  messages: [\n    { role: 'system', content: 'Kamu asisten arsitektur teknis yang ringkas dan solutif.' },\n    { role: 'user', content: 'Jelaskan konsep zero-copy buffer dalam 2 kalimat.' }\n  ],\n  temperature: 0.3\n});\n\nconsole.log(response.choices[0].message.content);`
                        : codeSnippetTab === 'python'
                        ? `import os\nfrom openai import OpenAI\n\nclient = OpenAI(\n  api_key=os.environ.get("CLOUVIA_API_KEY", "clv_live_xxxxxxxxxxxxxxxxxxxxxxxx"),\n  base_url="https://router.clouvia.id/v1"\n)\n\nresponse = client.chat.completions.create(\n  model="coding-high",\n  messages=[\n    {"role": "system", "content": "Kamu asisten arsitektur teknis yang ringkas dan solutif."},\n    {"role": "user", "content": "Jelaskan konsep zero-copy buffer dalam 2 kalimat."}\n  ],\n  temperature: 0.3\n)\n\nprint(response.choices[0].message.content)`
                        : `curl https://router.clouvia.id/v1/chat/completions \\\n  -H "Authorization: Bearer clv_live_xxxxxxxxxxxxxxxxxxxxxxxx" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n  "model": "coding-high",\n  "messages": [\n    {"role": "system", "content": "Kamu asisten arsitektur teknis yang ringkas dan solutif."},\n    {"role": "user", "content": "Jelaskan konsep zero-copy buffer dalam 2 kalimat."}\n  ],\n  "temperature": 0.3\n}'`
                    );
                  }}
                  className="px-2 py-1 rounded text-[10px] text-slate-400 hover:text-[#C7FF4D] transition-colors cursor-pointer flex items-center gap-1 ml-2 border border-slate-700"
                >
                  <Copy size={11} />
                  <span>Copy</span>
                </button>
              </div>
            </div>

            <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed">
              {codeSnippetTab === 'node' && (
                <code>
                  <span className="text-sky-400">import</span> OpenAI <span className="text-sky-400">from</span> <span className="text-emerald-400">'openai'</span>;<br/><br/>
                  <span className="text-sky-400">const</span> client = <span className="text-sky-400">new</span> OpenAI(&#123;<br/>
                  &nbsp;&nbsp;apiKey: process.env.CLOUVIA_API_KEY || <span className="text-emerald-400">'clv_live_xxxxxxxxxxxxxxxxxxxxxxxx'</span>,<br/>
                  &nbsp;&nbsp;baseURL: <span className="text-emerald-400">'https://router.clouvia.id/v1'</span><br/>
                  &#125;);<br/><br/>
                  <span className="text-sky-400">const</span> response = <span className="text-sky-400">await</span> client.chat.completions.create(&#123;<br/>
                  &nbsp;&nbsp;model: <span className="text-emerald-400">'coding-high'</span>,<br/>
                  &nbsp;&nbsp;messages: [<br/>
                  &nbsp;&nbsp;&nbsp;&nbsp;&#123; role: <span className="text-emerald-400">'system'</span>, content: <span className="text-emerald-400">'Kamu asisten arsitektur teknis yang ringkas dan solutif.'</span> &#125;,<br/>
                  &nbsp;&nbsp;&nbsp;&nbsp;&#123; role: <span className="text-emerald-400">'user'</span>, content: <span className="text-emerald-400">'Jelaskan konsep zero-copy buffer dalam 2 kalimat.'</span> &#125;<br/>
                  &nbsp;&nbsp;],<br/>
                  &nbsp;&nbsp;temperature: <span className="text-amber-300">0.3</span><br/>
                  &#125;);<br/><br/>
                  console.log(response.choices[<span className="text-amber-300">0</span>].message.content);
                </code>
              )}
              {codeSnippetTab === 'curl' && (
                <code>
                  <span className="text-sky-400">curl</span> https://router.clouvia.id/v1/chat/completions \<br/>
                  &nbsp;&nbsp;-H <span className="text-emerald-400">"Authorization: Bearer clv_live_xxxxxxxxxxxxxxxxxxxxxxxx"</span> \<br/>
                  &nbsp;&nbsp;-H <span className="text-emerald-400">"Content-Type: application/json"</span> \<br/>
                  &nbsp;&nbsp;-d <span className="text-amber-300">'{JSON.stringify({
                    model: "coding-high",
                    messages: [
                      { role: "system", content: "Kamu asisten arsitektur teknis yang ringkas dan solutif." },
                      { role: "user", content: "Jelaskan konsep zero-copy buffer dalam 2 kalimat." }
                    ],
                    temperature: 0.3
                  }, null, 2)}'</span>
                </code>
              )}
              {codeSnippetTab === 'python' && (
                <code>
                  <span className="text-sky-400">import</span> os<br/>
                  <span className="text-sky-400">from</span> openai <span className="text-sky-400">import</span> OpenAI<br/><br/>
                  client = OpenAI(<br/>
                  &nbsp;&nbsp;api_key=os.environ.get(<span className="text-emerald-400">"CLOUVIA_API_KEY"</span>, <span className="text-emerald-400">"clv_live_xxxxxxxxxxxxxxxxxxxxxxxx"</span>),<br/>
                  &nbsp;&nbsp;base_url=<span className="text-emerald-400">"https://router.clouvia.id/v1"</span><br/>
                  )<br/><br/>
                  response = client.chat.completions.create(<br/>
                  &nbsp;&nbsp;model=<span className="text-emerald-400">"coding-high"</span>,<br/>
                  &nbsp;&nbsp;messages=[<br/>
                  &nbsp;&nbsp;&nbsp;&nbsp;&#123;<span className="text-emerald-400">"role"</span>: <span className="text-emerald-400">"system"</span>, <span className="text-emerald-400">"content"</span>: <span className="text-emerald-400">"Kamu asisten arsitektur teknis yang ringkas dan solutif."</span>&#125;,<br/>
                  &nbsp;&nbsp;&nbsp;&nbsp;&#123;<span className="text-emerald-400">"role"</span>: <span className="text-emerald-400">"user"</span>, <span className="text-emerald-400">"content"</span>: <span className="text-emerald-400">"Jelaskan konsep zero-copy buffer dalam 2 kalimat."</span>&#125;<br/>
                  &nbsp;&nbsp;],<br/>
                  &nbsp;&nbsp;temperature=<span className="text-amber-300">0.3</span><br/>
                  )<br/><br/>
                  print(response.choices[<span className="text-amber-300">0</span>].message.content)
                </code>
              )}
            </pre>
          </div>
        </section>

        {/* 11. CARA PEMBELIAN 3 LANGKAH MUDAH */}
        <section className="space-y-4 pt-2">
          <div className="text-center max-w-xl mx-auto space-y-1">
            <span className={`text-[10px] font-space font-bold ${isDark ? 'text-[#C7FF4D]' : 'text-amber-600'} uppercase tracking-wider block`}>
              TRANSAKSI INSTAN &amp; PRAKTIS
            </span>
            <h2 className={`text-lg sm:text-2xl font-bold font-space ${isDark ? 'text-[#F5F7F2]' : 'text-slate-900'}`}>
              Cara Pembelian 3 Langkah Mudah
            </h2>
            <p className={`text-xs ${isDark ? 'text-[#A4ADA6]' : 'text-slate-500'} font-jakarta`}>
              Cepat &amp; praktis, pesanan diproses otomatis 1-3 detik dengan brankas riwayat &amp; saldo akun member
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-2">
            <div className={`p-5 rounded-2xl ${isDark ? 'bg-[#1B1F1C] border-[#28302A]' : 'bg-white border-slate-200'} border flex items-start gap-3.5 shadow-xs`}>
              <div className={`w-10 h-10 rounded-xl ${isDark ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-amber-100 text-amber-800 border-amber-300'} border flex items-center justify-center font-space font-bold text-base shrink-0`}>
                01
              </div>
              <div className="space-y-1">
                <h3 className={`font-space font-bold text-sm ${isDark ? 'text-[#F5F7F2]' : 'text-slate-900'}`}>Pilih Produk &amp; Nominal</h3>
                <p className={`text-xs ${isDark ? 'text-[#A4ADA6]' : 'text-slate-500'} font-jakarta leading-relaxed`}>
                  Tentukan item game, voucher WiFi, atau kuota data yang Anda butuhkan dengan harga bersahabat.
                </p>
              </div>
            </div>

            <div className={`p-5 rounded-2xl ${isDark ? 'bg-[#1B1F1C] border-[#28302A]' : 'bg-white border-slate-200'} border flex items-start gap-3.5 shadow-xs`}>
              <div className={`w-10 h-10 rounded-xl ${isDark ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-blue-100 text-blue-800 border-blue-300'} border flex items-center justify-center font-space font-bold text-base shrink-0`}>
                02
              </div>
              <div className="space-y-1">
                <h3 className={`font-space font-bold text-sm ${isDark ? 'text-[#F5F7F2]' : 'text-slate-900'}`}>Masukkan Data Akun</h3>
                <p className={`text-xs ${isDark ? 'text-[#A4ADA6]' : 'text-slate-500'} font-jakarta leading-relaxed`}>
                  Ketik User ID Game, nomor HP, atau pilih voucher hotspot. Sistem kami otomatis memvalidasi nickname.
                </p>
              </div>
            </div>

            <div className={`p-5 rounded-2xl ${isDark ? 'bg-[#1B1F1C] border-[#28302A]' : 'bg-white border-slate-200'} border flex items-start gap-3.5 shadow-xs`}>
              <div className={`w-10 h-10 rounded-xl ${isDark ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-emerald-100 text-emerald-800 border-emerald-300'} border flex items-center justify-center font-space font-bold text-base shrink-0`}>
                03
              </div>
              <div className="space-y-1">
                <h3 className={`font-space font-bold text-sm ${isDark ? 'text-[#F5F7F2]' : 'text-slate-900'}`}>Bayar &amp; Selesai Otomatis</h3>
                <p className={`text-xs ${isDark ? 'text-[#A4ADA6]' : 'text-slate-500'} font-jakarta leading-relaxed`}>
                  Pilih pembayaran QRIS, e-wallet, atau transfer. Pesanan terproses instan 1-3 detik tanpa kendala.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 12. LACAK STATUS PESANAN ANDA */}
        <section className={`p-5 sm:p-6 rounded-2xl ${isDark ? 'bg-[#1B1F1C] border-[#28302A]' : 'bg-white border-slate-200'} border flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs`}>
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl ${isDark ? 'bg-amber-500/15 border-amber-500/30 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-600'} border flex items-center justify-center shrink-0`}>
              <ReceiptText size={22} />
            </div>
            <div>
              <h3 className={`font-space font-bold text-sm sm:text-base ${isDark ? 'text-[#F5F7F2]' : 'text-slate-900'}`}>
                Lacak Status Pesanan Anda
              </h3>
              <p className={`text-xs ${isDark ? 'text-[#A4ADA6]' : 'text-slate-500'} font-jakarta`}>
                Masukkan Nomor Invoice / Kode Transaksi untuk verifikasi status pengiriman
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto md:min-w-[340px]">
            <input
              type="text"
              value={trackingInvoiceInput}
              onChange={(e) => setTrackingInvoiceInput(e.target.value)}
              placeholder="Contoh: INV-2026..."
              className={`flex-1 ${isDark ? 'bg-[#141815] text-[#F5F7F2] placeholder-[#68736B] border-[#28302A] focus:border-[#C7FF4D]' : 'bg-slate-50 text-slate-900 placeholder-slate-400 border-slate-200 focus:border-amber-400'} text-xs font-mono rounded-xl px-3.5 py-2.5 border focus:outline-none transition-all`}
            />
            <button
              onClick={handleTrackInvoice}
              className={`px-4 py-2.5 rounded-xl ${isDark ? 'bg-[#C7FF4D] hover:bg-[#D7FF75] text-[#101211] font-bold shadow-lime-glow' : 'bg-[#FACC15] hover:bg-[#EAB308] text-slate-900'} font-space font-bold text-xs transition-all cursor-pointer shrink-0 shadow-xs`}
            >
              Cek Resi
            </button>
          </div>
        </section>

        {/* 13. PERTANYAAN YANG SERING DIAJUKAN (FAQ ACCORDION) */}
        <section className="space-y-3.5 pt-2">
          <div className="text-center max-w-xl mx-auto space-y-1">
            <span className={`text-[10px] font-space font-bold ${isDark ? 'text-[#C7FF4D]' : 'text-amber-600'} uppercase tracking-wider block`}>
              BANTUAN &amp; EDUKASI PELANGGAN
            </span>
            <h2 className={`text-lg sm:text-2xl font-bold font-space ${isDark ? 'text-[#F5F7F2]' : 'text-slate-900'}`}>
              Pertanyaan yang Sering Diajukan
            </h2>
            <p className={`text-xs ${isDark ? 'text-[#A4ADA6]' : 'text-slate-500'}`}>
              Ketahui lebih lanjut mengenai cara transaksi dan keamanan operasional WayaheDigital
            </p>
          </div>

          <div className="space-y-2.5 max-w-3xl mx-auto pt-2">
            {[
              {
                q: 'Berapa lama transaksi akan selesai diproses?',
                a: 'Sistem kami terhubung langsung secara real-time via API, sehingga mayoritas transaksi (seperti diamond game, voucher WiFi, pulsa dan paket data) selesai dalam waktu 1-3 detik setelah pembayaran berhasil dikonfirmasi.'
              },
              {
                q: 'Apakah transaksi top up di WayaheDigital legal dan aman?',
                a: '100% legal dan resmi. Semua produk diamond, voucher, pulsa dan data disalurkan melalui jalur distributor authorized resmi tanpa risiko banned atau pemotongan sepihak.'
              },
              {
                q: 'Bagaimana jika salah memasukkan User ID atau pesanan terlambat?',
                a: 'Tim Customer Service kami standby 24 jam nonstop via WhatsApp. Jika ada kendala, sertakan nomor invoice pesanan Anda untuk pengecekan cepat dan penanganan langsung.'
              }
            ].map((faq, idx) => {
              const isExpanded = expandedFaqIndex === idx;
              return (
                <div
                  key={idx}
                  className={`rounded-2xl ${isDark ? 'bg-[#1B1F1C] border-[#28302A]' : 'bg-white border-slate-200'} border overflow-hidden shadow-xs transition-all`}
                >
                  <button
                    onClick={() => setExpandedFaqIndex(isExpanded ? null : idx)}
                    className={`w-full p-4 text-left flex items-center justify-between gap-3 cursor-pointer ${isDark ? 'hover:bg-[#141815]' : 'hover:bg-slate-50'} transition-colors`}
                  >
                    <span className={`font-space font-bold text-xs sm:text-sm ${isDark ? 'text-[#F5F7F2]' : 'text-slate-900'}`}>
                      {faq.q}
                    </span>
                    <ChevronDown
                      size={16}
                      className={`text-slate-400 transition-transform duration-200 shrink-0 ${
                        isExpanded ? (isDark ? 'rotate-180 text-[#C7FF4D]' : 'rotate-180 text-amber-500') : ''
                      }`}
                    />
                  </button>
                  {isExpanded && (
                    <div className={`px-4 pb-4 pt-1 text-xs ${isDark ? 'text-[#A4ADA6] border-[#28302A]' : 'text-slate-600 border-slate-100'} font-jakarta leading-relaxed border-t`}>
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* 14. SEARCH RESULTS OVERLAY (HANYA MUNCUL SAAT MENCARI) */}
        {catalogSearch.trim() !== '' && (
          <section id="semua-katalog" className={`space-y-4 pt-4 border-t ${isDark ? 'border-[#28302A]' : 'border-slate-200'} animate-fadeIn`}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className={`text-base sm:text-xl font-bold font-space ${isDark ? 'text-[#F5F7F2]' : 'text-slate-900'} tracking-tight`}>
                  Hasil Pencarian Produk
                </h2>
                <p className={`text-xs ${isDark ? 'text-[#A4ADA6]' : 'text-slate-500'}`}>
                  Ditemukan {filteredProducts.length} produk untuk kata kunci "{catalogSearch}"
                </p>
              </div>

              <button
                onClick={() => setCatalogSearch('')}
                className={`text-xs ${isDark ? 'text-[#C7FF4D]' : 'text-amber-600'} hover:underline font-space font-bold cursor-pointer`}
              >
                Reset Pencarian
              </button>
            </div>

            {filteredProducts.length === 0 ? (
              <div className={`p-8 rounded-2xl ${isDark ? 'bg-[#1B1F1C] border-[#28302A] text-[#A4ADA6]' : 'bg-white border-slate-200 text-slate-500'} border text-center text-xs shadow-xs`}>
                Tidak ada produk yang cocok dengan kata kunci "{catalogSearch}".
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {filteredProducts.slice(0, 16).map((p) => {
                  const isOutOfStock = p.stock !== undefined && p.stock <= 0;
                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        if (!isOutOfStock) onSelectProductToCheckout(p);
                      }}
                      className={`group p-3.5 sm:p-4 rounded-2xl ${isDark ? 'bg-[#1B1F1C]' : 'bg-white'} border transition-all duration-200 flex flex-col justify-between relative cursor-pointer ${
                        isOutOfStock
                          ? isDark ? 'opacity-50 border-[#28302A] cursor-not-allowed' : 'opacity-50 border-slate-200 cursor-not-allowed'
                          : isDark ? 'border-[#28302A] hover:border-[#C7FF4D] hover:shadow-md hover:-translate-y-1 shadow-xs' : 'border-slate-200 hover:border-amber-400 hover:shadow-md hover:-translate-y-1 shadow-xs'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                          <div className={`w-9 h-9 rounded-xl ${isDark ? 'bg-[#141815] border-[#28302A]' : 'bg-slate-50 border-slate-200'} border flex items-center justify-center shrink-0`}>
                            <ProductLogo
                              provider={p.provider}
                              name={p.name}
                              category={p.categoryId}
                              iconUrl={p.iconUrl}
                              size="sm"
                              className="rounded-lg"
                            />
                          </div>
                          <span className={`text-[10px] font-bold font-space ${isDark ? 'text-[#C7FF4D] bg-[#C7FF4D]/15 border-[#C7FF4D]/30' : 'text-amber-700 bg-amber-50 border-amber-200'} border px-2 py-0.5 rounded-full uppercase`}>
                            {p.provider}
                          </span>
                        </div>

                        <h3 className={`font-space font-bold text-xs sm:text-sm ${isDark ? 'text-[#F5F7F2] group-hover:text-[#C7FF4D]' : 'text-slate-900 group-hover:text-amber-600'} transition-colors line-clamp-1`}>
                          {p.name}
                        </h3>
                        <p className={`text-[11px] ${isDark ? 'text-[#A4ADA6]' : 'text-slate-500'} mt-0.5 line-clamp-1`}>
                          {p.quotaDetails || p.duration || p.description}
                        </p>
                      </div>

                      <div className={`mt-3 pt-2.5 border-t ${isDark ? 'border-[#28302A]' : 'border-slate-100'} flex items-center justify-between`}>
                        <div>
                          <span className={`text-[9px] ${isDark ? 'text-[#68736B]' : 'text-slate-400'} block uppercase font-mono`}>Harga</span>
                          <span className={`font-space font-bold text-xs sm:text-sm ${isDark ? 'text-[#C7FF4D]' : 'text-slate-900'}`}>
                            {formatRupiah(p.sellingPrice)}
                          </span>
                        </div>

                        <span className={`text-xs font-bold font-space ${isDark ? 'text-[#C7FF4D]' : 'text-amber-600'} group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5`}>
                          <span>Beli</span>
                          <ArrowRight size={12} />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

      </div>

      {/* Game Top Up Modal (Pilihan Diamond MLBB, FF, Valo, dll.) */}
      <GameTopUpModal
        isOpen={!!selectedGameModal}
        game={selectedGameModal}
        products={products}
        onClose={() => setSelectedGameModal(null)}
        onCheckout={(product, targetAccount) => {
          onSelectProductToCheckout(product, targetAccount);
        }}
        onShowToast={onShowToast}
      />
    </div>
  );
}

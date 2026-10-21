import { Product, PromoCode, Category, WifiVoucherItem, Order } from '../types';

export const CATEGORIES: Category[] = [
  {
    id: '1',
    name: 'Top Up Game & Voucher',
    slug: 'game',
    description: 'Diamond Mobile Legends, Free Fire, UC PUBG, Valorant, Steam Wallet instan.',
    icon: 'Gamepad2',
    color: 'amber',
  },
  {
    id: '2',
    name: 'Voucher WiFi RT/RW Net',
    slug: 'wifi',
    description: 'Akses internet warga cepat dan hemat berbasis voucher login Hotspot.',
    icon: 'Radio',
    color: 'amber',
  },
  {
    id: '3',
    name: 'Pulsa Reguler',
    slug: 'pulsa',
    description: 'Isi ulang pulsa semua operator Indonesia secara instan 24 jam.',
    icon: 'Smartphone',
    color: 'amber',
  },
  {
    id: '4',
    name: 'Kuota Internet',
    slug: 'kuota',
    description: 'Paket data 24 jam, combo nelpon, booster game, dan streaming.',
    icon: 'Wifi',
    color: 'amber',
  },
];

export const INITIAL_PRODUCTS: Product[] = [];

export const INITIAL_PROMOS: PromoCode[] = [
  {
    code: 'WAYAHEHEMAT',
    discountAmount: 2500,
    minTransaction: 10000,
    description: 'Potongan langsung Rp 2.500 untuk semua produk.',
    isActive: true,
  },
  {
    code: 'WIFIWARGA',
    discountAmount: 2000,
    minTransaction: 5000,
    description: 'Diskon Rp 2.000 khusus voucher WiFi RT/RW Net.',
    isActive: true,
  },
  {
    code: 'DIGITALNEW',
    discountAmount: 3000,
    minTransaction: 20000,
    description: 'Voucher selamat datang untuk pengguna baru.',
    isActive: true,
  },
];

export const INITIAL_WIFI_VOUCHERS: WifiVoucherItem[] = [];

export const INITIAL_ORDERS: Order[] = [];


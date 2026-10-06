import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Product, Order, User, ToastMessage, AdminAuthSession, PromoBanner, AppSettings } from './types';
import { storage } from './services/storage';
import { apiAdapter } from './services/apiAdapter';

// Components
import { Navbar } from './components/Navbar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { Footer } from './components/Footer';
import { ToastContainer } from './components/Toast';
import { SnapSimulatorModal } from './components/SnapSimulatorModal';
import { InvoiceModal } from './components/InvoiceModal';
import { QuickBuyModal } from './components/QuickBuyModal';
import { FloatingCsBot } from './components/FloatingCsBot';
import { TopProgressBar, triggerTopLoading } from './components/TopProgressBar';
import { AuthCenterLoader } from './components/AuthCenterLoader';
import { useTheme } from './context/ThemeContext';
import { CategoryMaintenanceNotice } from './components/CategoryMaintenanceNotice';

// Pages
import { HomePage } from './pages/HomePage';
import { PulsaPage } from './pages/PulsaPage';
import { KuotaPage } from './pages/KuotaPage';
import { WifiVoucherPage } from './pages/WifiVoucherPage';
import { PremiumPage } from './pages/PremiumPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { TransaksiPage } from './pages/TransaksiPage';
import { AkunPage } from './pages/AkunPage';
import { BantuanPage } from './pages/BantuanPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminLoginPage } from './pages/AdminLoginPage';

// Helper to parse route from browser URL or hash
const getRouteFromUrl = (): string => {
  if (typeof window !== 'undefined') {
    const path = window.location.pathname.toLowerCase().replace(/^\/+|\/+$/g, '');
    const hash = window.location.hash.toLowerCase().replace(/^#\/?/, '');

    if (path === 'owner' || path === 'admin' || hash === 'owner' || hash === 'admin') {
      return 'admin';
    }
    if (path === 'daftar' || path === 'register' || hash === 'daftar' || hash === 'register') {
      return 'akun';
    }
    if (['pulsa', 'kuota', 'wifi', 'checkout', 'transaksi', 'akun', 'bantuan'].includes(path)) {
      return path;
    }
    if (['pulsa', 'kuota', 'wifi', 'checkout', 'transaksi', 'akun', 'bantuan'].includes(hash)) {
      return hash;
    }
  }
  return 'home';
};

export default function App() {
  // Navigation with URL synchronization
  const [activeTab, setActiveTab] = useState<string>(() => getRouteFromUrl());
  const [akunAuthRole, setAkunAuthRole] = useState<'LOGIN' | 'REGISTER'>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname.toLowerCase();
      const h = window.location.hash.toLowerCase();
      if (p.includes('daftar') || p.includes('register') || h.includes('daftar') || h.includes('register')) {
        return 'REGISTER';
      }
    }
    return 'LOGIN';
  });

  // Dedicated Auth Loading overlay (Login & Logout only)
  const [authLoader, setAuthLoader] = useState<{
    type: 'LOGIN_MEMBER' | 'LOGOUT_MEMBER' | 'LOGIN_ADMIN' | 'LOGOUT_ADMIN';
    message?: string;
  } | null>(null);

  // Core Data
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [banners, setBanners] = useState<PromoBanner[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<AppSettings>(() => storage.getSettings());
  const [adminSession, setAdminSession] = useState<AdminAuthSession | null>(() => storage.getAdminSession());

  // Checkout State
  const [checkoutProduct, setCheckoutProduct] = useState<Product | null>(null);
  const [checkoutTarget, setCheckoutTarget] = useState<string>('');

  // Modals
  const [activeSnapOrder, setActiveSnapOrder] = useState<Order | null>(null);
  const [activeSnapToken, setActiveSnapToken] = useState<string | null>(null);
  const [activeInvoiceOrder, setActiveInvoiceOrder] = useState<Order | null>(null);

  // Toast notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Central Navigation Handler with History API and smooth TopProgressBar
  const handleNavigate = (tab: string) => {
    triggerTopLoading.start();

    if (tab === 'daftar' || tab === 'register') {
      setAkunAuthRole('REGISTER');
      setActiveTab('akun');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (typeof window !== 'undefined' && window.history) {
        window.history.pushState({ tab: 'daftar' }, '', '/daftar');
      }
      setTimeout(() => {
        triggerTopLoading.done();
      }, 280);
      return;
    }

    if (tab === 'akun') {
      setAkunAuthRole('LOGIN');
    }

    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (typeof window !== 'undefined' && window.history) {
      if (tab === 'admin') {
        window.history.pushState({ tab: 'admin' }, '', '/owner');
      } else if (tab === 'home') {
        window.history.pushState({ tab: 'home' }, '', '/');
      } else {
        window.history.pushState({ tab }, '', `/${tab}`);
      }
    }

    setTimeout(() => {
      triggerTopLoading.done();
    }, 280);
  };

  // Load initial data
  const loadData = () => {
    setProducts(storage.getProducts());
    setOrders(storage.getOrders());
    setBanners(storage.getBanners());
    setCurrentUser(storage.getUser());
    setSettings(storage.getSettings());
  };

  useEffect(() => {
    loadData();

    // Sinkronisasi config gateway dari backend (penting saat deploy production)
    apiAdapter.syncGatewayConfigFromBackend().then((result) => {
      if (result.synced) {
        // Reload settings setelah sync agar UI menggunakan config terbaru
        setSettings(storage.getSettings());
        console.log('[App] Gateway config synced:', result.gateway);
      }
    }).catch(() => {});

    // Listen to browser Back / Forward buttons & Hash Changes
    const handleLocationChange = () => {
      const route = getRouteFromUrl();
      setActiveTab(route);
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    window.addEventListener('wayahe_storage_synced', loadData);
    window.addEventListener('storage', loadData);

    // Background worker simulation for fulfillment and reconciliation
    const workerInterval = setInterval(() => {
      const currentOrders = storage.getOrders();
      const needsFulfillment = currentOrders.filter(
        o => o.paymentStatus === 'PAID' && (o.fulfillmentStatus === 'NOT_STARTED' || o.fulfillmentStatus === 'QUEUED')
      );

      if (needsFulfillment.length > 0) {
        needsFulfillment.forEach(async (order) => {
          try {
            await apiAdapter.retryFulfillment(order.id);
            setOrders(storage.getOrders());
          } catch (e) {
            // Ignore background worker transient error
          }
        });
      }
    }, 12000);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
      window.removeEventListener('wayahe_storage_synced', loadData);
      window.removeEventListener('storage', loadData);
      clearInterval(workerInterval);
    };
  }, []);

  const addToast = (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    const newToast: ToastMessage = {
      id: 'tst-' + Date.now() + Math.random(),
      title,
      message,
      type,
    };
    setToasts(prev => [...prev, newToast]);

    // Notif setelah berhasil (success) cepat hilang: 1200ms
    const duration = type === 'success' ? 1200 : type === 'error' ? 3200 : 2200;
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== newToast.id));
    }, duration);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleCopyText = (text: string, label: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      addToast('Disalin ke Clipboard', `${label} berhasil disalin`, 'success');
    }
  };

  // Selecting product to checkout - opens quick buy checkout modal
  const handleSelectProductToCheckout = (product: Product, targetDestination: string = '') => {
    if (!currentUser) {
      addToast(
        'Wajib Daftar Akun Terlebih Dahulu',
        'Semua pembeli wajib mendaftar akun untuk melakukan pembelian dan mengakses brankas saldo Anda.',
        'warning'
      );
      handleNavigate('akun');
      return;
    }
    setCheckoutProduct(product);
    setCheckoutTarget(targetDestination);
  };

  // Handling Order Created & opening QRIS Payment Modal
  const handleOrderCreated = (order: Order, snapToken: string) => {
    setOrders(storage.getOrders());
    setActiveSnapOrder(order);
    setActiveSnapToken(snapToken);
  };

  // Simulating payment result from Snap Simulator Modal
  const handleSimulatePaymentResult = async (
    status: 'PAID' | 'FAILED' | 'EXPIRED',
    method: string,
    withFulfillmentError: boolean = false
  ) => {
    if (!activeSnapOrder) return;
    try {
      const updated = await apiAdapter.processPaymentWebhook(
        activeSnapOrder.id,
        status,
        method,
        withFulfillmentError
      );

      setOrders(storage.getOrders());
      setActiveSnapOrder(null);
      setActiveSnapToken(null);

      if (status === 'PAID') {
        setActiveInvoiceOrder(updated);
        addToast('Pembayaran Berhasil Terverifikasi!', `Pesanan ${updated.invoiceNumber} sedang disiapkan.`, 'success');
      } else if (status === 'EXPIRED') {
        addToast('Batas Waktu Habis', `Pesanan ${updated.invoiceNumber} telah kedaluwarsa.`, 'warning');
      } else {
        addToast('Pembayaran Gagal', `Simulasi pembayaran ${updated.invoiceNumber} dibatalkan atau ditolak.`, 'error');
      }
    } catch (err: any) {
      addToast('Kesalahan Sistem', err.message || 'Gagal memproses status pembayaran', 'error');
    }
  };

  // If user is inside Admin view
  if (activeTab === 'admin') {
    // 1. If not authenticated, show the authentic Javanese "Sugeng Rawuh Admin" Login Page
    if (!adminSession || !adminSession.isAuthenticated) {
      return (
        <div className="min-h-screen bg-[#241306] flex flex-col font-sans relative">
          <TopProgressBar />
          {authLoader && <AuthCenterLoader type={authLoader.type} message={authLoader.message} />}
          <div className="animate-fadeInUp flex-1 flex flex-col">
            <AdminLoginPage
              onLoginSuccess={(session) => {
                setAuthLoader({ type: 'LOGIN_ADMIN' });
                setTimeout(() => {
                  setAdminSession(session);
                  loadData();
                  setAuthLoader(null);
                }, 600);
              }}
              onBackToStore={() => handleNavigate('home')}
              onShowToast={addToast}
            />
          </div>
          <ToastContainer toasts={toasts} onDismiss={removeToast} />
        </div>
      );
    }

    // 2. If authenticated, show the full Admin Dashboard
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col font-sans relative">
        <TopProgressBar />
        {authLoader && <AuthCenterLoader type={authLoader.type} message={authLoader.message} />}
        <div className="animate-fadeIn flex-1 flex flex-col">
          <AdminDashboard
            products={products}
            orders={orders}
            adminSession={adminSession}
            onRefreshData={loadData}
            onExitAdmin={() => handleNavigate('home')}
            onLogoutAdmin={() => {
              setAuthLoader({ type: 'LOGOUT_ADMIN' });
              setTimeout(() => {
                storage.saveAdminSession(null);
                setAdminSession(null);
                setAuthLoader(null);
                addToast('Sampun Medal', 'Sesi administrator berhasil diakhiri dengan aman.', 'info');
              }, 500);
            }}
            onShowToast={addToast}
          />
        </div>
        <ToastContainer toasts={toasts} onDismiss={removeToast} />
      </div>
    );
  }

  const { isDark } = useTheme();

  return (
    <div className={`min-h-screen ${activeTab === 'home' ? (isDark ? 'bg-[#101211] text-[#F5F7F2]' : 'bg-[#F8FAFC] text-[#0F172A]') : 'bg-[#181411] text-[#FAF4EB]'} flex flex-col font-sans antialiased selection:bg-[#FACC15] selection:text-[#0F172A] pb-24 lg:pb-0 relative transition-colors duration-300`}>
      <TopProgressBar />
      {authLoader && <AuthCenterLoader type={authLoader.type} message={authLoader.message} />}

      {/* SYSTEM MAINTENANCE BANNER (WHEN STOPPED) */}
      {settings.systemStatus === 'STOPPED' && (
        <div className="bg-gradient-to-r from-amber-600 via-rose-600 to-amber-700 text-white px-4 py-2.5 shadow-lg border-b border-rose-500/40 sticky top-0 z-50 flex items-center justify-between gap-3 text-xs sm:text-sm font-semibold">
          <div className="flex items-center gap-2.5 max-w-[1380px] mx-auto w-full">
            <span className="p-1 rounded-lg bg-black/20 shrink-0">
              <AlertTriangle size={16} className="text-amber-200 animate-pulse" />
            </span>
            <div className="flex-1 min-w-0">
              <span className="font-extrabold uppercase tracking-wide mr-2 bg-black/30 px-2 py-0.5 rounded text-[11px] inline-block">
                Sistem Dijeda (Maintenance)
              </span>
              <span className="text-white/95">
                {settings.systemMaintenanceMessage || 'Sistem transaksi sedang dijeda sementara oleh Administrator untuk pemeliharaan rutin. Silakan kembali beberapa saat lagi.'}
              </span>
            </div>
            {adminSession?.isAuthenticated && (
              <button
                type="button"
                onClick={() => handleNavigate('admin')}
                className="px-2.5 py-1 rounded-lg bg-black/40 hover:bg-black/60 text-amber-200 text-xs font-bold shrink-0 transition-colors cursor-pointer"
              >
                Atur di Admin →
              </button>
            )}
          </div>
        </div>
      )}

      {/* 1. MAIN NAVBAR */}
      <Navbar
        currentTab={activeTab}
        onNavigate={handleNavigate}
        currentUser={currentUser}
        onOpenAuth={() => handleNavigate('akun')}
        onOpenAdmin={() => handleNavigate('admin')}
        logoUrl={settings.logoUrl}
        siteName={settings.siteName}
      />

      {/* 3. MAIN CONTENT ROUTING */}
      <main className="flex-1">
        <div key={activeTab} className="animate-fadeInUp">
          {activeTab === 'home' && (
            <HomePage
              products={products}
              banners={banners}
              currentUser={currentUser}
              onNavigate={handleNavigate}
              onSelectProductToCheckout={handleSelectProductToCheckout}
              onOrderCreated={handleOrderCreated}
              onShowToast={addToast}
              isAdmin={!!adminSession?.isAuthenticated}
            />
          )}

          {activeTab === 'pulsa' && (
            settings.categoryStatus?.pulsa === false ? (
              <CategoryMaintenanceNotice
                categoryName="Pulsa Reguler & Transfer"
                onBack={() => handleNavigate('home')}
                onRefresh={loadData}
              />
            ) : (
              <PulsaPage
                products={products}
                initialPhone={checkoutTarget}
                onSelectProductToCheckout={handleSelectProductToCheckout}
              />
            )
          )}

          {activeTab === 'kuota' && (
            settings.categoryStatus?.kuota === false ? (
              <CategoryMaintenanceNotice
                categoryName="Kuota Data Internet"
                onBack={() => handleNavigate('home')}
                onRefresh={loadData}
              />
            ) : (
              <KuotaPage
                products={products}
                initialPhone={checkoutTarget}
                onSelectProductToCheckout={handleSelectProductToCheckout}
              />
            )
          )}

          {activeTab === 'wifi' && (
            settings.categoryStatus?.wifi === false ? (
              <CategoryMaintenanceNotice
                categoryName="Voucher WiFi Hotspot"
                onBack={() => handleNavigate('home')}
                onRefresh={loadData}
              />
            ) : (
              <WifiVoucherPage
                products={products}
                onSelectProductToCheckout={handleSelectProductToCheckout}
              />
            )
          )}

          {activeTab === 'premium' && (
            settings.categoryStatus?.premium === false ? (
              <CategoryMaintenanceNotice
                categoryName="Akun Aplikasi Premium"
                onBack={() => handleNavigate('home')}
                onRefresh={loadData}
              />
            ) : (
              <PremiumPage
                products={products}
                banners={banners}
                onSelectProductToCheckout={handleSelectProductToCheckout}
                onNavigate={handleNavigate}
                isAdmin={!!adminSession?.isAuthenticated}
              />
            )
          )}

          {activeTab === 'checkout' && checkoutProduct && (
            <CheckoutPage
              product={checkoutProduct}
              targetDestination={checkoutTarget}
              onBack={() => handleNavigate('home')}
              onOrderCreated={handleOrderCreated}
              onShowToast={addToast}
            />
          )}

          {activeTab === 'transaksi' && (
            <TransaksiPage
              orders={orders}
              onOpenInvoice={(order) => setActiveInvoiceOrder(order)}
              onOpenPaymentSession={(order) => {
                setActiveSnapOrder(order);
                setActiveSnapToken('SNAP-' + order.id.replace('ord-', '').toUpperCase());
              }}
              onCopyText={handleCopyText}
            />
          )}

          {activeTab === 'akun' && (
            <AkunPage
              currentUser={currentUser}
              orders={orders}
              initialAuthRole={akunAuthRole}
              onUserChange={(usr) => {
                const wasLoggedIn = !!currentUser;
                const isLoggingOut = !usr && wasLoggedIn;
                const isLoggingIn = !!usr && !wasLoggedIn;

                if (isLoggingIn) {
                  setAuthLoader({ type: 'LOGIN_MEMBER' });
                  setTimeout(() => {
                    setCurrentUser(usr);
                    setAuthLoader(null);
                  }, 550);
                } else if (isLoggingOut) {
                  setAuthLoader({ type: 'LOGOUT_MEMBER' });
                  setTimeout(() => {
                    setCurrentUser(null);
                    setAuthLoader(null);
                  }, 500);
                } else {
                  setCurrentUser(usr);
                }
              }}
              onOpenInvoice={(order) => setActiveInvoiceOrder(order)}
              onCopyText={handleCopyText}
              onShowToast={addToast}
            />
          )}

          {activeTab === 'bantuan' && (
            <BantuanPage />
          )}
        </div>
      </main>

      {/* 4. FOOTER */}
      <Footer
        onNavigate={handleNavigate}
      />

      {/* 5. MOBILE BOTTOM NAVIGATION */}
      <MobileBottomNav
        currentTab={activeTab}
        onNavigate={handleNavigate}
      />

      {/* 6. MODALS */}
      {checkoutProduct && activeTab !== 'checkout' && (
        <QuickBuyModal
          product={checkoutProduct}
          initialDestination={checkoutTarget}
          isOpen={Boolean(checkoutProduct && activeTab !== 'checkout')}
          onClose={() => {
            setCheckoutProduct(null);
          }}
          onOrderCreated={handleOrderCreated}
          onOpenFullCheckout={(prod, dest) => {
            setCheckoutProduct(prod);
            setCheckoutTarget(dest);
            handleNavigate('checkout');
          }}
          onShowToast={addToast}
        />
      )}

      {activeSnapOrder && activeSnapToken && (
        <SnapSimulatorModal
          order={activeSnapOrder}
          snapToken={activeSnapToken}
          isOpen={Boolean(activeSnapOrder && activeSnapToken)}
          onClose={() => {
            setActiveSnapOrder(null);
            setActiveSnapToken(null);
            setOrders(storage.getOrders());
          }}
          onSimulateResult={handleSimulatePaymentResult}
          onCopyText={handleCopyText}
        />
      )}

      {activeInvoiceOrder && (
        <InvoiceModal
          order={activeInvoiceOrder}
          isOpen={Boolean(activeInvoiceOrder)}
          onClose={() => {
            setActiveInvoiceOrder(null);
            setOrders(storage.getOrders());
          }}
          onCopyText={handleCopyText}
        />
      )}

      {/* 5b. POPUP CS 24 JAM (ROBOT PROGRAMMER) */}
      <FloatingCsBot
        settings={settings}
        onNavigate={handleNavigate}
        onShowToast={addToast}
        isDark={isDark}
      />

      {/* 7. TOAST NOTIFICATIONS */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}

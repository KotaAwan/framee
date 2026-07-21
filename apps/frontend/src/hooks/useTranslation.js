import { useLanguageStore } from '@/store/language.store';

// A temporary fallback dictionary for the Login page. 
// In production, these should be fetched from GET /api/v1/translations/:lang
const localDict = {
  en: {
    'login.title': 'Sign in to your account',
    'login.email': 'Email Address',
    'login.password': 'Password',
    'login.forgot': 'Forgot password?',
    'login.remember': 'Remember me',
    'login.signin': 'Sign In',
    'login.google': 'Sign in with Google',
    'login.no_account': "Don't have an account?",
    'login.contact': 'Contact your administrator',
    'login.or': 'Or continue with',
    'profile.title': 'User Profile',
    'system': 'System',
    'profile': 'Profile',
    'user': 'User',
    'profile.full_name': 'Full Name',
    'profile.email': 'Email Address',
    'save': 'Save',
    'password.title': 'Change Password',
    'password.current': 'Current Password',
    'password.new': 'New Password',
    'password.confirm': 'Confirm New Password',
    'password.mismatch': 'New password and confirm password do not match.',
    'password.success': 'Password changed successfully!',
    'password.error': 'Failed to change password. Please check your current password.',
    'pin.title': 'Change PIN',
    'pin.current': 'Current PIN',
    'pin.new': 'New PIN',
    'pin.confirm': 'Confirm New PIN',
    'pin.mismatch': 'New PIN and confirm PIN do not match.',
    'pin.length': 'PIN must be between 4 and 6 characters.',
    'pin.success': 'PIN changed successfully!',
    'pin.error': 'Failed to change PIN. Please check your current PIN.'
  },
  id: {
    'login.title': 'Masuk ke akun Anda',
    'login.email': 'Alamat Email',
    'login.password': 'Kata Sandi',
    'login.forgot': 'Lupa kata sandi?',
    'login.remember': 'Ingat saya',
    'login.signin': 'Masuk',
    'login.google': 'Masuk dengan Google',
    'login.no_account': "Belum punya akun?",
    'login.contact': 'Hubungi administrator Anda',
    'login.or': 'Atau lanjutkan dengan',
    'profile.title': 'Profil Pengguna',
    'system': 'Sistem',
    'profile': 'Profil',
    'user': 'Pengguna',
    'profile.full_name': 'Nama Lengkap',
    'profile.email': 'Alamat Email',
    'save': 'Simpan',
    'password.title': 'Ubah Kata Sandi',
    'password.current': 'Kata Sandi Saat Ini',
    'password.new': 'Kata Sandi Baru',
    'password.confirm': 'Konfirmasi Kata Sandi Baru',
    'password.mismatch': 'Kata sandi baru dan konfirmasi tidak cocok.',
    'password.success': 'Kata sandi berhasil diubah!',
    'password.error': 'Gagal mengubah kata sandi. Periksa kata sandi saat ini.',
    'pin.title': 'Ubah PIN',
    'pin.current': 'PIN Saat Ini',
    'pin.new': 'PIN Baru',
    'pin.confirm': 'Konfirmasi PIN Baru',
    'pin.mismatch': 'PIN baru dan konfirmasi tidak cocok.',
    'pin.length': 'PIN harus antara 4 sampai 6 karakter.',
    'pin.success': 'PIN berhasil diubah!',
    'pin.error': 'Gagal mengubah PIN. Periksa PIN saat ini.'
  }
};

export function useTranslation() {
  const language = useLanguageStore((state) => state.language);
  const translations = useLanguageStore((state) => state.translations); // dynamic from backend

  const t = (key, fallback) => {
    // Priority:
    // 1. Dynamic translations from API (stored in Zustand)
    if (translations[key]) return translations[key];
    
    // 2. Local fallback dictionary (based on selected language)
    if (localDict[language] && localDict[language][key]) return localDict[language][key];
    
    // 3. English fallback (if translation is missing in selected language)
    if (localDict['en'] && localDict['en'][key]) return localDict['en'][key];
    
    // 4. Return fallback argument if provided, otherwise the raw key
    return fallback || key;
  };

  return { t, language };
}

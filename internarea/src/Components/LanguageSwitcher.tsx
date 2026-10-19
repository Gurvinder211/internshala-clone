import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/router";
import { useDispatch, useSelector } from "react-redux";
import { Globe, ShieldAlert, Check, Loader2, X, RefreshCw } from "lucide-react";
import { toast } from "react-toastify";
import { setLanguage, selectuser } from "@/Feature/Userslice";
import api from "@/lib/api";

const LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "hi", label: "हिन्दी", flag: "🇮🇳" },
  { code: "pt", label: "Português", flag: "🇵🇹" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const router = useRouter();
  const dispatch = useDispatch();
  const user = useSelector(selectuser);

  const [isOpen, setIsOpen] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const language = user?.language || localStorage.getItem("preferredLanguage") || router.locale || "en";
    if (i18n.resolvedLanguage !== language) void i18n.changeLanguage(language);
    localStorage.setItem("preferredLanguage", language);
  }, [i18n, router.locale, user?.language]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const applyLocally = (lang: string) => {
    localStorage.setItem("preferredLanguage", lang);
    void i18n.changeLanguage(lang);
    dispatch(setLanguage(lang));
    toast.success(`Language switched to ${LANGUAGES.find((l) => l.code === lang)?.label || lang}`);
  };

  const handleSelect = async (lang: string) => {
    setIsOpen(false);
    setError("");

    if (lang === "fr") {
      if (!user) {
        toast.info("Please sign in to verify your email before switching to French.");
        return;
      }

      setSubmitting(true);
      try {
        const { data } = await api.post("/language/french/request-otp");
        setCooldown(data.cooldownSeconds || 60);
        setOtpCode("");
        setOtpOpen(true);
      } catch (err: any) {
        toast.error(err?.response?.data?.error || "Could not send verification code for French.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!user) {
      applyLocally(lang);
      return;
    }

    try {
      await api.patch("/language", { language: lang });
      applyLocally(lang);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Could not switch language. Please check your connection.");
    }
  };

  const handleVerifyFrench = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!otpCode || otpCode.length < 6) {
      setError("Please enter the 6-digit verification code.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/language/french/verify-otp", { code: otpCode.trim() });
      applyLocally("fr");
      setOtpOpen(false);
      setOtpCode("");
    } catch (err: any) {
      setError(err?.response?.data?.error || "Invalid or expired verification code.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError("");
    try {
      const { data } = await api.post("/language/french/request-otp");
      setCooldown(data.cooldownSeconds || 60);
      toast.info("New verification code sent to your email.");
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to resend code.");
    } finally {
      setResending(false);
    }
  };

  const currentLangCode = user?.language || i18n.resolvedLanguage || "en";
  const currentLang = LANGUAGES.find((l) => l.code === currentLangCode) || LANGUAGES[0];

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
        aria-label="Change language"
      >
        <Globe size={14} className="text-emerald-700" />
        <span className="mr-0.5">{currentLang.flag}</span>
        <span className="font-semibold text-gray-800">{currentLang.label}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-48 origin-top-right rounded-2xl border border-gray-100 bg-white p-1.5 shadow-xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-2.5 py-1.5 border-b border-gray-100 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Select Language
          </div>
          <div className="py-1">
            {LANGUAGES.map((lang) => {
              const active = lang.code === currentLangCode;
              return (
                <button
                  key={lang.code}
                  onClick={() => handleSelect(lang.code)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs transition ${
                    active ? "bg-emerald-50 font-bold text-emerald-900" : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-base">{lang.flag}</span>
                    <span>{lang.label}</span>
                  </span>
                  {active && <Check size={14} className="text-emerald-700" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* French Security OTP Modal */}
      {otpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8">
            <button
              onClick={() => {
                setOtpOpen(false);
                setError("");
                setOtpCode("");
              }}
              className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close"
            >
              <X size={18} />
            </button>

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 mb-4">
              <ShieldAlert size={24} />
            </div>

            <h3 className="text-xl font-bold text-slate-900">Security Verification</h3>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              Switching platform language to <b>French (Français)</b> requires One-Time Password verification for account security. An OTP was sent to <b>{user?.email}</b>.
            </p>

            <form onSubmit={handleVerifyFrench} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  6-Digit Verification Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  inputMode="numeric"
                  autoFocus
                  placeholder="000000"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  className="h-12 w-full text-center text-xl font-mono tracking-[0.3em] rounded-xl border border-slate-300 bg-slate-50 outline-none focus:border-emerald-700 focus:bg-white focus:ring-4 focus:ring-emerald-700/10"
                />
              </div>

              {error && (
                <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700" role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting || otpCode.length < 6}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-800 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:opacity-50"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : "Verify & Apply Language"}
              </button>

              <div className="flex items-center justify-between pt-2 text-xs text-slate-500">
                <button
                  type="button"
                  disabled={cooldown > 0 || resending}
                  onClick={handleResendOtp}
                  className="inline-flex items-center gap-1 font-semibold text-emerald-800 hover:underline disabled:text-slate-400"
                >
                  <RefreshCw size={13} className={resending ? "animate-spin" : ""} />
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOtpOpen(false);
                    setError("");
                  }}
                  className="hover:underline text-slate-600"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
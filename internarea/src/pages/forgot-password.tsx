import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import axios from "axios";
import { Loader2, Mail, Smartphone } from "lucide-react";
import { useTranslation } from "next-i18next/pages";

type Method = "email" | "sms";
const API = "https://internshala-backend-69sb.onrender.com/api/password-reset";
const INPUT_CLASS = "h-12 w-full border border-[#d9e0d9] bg-[#fbfcfa] px-4 text-sm text-[#1c2b25] outline-none transition placeholder:text-[#9aa79e] focus:border-[#557d5e] focus:ring-4 focus:ring-[#557d5e]/10";

export default function ForgotPassword() {
  const { t } = useTranslation("common");
  const [method, setMethod] = useState<Method>("email");
  const [step, setStep] = useState<"request" | "verify" | "done">("request");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [devNote, setDevNote] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const showError = (err: unknown, fallback: string) => {
    setError(axios.isAxiosError(err) ? err.response?.data?.error || fallback : fallback);
  };

  const request = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { data } = await axios.post(`${API}/request`, { method, identifier: identifier.trim() });
      setMessage(data.message);
      setDevNote(data.deliveryMode === "console");
      setStep("verify");
    } catch (err) {
      showError(err, t("auth.requestFailed"));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { data } = await axios.post(`${API}/verify`, { method, identifier: identifier.trim(), code: code.trim() });
      setMessage(data.message);
      setDevNote(data.deliveryMode === "console");
      setStep("done");
      window.setTimeout(() => void router.push("/login"), 4000);
    } catch (err) {
      showError(err, t("language.invalidCode"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#f5f7f2] px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-md border border-[#dce4d6] bg-white p-7 shadow-[0_24px_80px_rgba(35,55,35,0.12)] sm:p-9">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6a7f72]">{t("auth.accountRecovery")}</p>
        <h1 className="mt-3 text-2xl font-semibold text-[#173b35]">{t("auth.resetPassword")}</h1>
        <p className="mt-2 text-sm leading-6 text-[#6a756f]">
          {t("auth.recoveryInstructions")}
        </p>

        {step === "request" && (
          <form onSubmit={request} className="mt-6 space-y-5">
            <div className="grid grid-cols-2 gap-1 border border-[#e1e8df] bg-[#f3f6f1] p-1">
              {([["email", t("auth.email"), Mail], ["sms", t("auth.mobile"), Smartphone]] as const).map(([key, label, Icon]) => (
                <button key={key} type="button" onClick={() => { setMethod(key); setIdentifier(""); setError(""); }}
                  aria-pressed={method === key}
                  className={`flex h-10 items-center justify-center gap-2 text-sm font-semibold transition ${method === key ? "bg-white text-[#173b35] shadow-sm" : "text-[#6a756f]"}`}>
                  <Icon size={16} /> {label}
                </button>
              ))}
            </div>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#304139]">{method === "email" ? t("auth.registeredEmail") : t("auth.mobileNumber")}</span>
              <input className={INPUT_CLASS} required autoFocus
                type={method === "email" ? "email" : "tel"}
                autoComplete={method === "email" ? "email" : "tel"}
                placeholder={method === "email" ? "name@example.com" : "+91 98765 43210"}
                value={identifier} onChange={(event) => setIdentifier(event.target.value)} />
            </label>
            <Submit busy={busy} label={t("auth.sendResetCode")} />
          </form>
        )}

        {step === "verify" && (
          <form onSubmit={verify} className="mt-6 space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#304139]">{t("auth.verificationCode")}</span>
              <input className={`${INPUT_CLASS} text-center text-xl tracking-[0.3em]`} required autoFocus
                inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000"
                value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} />
            </label>
            <Submit busy={busy} label={t("auth.verifyAndReset")} disabled={code.length < 6} />
            <button type="button" onClick={() => { setStep("request"); setCode(""); setError(""); setMessage(""); }}
              className="w-full text-sm text-[#557d5e] hover:text-[#173b35]">
              {t("auth.useDifferent", { method: method === "email" ? t("auth.emailAddress") : t("auth.mobileNumber") })}
            </button>
          </form>
        )}

        {message && <p className="mt-5 border border-[#cfe3d2] bg-[#f1f8f2] px-4 py-3 text-sm text-[#27553a]">{message}</p>}
        {devNote && <p className="mt-3 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{t("auth.developmentDeliveryNote")}</p>}
        {error && <p role="alert" className="mt-5 border border-[#f2caca] bg-[#fff4f3] px-4 py-3 text-sm text-[#b13b37]">{error}</p>}
        {step === "done" && <p className="mt-3 text-xs text-[#6a756f]">{t("auth.returningToSignIn")}</p>}
        <p className="mt-6 text-center text-sm text-[#6a756f]">
          <Link href="/login" className="font-semibold text-[#557d5e] hover:text-[#173b35]">{t("auth.backToSignIn")}</Link>
        </p>
      </div>
    </main>
  );
}

function Submit({ busy, label, disabled }: { busy: boolean; label: string; disabled?: boolean }) {
  return (
    <button type="submit" disabled={busy || disabled}
      className="flex h-12 w-full items-center justify-center bg-[#173b35] text-sm font-semibold text-white transition hover:bg-[#28584e] disabled:opacity-60">
      {busy ? <Loader2 size={18} className="animate-spin" /> : label}
    </button>
  );
}

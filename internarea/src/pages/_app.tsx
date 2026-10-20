import Footer from "@/Components/Fotter";
import LoginOtpModal from "@/Components/LoginOtpModal";
import Navbar from "@/Components/Navbar";
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { store } from "../store/store";
import { Provider, useDispatch } from "react-redux";
import { appWithTranslation } from "next-i18next/pages";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { auth } from "@/firebase/firebase";
import { login, logout } from "@/Feature/Userslice";
import axios from "axios";
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import enCommon from "../../public/locales/en/common.json";
import esCommon from "../../public/locales/es/common.json";
import frCommon from "../../public/locales/fr/common.json";
import hiCommon from "../../public/locales/hi/common.json";
import ptCommon from "../../public/locales/pt/common.json";
import zhCommon from "../../public/locales/zh/common.json";
import { startSession, installSessionInterceptors, clearLocalSession } from "@/lib/session";
import { signOut, getRedirectResult } from "firebase/auth";

const i18nConfig = {
  i18n: {
    defaultLocale: "en",
    locales: ["en", "es", "fr", "hi", "pt", "zh"],
    localeDetection: false as false,
  },
  resources: {
    en: { common: enCommon },
    es: { common: esCommon },
    fr: { common: frCommon },
    hi: { common: hiCommon },
    pt: { common: ptCommon },
    zh: { common: zhCommon },
  },
};

function AuthListener() {
  const dispatch = useDispatch();
  const router = useRouter();
  const [challenge, setChallenge] = useState<{ maskedEmail: string; deliveryMode?: "email" | "console" } | null>(null);

  const abandonLogin = async (message?: string) => {
    sessionStorage.removeItem("redirectAfterLogin");
    clearLocalSession();
    await signOut(auth).catch(() => {});
    setChallenge(null);
    dispatch(logout());
    if (message) toast.error(message);
  };

  useEffect(() => {
    installSessionInterceptors();
    const onLost = (event: Event) => {
      const code = (event as CustomEvent).detail?.code;
      dispatch(logout());
      toast.info(
        code === "SESSION_REVOKED"
          ? "You were signed out because this session was ended from another device."
          : "Your session expired. Please sign in again."
      );
    };
    window.addEventListener("session-lost", onLost);
    return () => window.removeEventListener("session-lost", onLost);
  }, [dispatch]);

  useEffect(() => {
    const restore = async (hasFirebaseUser: boolean) => {
      if (!hasFirebaseUser && !localStorage.getItem("authToken")) {
        dispatch(logout());
        return;
      }
      try {
        const result = await startSession();
        if (result.status === "active") {
          dispatch(login(result.user));
          if (sessionStorage.getItem("redirectAfterLogin") === "true") {
            sessionStorage.removeItem("redirectAfterLogin");
            void router.replace("/internship");
          }
        }
        else if (result.status === "otp_required") setChallenge({ maskedEmail: result.maskedEmail, deliveryMode: result.deliveryMode });
        else await abandonLogin(result.message);
      } catch (err) {
        sessionStorage.removeItem("redirectAfterLogin");
        if (axios.isAxiosError(err) && err.response?.status === 401) {
          if (hasFirebaseUser) {
            clearLocalSession();
            await signOut(auth).catch(() => {});
            toast.error("Google sign-in succeeded, but the backend rejected the Firebase token. Check that backend/serviceAccountKey.json belongs to the same Firebase project as the frontend.");
          } else {
            localStorage.removeItem("authToken");
          }
        } else if (axios.isAxiosError(err) && !err.response && hasFirebaseUser) {
          toast.error("Google sign-in succeeded, but the backend could not be reached. Check that the backend is available at https://internshala-backend-69sb.onrender.com.");
        } else {
          toast.error(
            (axios.isAxiosError(err) && err.response?.data?.error) || "Could not sign you in. Please try again."
          );
        }
        dispatch(logout());
      }
    };

    // Process the Google redirect result BEFORE setting up onAuthStateChanged.
    // Without this, auth.currentUser is null when startSession() fires its
    // credentialHeader() call, so the backend receives no Firebase ID token.
    getRedirectResult(auth).catch((err) => {
      console.error("getRedirectResult error:", err);
      const code = err?.code ?? "";
      if (code !== "auth/popup-closed-by-user") {
        toast.error(
          code === "auth/unauthorized-domain"
            ? "Add this site to Firebase Authentication's authorized domains."
            : `Google sign-in failed after redirect (${code}). Check your Firebase configuration.`
        );
      }
      sessionStorage.removeItem("redirectAfterLogin");
    });

    return auth.onAuthStateChanged((u) => void restore(!!u));
  }, [dispatch, router]);

  return challenge ? (
    <LoginOtpModal
      maskedEmail={challenge.maskedEmail}
      deliveryMode={challenge.deliveryMode}
      onVerified={(user) => {
        dispatch(login(user));
        setChallenge(null);
        if (sessionStorage.getItem("redirectAfterLogin") === "true") {
          sessionStorage.removeItem("redirectAfterLogin");
          void router.replace("/internship");
        }
      }}
      onCancel={(message) => void abandonLogin(message)}
    />
  ) : null;
}

function App({ Component, pageProps }: AppProps) {
  return (
    <Provider store={store}>
      <AuthListener />
      <div className="bg-white">
        <ToastContainer/>
        <Navbar />
        <Component {...pageProps} />
        <Footer />
      </div>
    </Provider>
  );
}
export default appWithTranslation(App, i18nConfig);
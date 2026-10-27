import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useTranslation } from "next-i18next/pages";

const when = (value: string) => new Date(value).toLocaleString("en-IN", {
  timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short",
});

export default function ResumeHistory() {
  const { t } = useTranslation("common");
  const [payments, setPayments] = useState<any[]>([]);
  const [downloads, setDownloads] = useState<any[]>([]);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    api.get("/resume/history")
      .then(({ data }) => { setPayments(data.payments); setDownloads(data.downloads); })
      .catch((error) => {
        if (error?.response?.data?.code === "PREMIUM_REQUIRED") setLocked(true);
      });
  }, []);

  if (locked) return null;

  return (
    <section className="border rounded-lg p-4">
      <h2 className="font-semibold text-gray-900">{t("resume.paymentsAndDownloads")}</h2>
      {payments.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">{t("resume.noGeneratedResumes")}</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="pb-2 font-normal">{t("resume.invoice")}</th><th className="pb-2 font-normal">{t("resume.resume")}</th>
                <th className="pb-2 font-normal">{t("resume.amount")}</th><th className="pb-2 font-normal">{t("resume.paidOn")}</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment._id} className="border-t">
                  <td className="py-2">{payment.invoiceNumber}</td>
                  <td className="py-2">{payment.resumeId?.title || "Untitled resume"}</td>
                  <td className="py-2">₹{payment.amount}</td>
                  <td className="py-2">{when(payment.paidAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {downloads.length > 0 && (
        <>
          <h3 className="mt-5 text-sm font-semibold text-gray-900">{t("resume.downloadHistory")}</h3>
          <ul className="mt-2 space-y-1 text-sm text-gray-700">
            {downloads.map((download) => (
              <li key={download._id}>
                {download.resumeId?.title || "Resume"} · {when(download.createdAt)} · {download.browser} on {download.os}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

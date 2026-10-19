import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";
import api from "@/lib/api";
import { login, selectuser } from "@/Feature/Userslice";

export default function PhoneNumber() {
  const user = useSelector(selectuser);
  const dispatch = useDispatch();
  const [value, setValue] = useState(user?.phone || "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (busy || !value.trim()) return;
    setBusy(true);
    try {
      const { data } = await api.patch("/user/phone", { phone: value });
      dispatch(login({ ...user, phone: data.phone }));
      setValue(data.phone);
      toast.success("Mobile number saved");
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Could not save mobile number");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="border rounded-lg p-4">
      <h2 className="font-semibold text-gray-900">Mobile number</h2>
      <p className="mt-1 text-xs text-gray-500">Used to reset your password by SMS.</p>
      <div className="mt-3 flex gap-2">
        <input value={value} onChange={(event) => setValue(event.target.value)} placeholder="+91 98765 43210"
          type="tel" autoComplete="tel" className="h-10 flex-1 rounded-lg border border-gray-300 px-3 text-sm" />
        <button onClick={() => void save()} disabled={busy || !value.trim()}
          className="h-10 rounded-lg bg-[#173b35] px-4 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? "Saving..." : "Save"}
        </button>
      </div>
    </section>
  );
}

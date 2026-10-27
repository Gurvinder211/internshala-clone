import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import api from "@/lib/api";
import { useTranslation } from "next-i18next/pages";

type Tab = "friends" | "requests" | "find";

export default function Friends() {
  const { t } = useTranslation("common");
  const [tab, setTab] = useState<Tab>("friends");
  const [friends, setFriends] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [posting, setPosting] = useState<any>(null);
  const [incoming, setIncoming] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);

  const loadFriends = async () => {
    const { data } = await api.get("/social/friends");
    setFriends(data.friends);
    setCount(data.friendCount);
    setPosting(data.posting);
  };
  const loadRequests = async () => {
    const { data } = await api.get("/social/friend-requests");
    setIncoming(data.incoming);
  };

  useEffect(() => { loadFriends(); loadRequests(); }, []);

  // Debounced search so we don't fire a request on every keystroke
  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await api.get("/social/users/search", { params: { q: query } });
      setResults(data.users);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const act = async (fn: () => Promise<any>, okMsg: string) => {
    try {
      await fn();
      toast.success(okMsg);
      await Promise.all([loadFriends(), loadRequests()]);
      if (query.trim().length >= 2) {
        const { data } = await api.get("/social/users/search", { params: { q: query } });
        setResults(data.users);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || t("friends.actionFailed"));
    }
  };

  const addFriend = (id: string) => act(() => api.post(`/social/friend-request/${id}`), t("friends.requestSent"));
  const accept = (id: string) => act(() => api.post(`/social/friend-request/${id}/accept`), t("friends.nowFriends"));
  const reject = (id: string) => act(() => api.post(`/social/friend-request/${id}/reject`), t("friends.requestDeclined"));
  const unfriend = (id: string) => {
    if (!confirm(t("friends.confirmRemove"))) return;
    act(() => api.delete(`/social/friends/${id}`), t("friends.friendRemoved"));
  };

  const limitText = posting
    ? posting.dailyLimit === null
      ? t("friends.noDailyLimit")
      : posting.dailyLimit === 0
        ? t("friends.addFriendToPost")
        : t("friends.dailyPosts", { posted: posting.postedToday, limit: posting.dailyLimit })
    : "";

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">{t("friends.friendCount", { count })}</h1>
        <p className="text-sm text-gray-600">{limitText}</p>
      </div>

      <div className="flex gap-4 border-b mb-4">
        {([["friends", t("friends.friends")], ["requests", incoming.length ? t("friends.requests", { count: incoming.length }) : t("friends.requestsLabel")], ["find", t("friends.findPeople")]] as [Tab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`pb-2 ${tab === key ? "border-b-2 border-blue-600 font-medium" : "text-gray-500"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "friends" && (
        friends.length === 0
          ? <p className="text-gray-500">{t("friends.noFriends")}</p>
          : friends.map((f) => (
            <div key={f._id} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <img src={f.photo} className="w-9 h-9 rounded-full" alt="" />
                <div>
                  <p className="font-medium">{f.name}</p>
                  <p className="text-xs text-gray-500">@{f.username}</p>
                </div>
              </div>
              <button className="text-sm text-red-600" onClick={() => unfriend(f._id)}>{t("common.delete")}</button>
            </div>
          ))
      )}

      {tab === "requests" && (
        incoming.length === 0
          ? <p className="text-gray-500">{t("friends.noPendingRequests")}</p>
          : incoming.map((r) => (
            <div key={r._id} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <img src={r.fromUserId.photo} className="w-9 h-9 rounded-full" alt="" />
                <div>
                  <p className="font-medium">{r.fromUserId.name}</p>
                  <p className="text-xs text-gray-500">@{r.fromUserId.username}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={() => accept(r._id)}>{t("friends.accept")}</button>
                <button className="px-3 py-1 border rounded" onClick={() => reject(r._id)}>{t("friends.decline")}</button>
              </div>
            </div>
          ))
      )}

      {tab === "find" && (
        <div>
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder={t("friends.searchPlaceholder")}
            className="w-full border rounded px-3 py-2 mb-4"
          />
          {query.trim().length >= 2 && results.length === 0 && <p className="text-gray-500">{t("friends.noOneFound")}</p>}
          {results.map((u) => (
            <div key={u._id} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <img src={u.photo} className="w-9 h-9 rounded-full" alt="" />
                <div>
                  <p className="font-medium">{u.name}</p>
                  <p className="text-xs text-gray-500">@{u.username} · {u.friendCount} friends</p>
                </div>
              </div>
              {u.status === "none" && <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={() => addFriend(u._id)}>{t("friends.addFriend")}</button>}
              {u.status === "request_sent" && <span className="text-sm text-gray-500">{t("friends.requestSentStatus")}</span>}
              {u.status === "request_received" && <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={() => accept(u.requestId)}>{t("friends.accept")}</button>}
              {u.status === "friend" && <span className="text-sm text-green-700">{t("friends.friends")}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
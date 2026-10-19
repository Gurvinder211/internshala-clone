import { useEffect, useState, useRef } from "react";
import { Bell, Heart, MessageCircle, Share2, UserPlus, UserCheck, AtSign, CheckCheck } from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";

type NotificationItem = {
  _id: string;
  type: "like" | "comment" | "share" | "friend_request" | "friend_accept" | "mention" | "follow";
  fromUserId: { _id?: string; name?: string; photo?: string; username?: string };
  postId?: string;
  read: boolean;
  createdAt: string;
};

const TYPE_CONFIG = {
  like: { text: "liked your post", icon: Heart, tone: "text-rose-600 bg-rose-50" },
  comment: { text: "commented on your post", icon: MessageCircle, tone: "text-blue-600 bg-blue-50" },
  share: { text: "shared your post", icon: Share2, tone: "text-emerald-600 bg-emerald-50" },
  friend_request: { text: "sent you a friend request", icon: UserPlus, tone: "text-indigo-600 bg-indigo-50" },
  friend_accept: { text: "accepted your friend request", icon: UserCheck, tone: "text-emerald-600 bg-emerald-50" },
  mention: { text: "mentioned you in a post or comment", icon: AtSign, tone: "text-purple-600 bg-purple-50" },
  follow: { text: "started following you", icon: UserPlus, tone: "text-amber-600 bg-amber-50" },
};

function formatTime(dateStr: string) {
  const elapsed = Date.now() - new Date(dateStr).getTime();
  if (elapsed < 60_000) return "just now";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

export default function NotificationsDropdown() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const { data } = await api.get("/notification");
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // not signed in or session invalid
    }
  };

  useEffect(() => {
    void fetchNotifications();
    const interval = setInterval(fetchNotifications, 20_000); // refresh every 20s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAllRead = async () => {
    try {
      await api.post("/notification/read-all");
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      // silent
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          if (!open && unreadCount > 0) void markAllRead();
        }}
        className="relative grid h-10 w-10 place-items-center rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 focus:outline-none"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-white animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 sm:w-96 rounded-2xl border border-gray-100 bg-white shadow-2xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-100 overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 bg-gray-50/70">
            <h3 className="text-sm font-bold text-gray-900">Notifications</h3>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={markAllRead}
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:text-emerald-950"
              >
                <CheckCheck size={14} /> Mark all read
              </button>
            ) : (
              <span className="text-xs text-gray-400">All caught up</span>
            )}
          </div>

          <div className="max-h-96 divide-y divide-gray-100 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">
                <Bell size={24} className="mx-auto text-gray-300 mb-2" />
                No notifications yet.
              </div>
            ) : (
              notifications.map((n) => {
                const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.like;
                const Icon = cfg.icon;
                const author = n.fromUserId || {};
                const name = author.name || "A community member";
                const content = (
                  <div
                    key={n._id}
                    className={`flex items-start gap-3 px-4 py-3 text-xs transition hover:bg-gray-50 ${
                      !n.read ? "bg-emerald-50/40" : ""
                    }`}
                  >
                    <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${cfg.tone}`}>
                      <Icon size={15} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-gray-800">
                        <span className="font-semibold text-gray-950">{name}</span> {cfg.text}.
                      </p>
                      <span className="mt-1 block text-[11px] text-gray-400">{formatTime(n.createdAt)}</span>
                    </div>
                  </div>
                );

                if (n.postId) {
                  return (
                    <Link
                      key={n._id}
                      href={`/public-space#post-${n.postId}`}
                      onClick={() => setOpen(false)}
                      className="block"
                    >
                      {content}
                    </Link>
                  );
                }

                if (n.type === "friend_request" || n.type === "friend_accept") {
                  return (
                    <Link key={n._id} href="/friends" onClick={() => setOpen(false)} className="block">
                      {content}
                    </Link>
                  );
                }

                return <div key={n._id}>{content}</div>;
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

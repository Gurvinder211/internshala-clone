import { ChangeEvent, useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  Bookmark,
  BriefcaseBusiness,
  Check,
  Edit2,
  Flag,
  Globe2,
  Hash,
  ImagePlus,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Send,
  Share2,
  Trash2,
  UserCheck,
  UserPlus,
  UsersRound,
  Video,
  X,
  Eye,
} from "lucide-react";
import { toast } from "react-toastify";
import api from "@/lib/api";
import { useSelector } from "react-redux";
import { selectuser } from "@/Feature/Userslice";
import { useTranslation } from "next-i18next/pages";

type FeedPost = {
  _id: string;
  userId: any;
  content: string;
  mediaUrl?: string | null;
  mediaType?: "image" | "video" | "none";
  privacy?: "public" | "friends";
  likes: (string | { _id?: string })[];
  saves?: (string | { _id?: string })[];
  commentCount?: number;
  shareCount?: number;
  viewCount?: number;
  hashtags?: string[];
  createdAt: string;
};

type FeedComment = {
  _id: string;
  userId: any;
  content: string;
  createdAt?: string;
};

const API_ORIGIN = "https://internshala-backend-69sb.onrender.com";
const EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes configurable limit

const POPULAR_TAGS = ["internship", "career", "tech", "jobs", "resume", "design", "interview"];

function initials(name?: string) {
  return name?.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
}

function postDate(date?: string) {
  if (!date) return "Just now";
  const elapsed = Date.now() - new Date(date).getTime();
  if (elapsed < 60_000) return "Just now";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h`;
  return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function referenceId(value: string | { _id?: string }) {
  return typeof value === "string" ? value : value._id || "";
}

function Avatar({ name, photo, size = "md" }: { name?: string; photo?: string; size?: "sm" | "md" }) {
  const dimensions = size === "sm" ? "h-8 w-8 text-[10px]" : "h-10 w-10 text-xs";
  return photo ? (
    <img src={photo} alt="" className={`${dimensions} shrink-0 rounded-full object-cover`} />
  ) : (
    <span className={`${dimensions} grid shrink-0 place-items-center rounded-full bg-emerald-100 font-bold text-emerald-900`}>
      {initials(name)}
    </span>
  );
}

export default function PublicSpace() {
  const { t } = useTranslation("common");
  const user = useSelector(selectuser);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [privacy, setPrivacy] = useState<"public" | "friends">("public");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [posting, setPosting] = useState(false);
  const [feedError, setFeedError] = useState("");
  const [comments, setComments] = useState<Record<string, FeedComment[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [sendingComment, setSendingComment] = useState<string | null>(null);

  // Modals & Menu
  const [openMenuPostId, setOpenMenuPostId] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<FeedPost | null>(null);
  const [editContent, setEditContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [reportingPost, setReportingPost] = useState<FeedPost | null>(null);
  const [reportReason, setReportReason] = useState("Spam or misleading content");
  const [submittingReport, setSubmittingReport] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  const loadPosts = async (reset = false, tag = tagFilter) => {
    if (!reset && (loadingMore || (!hasMore && !loading))) return;
    if (reset) {
      setLoading(true);
      setPosts([]);
    } else {
      setLoadingMore(true);
    }
    setFeedError("");

    try {
      const params: Record<string, string> = {};
      if (!reset && cursor) params.cursor = cursor;
      if (tag) params.tag = tag;

      const { data } = await api.get("/feed", { params });
      setPosts((existing) => {
        if (reset) return data.posts;
        const knownIds = new Set(existing.map((post) => post._id));
        return [...existing, ...data.posts.filter((post: FeedPost) => !knownIds.has(post._id))];
      });
      setCursor(data.nextCursor);
      setHasMore(Boolean(data.nextCursor && data.posts.length));
    } catch (error: any) {
      const status = error?.response?.status;
      setFeedError(
        status === 401
          ? "Your session has expired. Sign in again to view and join the community feed."
          : error?.response?.data?.error || "We couldn't load the feed. Check your connection and try again."
      );
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    void loadPosts(true, tagFilter);
  }, [tagFilter]);

  // Click outside to close options menu
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuPostId(null);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const selectMedia = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] || null;
    if (selected && selected.size > 25 * 1024 * 1024) {
      toast.error("Choose a photo or video under 25 MB");
      event.target.value = "";
      return;
    }
    setFile(selected);
  };

  const submitPost = async () => {
    if (!content.trim() && !file) return;
    setPosting(true);
    const form = new FormData();
    form.append("content", content.trim());
    form.append("privacy", privacy);
    if (file) form.append("media", file);

    try {
      const { data } = await api.post("/post", form, { headers: { "Content-Type": "multipart/form-data" } });
      const post = {
        ...data.post,
        userId: data.post.userId?.name
          ? data.post.userId
          : {
              _id: user?._id,
              name: user?.name || user?.displayName,
              username: user?.username,
              photo: user?.photo || user?.photoURL,
            },
        likes: data.post.likes || [],
        saves: data.post.saves || [],
        viewCount: 0,
      };
      setPosts((existing) => [post, ...existing]);
      setContent("");
      setFile(null);
      toast.success("Your post is live!");
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Could not publish your post");
    } finally {
      setPosting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPost || !editContent.trim()) return;
    setSavingEdit(true);
    try {
      const { data } = await api.patch(`/post/${editingPost._id}`, { content: editContent.trim() });
      setPosts((current) => current.map((p) => (p._id === editingPost._id ? { ...p, content: data.post.content } : p)));
      toast.success("Post updated successfully");
      setEditingPost(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Could not edit post");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm("Are you sure you want to delete this post?")) return;
    try {
      await api.delete(`/post/${postId}`);
      setPosts((current) => current.filter((p) => p._id !== postId));
      toast.success("Post deleted");
      setOpenMenuPostId(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Could not delete post");
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingPost) return;
    setSubmittingReport(true);
    try {
      await api.post(`/post/${reportingPost._id}/report`, { reason: reportReason });
      toast.success("Thank you for reporting. Our moderation team will review this content.");
      setReportingPost(null);
      setOpenMenuPostId(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Could not report post");
    } finally {
      setSubmittingReport(false);
    }
  };

  const handleSendFriendRequest = async (targetId: string) => {
    try {
      await api.post(`/social/friend-request/${targetId}`);
      toast.success("Friend request sent!");
      setOpenMenuPostId(null);
    } catch (err: any) {
      toast.info(err?.response?.data?.error || "Friend request update");
    }
  };

  const handleFollow = async (targetId: string) => {
    try {
      await api.post(`/social/follow/${targetId}`);
      toast.success("You are now following this user");
      setOpenMenuPostId(null);
    } catch (err: any) {
      toast.info(err?.response?.data?.error || "Follow status update");
    }
  };

  const toggleLike = async (post: FeedPost) => {
    try {
      const { data } = await api.post(`/post/${post._id}/like`);
      setPosts((current) =>
        current.map((item) =>
          item._id === post._id
            ? {
                ...item,
                likes: data.liked ? [...(item.likes || []), user?._id] : item.likes.filter((id) => referenceId(id) !== String(user?._id)),
              }
            : item
        )
      );
    } catch {
      toast.error("Could not update your like");
    }
  };

  const toggleSave = async (post: FeedPost) => {
    try {
      const { data } = await api.post(`/post/${post._id}/save`);
      setPosts((current) =>
        current.map((item) =>
          item._id === post._id
            ? {
                ...item,
                saves: data.saved ? [...(item.saves || []), user?._id] : (item.saves || []).filter((id) => referenceId(id) !== String(user?._id)),
              }
            : item
        )
      );
      toast.info(data.saved ? "Post saved" : "Removed from saved posts");
    } catch {
      toast.error("Could not save this post");
    }
  };

  const sharePost = async (post: FeedPost) => {
    const postUrl = `${window.location.origin}/public-space#post-${post._id}`;
    try {
      await api.post(`/post/${post._id}/share`);
      if (navigator.share) await navigator.share({ title: "InternArea Community Post", url: postUrl });
      else {
        await navigator.clipboard.writeText(postUrl);
        toast.success("Link copied to clipboard");
      }
      setPosts((current) =>
        current.map((item) => (item._id === post._id ? { ...item, shareCount: (item.shareCount || 0) + 1 } : item))
      );
    } catch (error: any) {
      if (error?.name !== "AbortError") toast.error("Could not share this post");
    }
  };

  const toggleComments = async (post: FeedPost) => {
    const isOpen = Boolean(openComments[post._id]);
    setOpenComments((current) => ({ ...current, [post._id]: !isOpen }));
    if (isOpen || comments[post._id]) return;
    try {
      const { data } = await api.get(`/post/${post._id}/comments`);
      setComments((current) => ({ ...current, [post._id]: data.comments.reverse() }));
    } catch {
      toast.error("Could not load comments");
      setOpenComments((current) => ({ ...current, [post._id]: false }));
    }
  };

  const submitComment = async (post: FeedPost) => {
    const draft = commentDrafts[post._id]?.trim();
    if (!draft) return;
    setSendingComment(post._id);
    try {
      const { data } = await api.post(`/post/${post._id}/comments`, { content: draft });
      const comment = {
        ...data.comment,
        userId: { name: user?.name || user?.displayName, photo: user?.photo || user?.photoURL },
      };
      setComments((current) => ({ ...current, [post._id]: [...(current[post._id] || []), comment] }));
      setCommentDrafts((current) => ({ ...current, [post._id]: "" }));
      setPosts((current) =>
        current.map((item) => (item._id === post._id ? { ...item, commentCount: (item.commentCount || 0) + 1 } : item))
      );
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Could not add your comment");
    } finally {
      setSendingComment(null);
    }
  };

  const renderContentWithTags = (text: string) => {
    const words = text.split(/(\s+)/);
    return words.map((word, i) => {
      if (word.startsWith("#") && word.length > 1) {
        const tag = word.slice(1).replace(/[^a-zA-Z0-9_]/g, "");
        return (
          <button
            key={i}
            type="button"
            onClick={() => setTagFilter(tag)}
            className="font-semibold text-emerald-800 hover:underline"
          >
            {word}
          </button>
        );
      }
      if (word.startsWith("@") && word.length > 1) {
        return (
          <span key={i} className="font-semibold text-indigo-700">
            {word}
          </span>
        );
      }
      return word;
    });
  };

  const userName = user?.name || user?.displayName || "Your profile";
  const userPhoto = user?.photo || user?.photoURL;

  return (
    <main className="min-h-screen bg-[#f3f6f4] text-slate-900 pb-16">
      <div className="border-b border-emerald-950/10 bg-[#e7f1eb]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-7 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">{t("publicSpace.communityLabel")}</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">{t("publicSpace.title")}</h1>
            <p className="mt-1 text-sm text-slate-600">{t("publicSpace.description")}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/friends"
              className="inline-flex h-10 items-center gap-2 border border-emerald-900/20 bg-white px-3.5 rounded text-sm font-semibold text-emerald-950 hover:bg-emerald-50"
            >
              <UsersRound size={16} /> {t("publicSpace.manageFriends", { count: user?.friendCount || 0 })}
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl items-start gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[230px_minmax(0,1fr)_260px] lg:px-8 lg:py-8">
        {/* Left Sidebar */}
        <aside className="hidden lg:block">
          <section className="overflow-hidden border border-slate-200 bg-white rounded-xl shadow-sm">
            <div className="h-16 bg-[linear-gradient(120deg,#145b4b,#76a98b)]" />
            <div className="px-4 pb-4">
              <div className="-mt-6 grid h-12 w-12 place-items-center rounded-full border-2 border-white bg-emerald-100 font-bold text-emerald-900 shadow">
                {userPhoto ? <img src={userPhoto} alt="" className="h-full w-full rounded-full object-cover" /> : initials(userName)}
              </div>
              <h2 className="mt-3 truncate font-semibold text-slate-900">{userName}</h2>
              <p className="text-xs text-slate-500">@{user?.username || "student"}</p>
              <div className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-600 flex justify-between">
                <span>{t("navbar.friends")}:</span>
                <span className="font-bold text-emerald-800">{user?.friendCount || 0}</span>
              </div>
              <Link href="/profile" className="mt-4 block w-full text-center py-1.5 rounded border border-slate-200 text-xs font-semibold text-emerald-800 hover:bg-slate-50">
                {t("navbar.profile")}
              </Link>
            </div>
          </section>

          {/* Hashtag Filters */}
          <nav className="mt-4 border border-slate-200 bg-white p-3 rounded-xl shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
              <Hash size={13} className="text-emerald-700" /> {t("publicSpace.discoverTopics")}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setTagFilter(null)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                  tagFilter === null ? "bg-emerald-800 text-white font-semibold" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {t("publicSpace.allPosts")}
              </button>
              {POPULAR_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setTagFilter(tag)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                    tagFilter === tag ? "bg-emerald-800 text-white font-semibold" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </nav>
        </aside>

        {/* Center Feed */}
        <section className="min-w-0" aria-label={t("publicSpace.communityFeed")}>
          {/* Post Creation Box */}
          <div className="border border-slate-200 bg-white p-4 sm:p-5 rounded-xl shadow-sm">
            <div className="flex items-start gap-3">
              <Avatar name={userName} photo={userPhoto} />
              <textarea
                aria-label={t("publicSpace.writePostLabel")}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                maxLength={3000}
                placeholder={t("publicSpace.writePost")}
                className="min-h-[86px] min-w-0 flex-1 resize-y border border-slate-200 p-3 text-sm leading-6 text-slate-800 outline-none rounded-lg placeholder:text-slate-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
              />
            </div>
            {file && (
              <div className="mt-3 flex items-center justify-between gap-3 border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-950 rounded">
                <span className="flex min-w-0 items-center gap-2 truncate">
                  <ImagePlus size={16} /> {file.name}
                </span>
                <button
                  type="button"
                  aria-label={t("publicSpace.removeAttachment")}
                  onClick={() => setFile(null)}
                  className="grid h-7 w-7 shrink-0 place-items-center hover:bg-emerald-100 rounded"
                >
                  <X size={15} />
                </button>
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex h-9 cursor-pointer items-center gap-2 px-2.5 text-xs font-semibold text-slate-600 rounded hover:bg-slate-50 hover:text-emerald-800">
                  <ImagePlus size={16} className="text-emerald-700" /> {t("publicSpace.photoVideo")}
                  <input type="file" accept="image/*,video/*" onChange={selectMedia} className="sr-only" />
                </label>
                <label className="flex h-9 items-center gap-1.5 px-2 text-xs text-slate-600">
                  <Globe2 size={15} className="text-slate-500" />
                  <select
                    aria-label={t("publicSpace.postAudience")}
                    value={privacy}
                    onChange={(event) => setPrivacy(event.target.value as "public" | "friends")}
                    className="border-0 bg-transparent text-xs font-medium outline-none focus:ring-0"
                  >
                    <option value="public">{t("publicSpace.public")}</option>
                    <option value="friends">{t("publicSpace.friendsOnly")}</option>
                  </select>
                </label>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">{content.length}/3000</span>
                <button
                  type="button"
                  onClick={submitPost}
                  disabled={posting || (!content.trim() && !file)}
                  className="inline-flex h-9 items-center gap-2 bg-emerald-800 px-4 text-xs font-semibold text-white rounded hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-45 shadow-sm"
                >
                  <Send size={14} /> {posting ? t("publicSpace.posting") : t("publicSpace.post")}
                </button>
              </div>
            </div>
          </div>

          {/* Active Tag Filter Indicator */}
          {tagFilter && (
            <div className="my-3 flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-900">
              <span>
                {t("publicSpace.filteringByHashtag")}: <b className="font-bold">#{tagFilter}</b>
              </span>
              <button onClick={() => setTagFilter(null)} className="font-semibold underline hover:text-emerald-950">
                {t("publicSpace.clearFilter")}
              </button>
            </div>
          )}

          {/* Feed Header */}
          <div className="mb-3 mt-6 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-950">{t("publicSpace.communityFeed")}</h2>
            <span className="text-xs text-slate-500">{t("publicSpace.feedSort")}</span>
          </div>

          {feedError && (
            <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 rounded">
              <span>{feedError}</span>
              <button onClick={() => void loadPosts(true)} className="font-semibold underline underline-offset-2">
                Try again
              </button>
            </div>
          )}

          {loading && posts.length === 0 && !feedError && (
            <div role="status" className="border border-slate-200 bg-white p-6 text-sm text-slate-500 rounded-xl shadow-sm text-center">
              <Loader2 size={20} className="animate-spin text-emerald-700 mx-auto mb-2" />
              Loading posts...
            </div>
          )}

          {!loading && !feedError && posts.length === 0 && (
            <div className="border border-slate-200 bg-white px-6 py-12 text-center rounded-xl shadow-sm">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-800">
                <UsersRound size={22} />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">
                {tagFilter ? `No posts found tagged #${tagFilter}` : "Your feed is ready"}
              </h3>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500">
                {tagFilter ? "Try exploring other topics or clearing the filter." : "Connect with more friends or share your first post to start conversations!"}
              </p>
            </div>
          )}

          {/* Posts List */}
          <div className="space-y-4">
            {posts.map((post) => {
              const author = post.userId || {};
              const authorName = author.name || "Community member";
              const authorId = String(author._id || "");
              const isOwner = user && String(user._id) === authorId;
              const isEditable = isOwner && Date.now() - new Date(post.createdAt).getTime() <= EDIT_WINDOW_MS;
              const liked = (post.likes || []).some((id) => referenceId(id) === String(user?._id));
              const saved = (post.saves || []).some((id) => referenceId(id) === String(user?._id));
              const mediaUrl = post.mediaUrl?.startsWith("http") ? post.mediaUrl : `${API_ORIGIN}${post.mediaUrl || ""}`;

              return (
                <article
                  id={`post-${post._id}`}
                  key={post._id}
                  className="border border-slate-200 bg-white rounded-xl shadow-sm overflow-hidden"
                >
                  <div className="flex items-start gap-3 px-4 pt-4 sm:px-5">
                    <Avatar name={authorName} photo={author.photo} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{authorName}</p>
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {author.username ? `@${author.username} · ` : ""}
                            {postDate(post.createdAt)}
                            {post.privacy === "friends" && <span> · Friends</span>}
                          </p>
                        </div>

                        {/* Options Menu Dropdown */}
                        <div className="relative">
                          <button
                            aria-label="Post options"
                            onClick={() => setOpenMenuPostId(openMenuPostId === post._id ? null : post._id)}
                            className="grid h-8 w-8 place-items-center rounded text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                          >
                            <MoreHorizontal size={19} />
                          </button>

                          {openMenuPostId === post._id && (
                            <div
                              ref={menuRef}
                              className="absolute right-0 z-40 mt-1 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-100"
                            >
                              {isOwner ? (
                                <>
                                  {isEditable ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingPost(post);
                                        setEditContent(post.content);
                                        setOpenMenuPostId(null);
                                      }}
                                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                    >
                                      <Edit2 size={14} className="text-emerald-700" /> Edit post (15m window)
                                    </button>
                                  ) : (
                                    <div className="px-3 py-2 text-[11px] text-slate-400">
                                      Editing window expired
                                    </div>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleDeletePost(post._id)}
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
                                  >
                                    <Trash2 size={14} /> Delete post
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleSendFriendRequest(authorId)}
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                  >
                                    <UserPlus size={14} className="text-emerald-700" /> Add Friend
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleFollow(authorId)}
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                  >
                                    <UserCheck size={14} className="text-indigo-700" /> Follow User
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReportingPost(post);
                                      setOpenMenuPostId(null);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-50"
                                  >
                                    <Flag size={14} /> Report post
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {post.content && (
                    <p className="whitespace-pre-wrap break-words px-4 pb-3 pt-3 text-sm leading-6 text-slate-800 sm:px-5">
                      {renderContentWithTags(post.content)}
                    </p>
                  )}

                  {post.mediaUrl && post.mediaType === "image" && (
                    <img src={mediaUrl} alt="Post attachment" className="max-h-[560px] w-full bg-slate-50 object-contain" />
                  )}
                  {post.mediaUrl && post.mediaType === "video" && (
                    <video src={mediaUrl} controls className="max-h-[560px] w-full bg-black" aria-label="Post video" />
                  )}

                  <div className="flex items-center justify-between px-5 py-2 text-xs text-slate-500">
                    <span className="flex items-center gap-2">
                      <span>{post.likes?.length || 0} likes</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Eye size={13} className="text-slate-400" /> {post.viewCount || 0} views
                      </span>
                    </span>
                    <button onClick={() => void toggleComments(post)} className="hover:text-slate-800">
                      {post.commentCount || 0} comments · {post.shareCount || 0} shares
                    </button>
                  </div>

                  <div className="mx-4 border-t border-slate-100 sm:mx-5" />

                  <div className="grid grid-cols-4 px-2 py-1.5 sm:px-3">
                    <button
                      onClick={() => void toggleLike(post)}
                      aria-pressed={liked}
                      className={`flex min-h-10 items-center justify-center gap-1.5 text-xs font-semibold transition hover:bg-slate-50 rounded sm:gap-2 sm:text-sm ${
                        liked ? "text-rose-600" : "text-slate-600"
                      }`}
                    >
                      <span aria-hidden="true" className="text-base">
                        {liked ? "♥" : "♡"}
                      </span>{" "}
                      {t("publicSpace.like")}
                    </button>
                    <button
                      onClick={() => void toggleComments(post)}
                      aria-expanded={Boolean(openComments[post._id])}
                      className="flex min-h-10 items-center justify-center gap-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 rounded sm:gap-2 sm:text-sm"
                    >
                      <MessageCircle size={16} /> {t("publicSpace.comment")}
                    </button>
                    <button
                      onClick={() => void sharePost(post)}
                      className="flex min-h-10 items-center justify-center gap-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 rounded sm:gap-2 sm:text-sm"
                    >
                      <Share2 size={16} /> {t("publicSpace.share")}
                    </button>
                    <button
                      onClick={() => void toggleSave(post)}
                      aria-pressed={saved}
                      className={`flex min-h-10 items-center justify-center gap-1.5 text-xs font-semibold hover:bg-slate-50 rounded sm:gap-2 sm:text-sm ${
                        saved ? "text-emerald-800" : "text-slate-600"
                      }`}
                    >
                      <Bookmark size={16} fill={saved ? "currentColor" : "none"} /> {t("publicSpace.save")}
                    </button>
                  </div>

                  {/* Comments Section */}
                  {openComments[post._id] && (
                    <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-4 sm:px-5">
                      <div className="space-y-3">
                        {(comments[post._id] || []).map((comment) => (
                          <div key={comment._id} className="flex items-start gap-2.5">
                            <Avatar name={comment.userId?.name} photo={comment.userId?.photo} size="sm" />
                            <div className="min-w-0 flex-1 bg-white px-3.5 py-2.5 rounded-lg border border-slate-100 shadow-xs">
                              <p className="text-xs font-semibold text-slate-900">{comment.userId?.name || "Community member"}</p>
                              <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-slate-700">
                                {renderContentWithTags(comment.content)}
                              </p>
                            </div>
                          </div>
                        ))}
                        {comments[post._id]?.length === 0 && <p className="text-xs text-slate-500">{t("publicSpace.noComments")}</p>}
                      </div>
                      <form
                        className="mt-4 flex items-center gap-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void submitComment(post);
                        }}
                      >
                        <Avatar name={userName} photo={userPhoto} size="sm" />
                        <input
                          value={commentDrafts[post._id] || ""}
                          onChange={(event) => setCommentDrafts((current) => ({ ...current, [post._id]: event.target.value }))}
                          maxLength={1000}
                          placeholder={t("publicSpace.writeComment")}
                          aria-label={t("publicSpace.writeComment")}
                          className="h-10 min-w-0 flex-1 border border-slate-200 bg-white px-3 text-xs outline-none rounded-lg focus:border-emerald-700"
                        />
                        <button
                          type="submit"
                          disabled={!commentDrafts[post._id]?.trim() || sendingComment === post._id}
                          aria-label={t("publicSpace.sendComment")}
                          className="grid h-10 w-10 shrink-0 place-items-center bg-emerald-800 text-white rounded-lg hover:bg-emerald-900 disabled:opacity-40"
                        >
                          <Send size={15} />
                        </button>
                      </form>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {hasMore && !loading && !feedError && (
            <button
              onClick={() => void loadPosts(false)}
              disabled={loadingMore}
              className="mt-5 h-11 w-full border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:border-emerald-700 hover:text-emerald-900 rounded-lg disabled:opacity-50 shadow-sm"
            >
              {loadingMore ? "Loading more posts..." : "Load more posts"}
            </button>
          )}
          {!hasMore && posts.length > 0 && <p className="py-6 text-center text-xs text-slate-400">You’re all caught up!</p>}
        </section>

        {/* Right Sidebar */}
        <aside className="hidden lg:block">
          <section className="border border-slate-200 bg-white p-4 rounded-xl shadow-sm">
            <h2 className="text-sm font-bold text-slate-900">Community Posting Rules</h2>
            <p className="mt-2 text-xs leading-5 text-slate-600">Posting limits are tied to your friend network for quality and safety:</p>
            <div className="mt-3 space-y-2 text-xs text-slate-600 border-t border-slate-100 pt-3">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span>0 Friends</span>
                <span className="font-semibold text-slate-500">Cannot post</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span>1 Friend</span>
                <span className="font-semibold text-slate-700">1 post / day</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span>2–5 Friends</span>
                <span className="font-semibold text-slate-700">2 posts / day</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span>6–10 Friends</span>
                <span className="font-semibold text-slate-700">5 posts / day</span>
              </div>
              <div className="flex justify-between py-1">
                <span>&gt;10 Friends</span>
                <span className="font-bold text-emerald-800">Unlimited posts</span>
              </div>
            </div>
            <Link href="/friends" className="mt-4 block w-full text-center py-2 bg-emerald-50 text-emerald-900 text-xs font-semibold rounded hover:bg-emerald-100">
              Find Friends to Unlock Limits
            </Link>
          </section>
        </aside>
      </div>

      {/* Edit Post Modal */}
      {editingPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <button onClick={() => setEditingPost(null)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-700">
              <X size={18} />
            </button>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Edit2 size={18} className="text-emerald-700" /> Edit Your Post
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Posts can be edited within 15 minutes of publication.
            </p>
            <form onSubmit={handleEditSubmit} className="mt-4 space-y-4">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                maxLength={3000}
                rows={5}
                className="w-full rounded-lg border border-slate-300 p-3 text-sm leading-6 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
              />
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingPost(null)}
                  className="px-4 py-2 rounded text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit || !editContent.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded bg-emerald-800 text-xs font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"
                >
                  {savingEdit ? <Loader2 size={14} className="animate-spin" /> : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Report Post Modal */}
      {reportingPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <button onClick={() => setReportingPost(null)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-700">
              <X size={18} />
            </button>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-700 mb-3">
              <Flag size={20} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Report Inappropriate Content</h3>
            <p className="mt-1 text-xs text-slate-500">
              Help us maintain a safe community. Why are you reporting this post?
            </p>
            <form onSubmit={handleReportSubmit} className="mt-4 space-y-3">
              {[
                "Spam or commercial advertising",
                "Harassment, hate speech, or abuse",
                "Inappropriate or graphic media",
                "Misleading or fraudulent internship info",
                "Other policy violation",
              ].map((reason) => (
                <label key={reason} className="flex items-center gap-2.5 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs text-slate-700">
                  <input
                    type="radio"
                    name="reportReason"
                    value={reason}
                    checked={reportReason === reason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="text-emerald-800 focus:ring-emerald-700"
                  />
                  <span>{reason}</span>
                </label>
              ))}

              <div className="mt-4 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setReportingPost(null)}
                  className="px-4 py-2 rounded text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReport}
                  className="flex items-center gap-1.5 px-4 py-2 rounded bg-amber-700 text-xs font-semibold text-white hover:bg-amber-800 disabled:opacity-50"
                >
                  {submittingReport ? <Loader2 size={14} className="animate-spin" /> : "Submit Report"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
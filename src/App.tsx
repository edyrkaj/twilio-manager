import { useState, useEffect, useCallback, useRef } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import "./App.css";
import {
  type Channel,
  filterMessagesByChannel,
  groupConversations,
} from "./channel";

interface Credentials {
  account_sid: string;
  auth_token: string;
  from_number: string;
  whatsapp_from_number: string;
}

interface TwilioMessage {
  sid: string;
  body: string;
  from: string;
  to: string;
  date_created: string;
  date_sent: string | null;
  direction: string;
  status: string;
}

type View = "messages" | "whatsapp" | "settings";

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatTimestamp(dateStr: string): string {
  return new Date(dateStr).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// All hooks live here — only rendered when running inside the Tauri WebView.
function TwilioApp() {

  const [view, setView] = useState<View>("messages");
  const [credentials, setCredentials] = useState<Credentials>({
    account_sid: "",
    auth_token: "",
    from_number: "",
    whatsapp_from_number: "",
  });
  const [savedCreds, setSavedCreds] = useState<Credentials | null>(null);
  const [messages, setMessages] = useState<TwilioMessage[]>([]);
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendTo, setSendTo] = useState("");
  const [sendBody, setSendBody] = useState("");
  const [sending, setSending] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const creds = await invoke<Credentials | null>("load_credentials");
        if (creds) {
          const normalized = {
            ...creds,
            whatsapp_from_number: creds.whatsapp_from_number ?? "",
          };
          setSavedCreds(normalized);
          setCredentials(normalized);
          fetchMessages(normalized);
        } else {
          setView("settings");
        }
      } catch (e) {
        setError(String(e));
        setView("settings");
      }
    })();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedNumber, messages]);

  const fetchMessages = useCallback(
    async (creds?: Credentials) => {
      const c = creds ?? savedCreds;
      if (!c) return;
      setLoading(true);
      setError(null);
      try {
        const msgs = await invoke<TwilioMessage[]>("get_messages", {
          credentials: c,
        });
        setMessages(msgs);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    },
    [savedCreds]
  );

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await invoke("save_credentials", { credentials });
      setSavedCreds(credentials);
      setView("messages");
      fetchMessages(credentials);
    } catch (e) {
      setError(String(e));
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!savedCreds) return;
    setSending(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await invoke<TwilioMessage>("send_message", {
        credentials: savedCreds,
        to: sendTo,
        body: sendBody,
        channel: view === "whatsapp" ? "whatsapp" : "sms",
      });
      setSendBody("");
      setSuccessMsg("Message sent!");
      setTimeout(() => setSuccessMsg(null), 3000);
      fetchMessages();
    } catch (e) {
      setError(String(e));
    } finally {
      setSending(false);
    }
  };

  const channel: Channel = view === "whatsapp" ? "whatsapp" : "sms";
  const channelMessages = filterMessagesByChannel(messages, channel);
  const whatsappConfigured = Boolean(
    savedCreds?.whatsapp_from_number.trim()
  );
  const sendDisabled =
    sending || !savedCreds || (view === "whatsapp" && !whatsappConfigured);

  // Group messages into conversations by the remote party number
  const conversations = groupConversations(channelMessages);

  const conversationMessages = (
    conversations.find(([num]) => num === selectedNumber)?.[1] ?? []
  )
    .slice()
    .sort(
      (a, b) =>
        new Date(a.date_created).getTime() - new Date(b.date_created).getTime()
    );

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="header">
        <div className="header-left">
          <span className="header-logo">✉</span>
          <h1 className="header-title">Twilio Manager</h1>
        </div>
        <div className="header-right">
          <nav className="header-nav">
            <button
              className={`btn ${view === "messages" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => {
                setView("messages");
                setSelectedNumber(null);
              }}
            >
              Messages
            </button>
            <button
              className={`btn ${view === "whatsapp" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => {
                setView("whatsapp");
                setSelectedNumber(null);
              }}
            >
              WhatsApp
            </button>
          </nav>
          {savedCreds && view !== "settings" && (
            <button
              className="btn btn-ghost"
              onClick={() => fetchMessages()}
              disabled={loading}
            >
              {loading ? "↻ Loading…" : "↻ Refresh"}
            </button>
          )}
          <button
            className={`btn ${view === "settings" ? "btn-primary" : "btn-ghost"}`}
            onClick={() =>
              setView(view === "settings" ? "messages" : "settings")
            }
          >
            {view === "settings" ? "← Messages" : "⚙ Settings"}
          </button>
        </div>
      </header>

      {/* ── Error banner ── */}
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* ── Settings view ── */}
      {view === "settings" && (
        <div className="center-wrap">
          <div className="card settings-card">
            <h2>Connect to Twilio</h2>
            <p className="muted">
              Credentials are saved locally at{" "}
              <code>~/.twilio-manager/credentials.json</code>.
            </p>
            <form className="stack" onSubmit={handleSaveCredentials}>
              <label className="field">
                <span>Account SID</span>
                <input
                  type="text"
                  value={credentials.account_sid}
                  onChange={(e) =>
                    setCredentials({ ...credentials, account_sid: e.target.value })
                  }
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  required
                  autoComplete="off"
                />
              </label>
              <label className="field">
                <span>Auth Token</span>
                <input
                  type="password"
                  value={credentials.auth_token}
                  onChange={(e) =>
                    setCredentials({ ...credentials, auth_token: e.target.value })
                  }
                  placeholder="Your auth token"
                  required
                />
              </label>
              <label className="field">
                <span>From Phone Number</span>
                <input
                  type="text"
                  value={credentials.from_number}
                  onChange={(e) =>
                    setCredentials({ ...credentials, from_number: e.target.value })
                  }
                  placeholder="+15551234567"
                  required
                />
              </label>
              <label className="field">
                <span>WhatsApp From Number</span>
                <input
                  type="text"
                  value={credentials.whatsapp_from_number}
                  onChange={(e) =>
                    setCredentials({
                      ...credentials,
                      whatsapp_from_number: e.target.value,
                    })
                  }
                  placeholder="+15557318728"
                />
              </label>
              <p className="muted">
                Incoming WhatsApp webhooks are set in Twilio Console → Numbers
                &amp; senders → WhatsApp → Edit Sender. This app lists messages
                by polling the Twilio API.
              </p>
              <button type="submit" className="btn btn-primary btn-full">
                Save &amp; Connect
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Messages / WhatsApp view ── */}
      {view !== "settings" && (
        <div className="messages-layout">
          {/* Sidebar */}
          <aside className="sidebar">
            <div className="sidebar-head">
              <span className="sidebar-label">
                {view === "whatsapp" ? "WhatsApp" : "Conversations"}
              </span>
              <button
                className="btn btn-xs btn-primary"
                onClick={() => {
                  setSelectedNumber(null);
                  setSendTo("");
                  setSendBody("");
                }}
              >
                + New
              </button>
            </div>

            {loading && messages.length === 0 && (
              <div className="sidebar-placeholder">Loading…</div>
            )}
            {!loading && conversations.length === 0 && (
              <div className="sidebar-placeholder">
                {view === "whatsapp"
                  ? "No WhatsApp messages found"
                  : "No messages found"}
              </div>
            )}

            <ul className="conv-list">
              {conversations.map(([number, msgs]) => {
                const latest = msgs[0];
                const isOut = latest.direction.startsWith("outbound");
                return (
                  <li
                    key={number}
                    className={`conv-item ${selectedNumber === number ? "active" : ""}`}
                    onClick={() => {
                      setSelectedNumber(number);
                      setSendTo(number);
                      setSendBody("");
                    }}
                  >
                    <div className="conv-top">
                      <span className="conv-number">{number}</span>
                      <span className="conv-time">
                        {timeAgo(latest.date_created)}
                      </span>
                    </div>
                    <div className="conv-preview">
                      {isOut ? "You: " : ""}
                      {latest.body}
                    </div>
                  </li>
                );
              })}
            </ul>
          </aside>

          {/* Chat pane */}
          <main className="chat-pane">
            {selectedNumber ? (
              <>
                <div className="chat-head">
                  <button
                    className="btn btn-ghost btn-xs"
                    onClick={() => setSelectedNumber(null)}
                  >
                    ← Back
                  </button>
                  <span className="chat-partner">{selectedNumber}</span>
                </div>

                <div className="bubble-list">
                  {conversationMessages.map((msg) => {
                    const isOut = msg.direction.startsWith("outbound");
                    return (
                      <div
                        key={msg.sid}
                        className={`bubble ${isOut ? "bubble-out" : "bubble-in"}`}
                      >
                        <div className="bubble-body">{msg.body}</div>
                        <div className="bubble-meta">
                          {formatTimestamp(msg.date_created)} · {msg.status}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                <form className="reply-bar" onSubmit={handleSend}>
                  <input
                    className="reply-input"
                    type="text"
                    value={sendBody}
                    onChange={(e) => setSendBody(e.target.value)}
                    placeholder="Type a message…"
                    required
                  />
                  <button className="btn btn-primary" disabled={sendDisabled}>
                    {sending ? "…" : "Send"}
                  </button>
                </form>
              </>
            ) : (
              <div className="center-wrap">
                <div className="card compose-card">
                  <h2>
                    {view === "whatsapp" ? "New WhatsApp Message" : "New Message"}
                  </h2>
                  <form className="stack" onSubmit={handleSend}>
                    <label className="field">
                      <span>To</span>
                      <input
                        type="text"
                        value={sendTo}
                        onChange={(e) => setSendTo(e.target.value)}
                        placeholder="+15551234567"
                        required
                      />
                    </label>
                    <label className="field">
                      <span>Message</span>
                      <textarea
                        value={sendBody}
                        onChange={(e) => setSendBody(e.target.value)}
                        placeholder="Type your message…"
                        rows={4}
                        required
                      />
                    </label>
                    {successMsg && (
                      <div className="success-msg">{successMsg}</div>
                    )}
                    <button
                      type="submit"
                      className="btn btn-primary btn-full"
                      disabled={sendDisabled}
                    >
                      {sending ? "Sending…" : "Send Message"}
                    </button>
                    {!savedCreds && (
                      <p className="muted center">
                        Configure credentials in Settings first.
                      </p>
                    )}
                    {savedCreds && view === "whatsapp" && !whatsappConfigured && (
                      <p className="muted center">
                        Add your WhatsApp from number in Settings first.
                      </p>
                    )}
                  </form>
                </div>
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}

// Top-level wrapper: guards against running outside the Tauri WebView
// (e.g. opening localhost:1420 in a regular browser).
export default function App() {
  if (!isTauri()) {
    return (
      <div className="center-wrap" style={{ height: "100vh" }}>
        <div className="card" style={{ maxWidth: 420, textAlign: "center" }}>
          <h2>Desktop app required</h2>
          <p className="muted" style={{ marginTop: 10 }}>
            This app must be run inside Tauri, not a regular browser.
            <br />
            <br />
            Start it with:&nbsp;<code>npm run tauri dev</code>
          </p>
        </div>
      </div>
    );
  }
  return <TwilioApp />;
}

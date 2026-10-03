import { StrictMode, useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Strategy, StrategySummary } from "../../src/core/types.js";
import { api, ApiError, type Library, type SyncStatus } from "./api.js";
import { Markdown } from "./Markdown.js";
import "./styles.css";

function Arrow({ back = false }: { back?: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d={back ? "M19 12H5m6-6-6 6 6 6" : "M5 12h14m-6-6 6 6-6 6"} />
    </svg>
  );
}

function route() {
  const parts = window.location.hash.split("/");
  return {
    strategy: parts[1] === "strategy" ? (parts[2] ?? "") : "",
    step: parts[3] === "step" ? (parts[4] ?? "") : "",
  };
}
function navigate(strategy = "", step = "") {
  window.location.hash = strategy
    ? `/strategy/${encodeURIComponent(strategy)}${step ? `/step/${encodeURIComponent(step)}` : ""}`
    : "/";
}
function stepLabel(index: number) {
  return `Step ${index + 1}`;
}
function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="notice" role="status">
      {children}
    </div>
  );
}

function Login({
  onLogin,
  expired,
}: {
  onLogin: () => void;
  expired: boolean;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <main className="login">
      <div className="login-intro">
        <div className="wordmark">Stratdeck</div>
        <h1>
          Your team’s next move.
          <br />
          Straight from Discord.
        </h1>
        <p>
          Original notes. Ordered screenshots.
          <br />
          One place to get on the same page.
        </p>
        <div className="login-foot">
          Private team access · Discord remains the source of truth
        </div>
      </div>
      <section className="login-form">
        <h2>Open the playbook</h2>
        <p>Enter your team’s shared password to continue.</p>
        {expired && (
          <Notice>Your session ended. Sign in to return to your place.</Notice>
        )}
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            try {
              await api("/session", {
                method: "POST",
                body: JSON.stringify({ password }),
              });
              setPassword("");
              onLogin();
            } catch (err) {
              setError(
                err instanceof Error
                  ? err.message
                  : "Unable to sign in. Try again.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label htmlFor="password">Team password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-describedby={error ? "login-error" : undefined}
            autoFocus
          />
          {error && (
            <p id="login-error" role="alert" className="error">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy ? "Opening…" : "Open playbook"}
          </button>
        </form>
        <p className="muted">Need access? Ask your team for the password.</p>
      </section>
    </main>
  );
}

function Image({
  file,
  label,
  onZoom,
}: {
  file: string;
  label: string;
  onZoom: (url: string, label: string) => void;
}) {
  const [failed, setFailed] = useState(false);
  const url = `/api/media/${file.slice("images/".length)}`;
  return failed ? (
    <Notice>
      Image unavailable.{" "}
      <button onClick={() => setFailed(false)}>Retry image</button> or check the
      original message in Discord.
    </Notice>
  ) : (
    <button
      className="image-button"
      aria-label={`Enlarge ${label}`}
      onClick={() => onZoom(url, label)}
    >
      <img src={url} alt={label} onError={() => setFailed(true)} />
      <span>Enlarge image</span>
    </button>
  );
}
function Zoom({
  image,
  onClose,
}: {
  image: { url: string; label: string } | null;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [scaled, setScaled] = useState(false);
  const touchYStart = useRef<number | null>(null);

  useEffect(() => {
    if (image) {
      setScaled(false);
      dialog.current?.showModal();
    } else {
      dialog.current?.close();
    }
  }, [image]);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch) touchYStart.current = touch.clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchYStart.current === null) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const deltaY = touch.clientY - touchYStart.current;
    touchYStart.current = null;
    if (deltaY > 60) {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialog}
      className={`zoom ${scaled ? "scaled" : ""}`}
      onCancel={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      aria-label={image?.label ?? "Image viewer"}
    >
      <div className="zoom-handle" aria-hidden="true" />
      <div className="zoom-bar">
        <span>{image?.label}</span>
        <div className="zoom-actions">
          <button
            type="button"
            className="zoom-scale-btn"
            onClick={() => setScaled((prev) => !prev)}
            aria-label={scaled ? "Fit to screen" : "Zoom image"}
          >
            {scaled ? "Fit" : "Zoom"}
          </button>
          <button autoFocus onClick={onClose}>
            Close image <kbd>Esc</kbd>
          </button>
        </div>
      </div>
      <div className="zoom-body" onClick={() => setScaled((prev) => !prev)}>
        {image && <img src={image.url} alt={image.label} />}
      </div>
    </dialog>
  );
}

function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [expired, setExpired] = useState(false);
  const [library, setLibrary] = useState<Library | null>(null);

  const [loadError, setLoadError] = useState("");

  const [location, setLocation] = useState(route);
  const [category, setCategory] = useState("");
  const [side, setSide] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StrategySummary[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [strategyError, setStrategyError] = useState("");
  const [strategyBusy, setStrategyBusy] = useState(false);
  const [updated, setUpdated] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [zoom, setZoom] = useState<{ url: string; label: string } | null>(null);
  const strategyRef = useRef(strategy);
  strategyRef.current = strategy;
  const activeStepRef = useRef<HTMLAnchorElement>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  useEffect(() => {
    if (activeStepRef.current) {
      activeStepRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [location.step]);

  const onWalkthroughTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && e.touches[0]) {
      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
    }
  };

  const onWalkthroughTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const dt = Date.now() - touchStartRef.current.time;
    touchStartRef.current = null;

    if (dt < 600 && Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      if (dx < 0) {
        changeStep(1);
      } else {
        changeStep(-1);
      }
    }
  };

  useEffect(() => {
    void api("/session")
      .then(() => setAuthenticated(true))
      .catch(() => setAuthenticated(false));
    const hash = () => {
      setLocation(route());
      setZoom(null);
    };
    const expire = () => {
      setAuthenticated(false);
      setExpired(true);
      setLibrary(null);
      setStrategy(null);
      setResults([]);
      setZoom(null);
    };
    window.addEventListener("hashchange", hash);
    window.addEventListener("session-expired", expire);
    return () => {
      window.removeEventListener("hashchange", hash);
      window.removeEventListener("session-expired", expire);
    };
  }, []);
  const load = useCallback(async (poll = false) => {
    try {
      const [next, sync] = await Promise.all([
        api<Library>("/library"),
        api<SyncStatus>("/status"),
      ]);
      setLibrary(next);
      setCategory((previous) => next.categories.some((item) => item.id === previous) ? previous : next.categories[0]?.id ?? "");
      void sync;
      setLoadError("");

      const current = strategyRef.current;
      if (current) {
        const summary = next.strategies.find((item) => item.id === current.id);
        setUnavailable(!summary);
        setUpdated(Boolean(summary && summary.revision !== current.revision));
        if (summary && summary.syncStatus !== current.syncStatus)
          setStrategy((previous) =>
            previous && previous.id === current.id
              ? { ...previous, syncStatus: summary.syncStatus }
              : previous,
          );
      }
    } catch (err) {
      if (!poll)
        setLoadError(
          err instanceof Error ? err.message : "Unable to load the playbook.",
        );
    }
  }, []);
  useEffect(() => {
    if (!authenticated) return;
    void load();
    const timer = window.setInterval(() => {
      void load(true);
    }, 15000);
    return () => clearInterval(timer);
  }, [authenticated, load]);
  useEffect(() => {
    if (!authenticated || !location.strategy) {
      setStrategy(null);
      return;
    }
    let active = true;
    setStrategy(null);
    setStrategyError("");
    setStrategyBusy(true);
    setUnavailable(false);
    setUpdated(false);
    void api<Strategy>(`/strategies/${encodeURIComponent(location.strategy)}`)
      .then((value) => {
        if (active) {
          setStrategy(value);
          setCategory(value.categoryId);
          setUnavailable(!value.available);
        }
      })
      .catch((err) => {
        if (active)
          setStrategyError(
            err instanceof ApiError && err.status === 404
              ? "This strategy is unavailable. It may have been removed, moved, or lost Discord access."
              : "Unable to load this strategy. Try opening it again.",
          );
      })
      .finally(() => {
        if (active) setStrategyBusy(false);
      });
    return () => {
      active = false;
    };
  }, [authenticated, location.strategy]);
  useEffect(() => {
    if (!authenticated || !query.trim()) {
      setResults([]);
      setSearchBusy(false);
      setSearchError("");
      return;
    }
    const controller = new AbortController();
    setSearchBusy(true);
    setSearchError("");
    const timer = window.setTimeout(() => {
      void api<{ results: StrategySummary[] }>(
        `/search?q=${encodeURIComponent(query.trim())}`,
        { signal: controller.signal },
      )
        .then((value) => setResults(value.results))
        .catch((err) => {
          if (!controller.signal.aborted)
            setSearchError(
              err instanceof Error ? err.message : "Search unavailable.",
            );
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearchBusy(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, authenticated]);
  const index = strategy
    ? Math.max(
        0,
        strategy.steps.findIndex((step) => step.id === location.step),
      )
    : 0;
  const notesSelected = location.step === "notes" || !strategy?.steps.length;
  const step = notesSelected ? undefined : strategy?.steps[index];
  const changeStep = useCallback(
    (offset: number) => {
      if (!strategy || unavailable) return;
      const nextIndex = (notesSelected ? -1 : index) + offset;
      if (nextIndex === -1) navigate(strategy.id, "notes");
      else {
        const next = strategy.steps[nextIndex];
        if (next) navigate(strategy.id, next.id);
      }
    },
    [strategy, index, notesSelected, unavailable],
  );
  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (
        zoom ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        (event.target instanceof HTMLElement &&
          event.target.closest(
            'input, textarea, select, [contenteditable="true"]',
          ))
      )
        return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        changeStep(event.key === "ArrowLeft" ? -1 : 1);
      }
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, [changeStep, zoom]);
  function source(messageId?: string) {
    return library?.guildId && strategy
      ? `https://discord.com/channels/${library.guildId}/${strategy.id}${messageId ? `/${messageId}` : ""}`
      : undefined;
  }
  function sourceLink(messageId?: string) {
    const url = source(messageId);
    return url ? (
      <a
        className="source"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
      >
        Open {messageId ? "message" : "channel"} in Discord
      </a>
    ) : null;
  }
  if (authenticated === null)
    return (
      <main className="loading" role="status">
        Opening Stratdeck…
      </main>
    );
  if (!authenticated)
    return (
      <Login
        expired={expired}
        onLogin={() => {
          setAuthenticated(true);
          setExpired(false);
        }}
      />
    );
  const visible = (query.trim() ? results : (library?.strategies ?? [])).filter(
    (item) =>
      item.categoryId === category &&
      (!side || item.tags.includes(side as "attack" | "defense")),
  );
  return (
    <>
      <a
        className="skip"
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        Skip to content
      </a>
      <div className={`app-shell ${location.strategy ? "in-strategy" : "in-library"}`}>
        <aside className="sidebar">
          <a className="wordmark" href="#/">
            Stratdeck
          </a>
          <nav aria-label="Categories">
            <h2>Categories</h2>
            {library?.categories.map((item) => (
              <button
                key={item.id}
                className={category === item.id ? "selected" : ""}
                aria-pressed={category === item.id}
                onClick={() => {
                  setCategory(item.id);
                  navigate();
                }}
              >
                {item.name}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <button
              onClick={async () => {
                try {
                  await api("/session", { method: "DELETE" });
                  setAuthenticated(false);
                  setLibrary(null);
                  setStrategy(null);
                  setResults([]);
                  setQuery("");
                  setZoom(null);
                } catch {
                  setLoadError(
                    "Unable to sign out. Check your connection and try again.",
                  );
                }
              }}
            >
              Sign out
            </button>
          </div>
        </aside>
        <div className="workspace">
          <main id="main" tabIndex={-1}>
            {loadError && (
              <div className="error" role="alert">
                {loadError} <button onClick={() => void load()}>Retry</button>
              </div>
            )}
            {!library && !loadError && <p role="status">Loading strategies…</p>}
            {location.strategy ? (
              <>
                <a href="#/" className="back">
                  <Arrow back /> Back to strategies
                </a>
                {strategyBusy && <p role="status">Loading walkthrough…</p>}
                {strategyError && (
                  <Notice>
                    {strategyError} <a href="#/">Return to library</a>
                  </Notice>
                )}
                {unavailable && (
                  <Notice>
                    This strategy is no longer available.{" "}
                    <a href="#/">Return to library</a>
                  </Notice>
                )}
                {strategy && !unavailable && (
                  <article>
                    <div className="strategy-heading">
                      <div>
                        <div className="breadcrumb">
                          {
                            library?.categories.find(
                              (item) => item.id === strategy.categoryId,
                            )?.name
                          }
                        </div>
                        <h1>{strategy.title}</h1>
                      </div>
                      {sourceLink()}
                    </div>
                    {updated && (
                      <Notice>
                        <button
                          onClick={async () => {
                            try {
                              const next = await api<Strategy>(
                                `/strategies/${strategy.id}`,
                              );
                              setStrategy(next);
                              setUpdated(false);
                              setUnavailable(!next.available);
                              const preserved = next.steps.find(
                                (item) => item.id === location.step,
                              );
                              navigate(
                                next.id,
                                notesSelected ? "notes" : preserved?.id ?? next.steps[0]?.id,
                              );
                            } catch {
                              setUnavailable(true);
                            }
                          }}
                        >
                          Update available — refresh
                        </button>
                      </Notice>
                    )}
                    {strategy.warnings.length > 0 && (
                      <details className="warnings" open>
                        <summary>
                          Source & media notices ({strategy.warnings.length})
                        </summary>
                        <ul>
                          {strategy.warnings.map((warning, i) => (
                            <li key={i}>{warning}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                    {!strategy.steps.length && <section className="overview">
                      <h2>Notes</h2>
                      {strategy.overview.length ? (
                        strategy.overview.map((note) => (
                          <div className="note" key={note.messageId}>
                            <Markdown text={note.markdown} />
                            {sourceLink(note.messageId)}
                          </div>
                        ))
                      ) : (
                        <p className="muted">
                          No opening notes in this channel. Start with the
                          walkthrough below.
                        </p>
                      )}
                    </section>}
                    {strategy.steps.length ? (
                      <section className="walkthrough">
                        <div className="walkthrough-head">
                          <h2>Walkthrough</h2>
                          <span>
                            {notesSelected ? "Notes" : `${index + 1} / ${strategy.steps.length}`}
                          </span>
                        </div>
                        <nav className="steps" aria-label="Walkthrough sections">
                          <a
                            ref={notesSelected ? activeStepRef : undefined}
                            href={`#/strategy/${strategy.id}/step/notes`}
                            aria-current={notesSelected ? "step" : undefined}
                          >
                            <span>Notes</span>
                          </a>
                          {strategy.steps.map((item, i) => (
                            <a
                              key={item.id}
                              ref={item.id === step?.id ? activeStepRef : undefined}
                              aria-current={
                                item.id === step?.id ? "step" : undefined
                              }
                              href={`#/strategy/${strategy.id}/step/${item.id}`}
                            >
                              <span className="step-number" aria-hidden="true">{i + 1}</span>
                              <span>{stepLabel(i)}</span>
                            </a>
                          ))}
                        </nav>
                        <div
                          className="walkthrough-interactive"
                          onTouchStart={onWalkthroughTouchStart}
                          onTouchEnd={onWalkthroughTouchEnd}
                        >
                          {notesSelected && (
                            <section className="overview">
                              <h2>Notes</h2>
                              {strategy.overview.length ? strategy.overview.map((note) => (
                                <div className="note" key={note.messageId}>
                                  <Markdown text={note.markdown} />
                                  {sourceLink(note.messageId)}
                                </div>
                              )) : <p className="muted">No opening notes in this channel. Select Step 1 to start the walkthrough.</p>}
                            </section>
                          )}
                          {step && (
                            <div className="step-content" key={step.id}>
                              <div className="images">
                                {step.images.map((image, i) => (
                                  <Image
                                    key={image.attachmentId}
                                    file={image.file}
                                    label={`${stepLabel(index)}, image ${i + 1}`}
                                    onZoom={(url, label) =>
                                      setZoom({ url, label })
                                    }
                                  />
                                ))}
                              </div>
                              <div className="step-notes">
                                <h3>{stepLabel(index)} notes</h3>
                                {step.notes.length ? (
                                  step.notes.map((note) => (
                                    <div className="note" key={note.messageId}>
                                      <Markdown text={note.markdown} />
                                      {sourceLink(note.messageId)}
                                    </div>
                                  ))
                                ) : (
                                  <p className="muted">
                                    No accompanying notes for this step.
                                  </p>
                                )}
                                {sourceLink(step.id)}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="step-controls">
                          <button
                            disabled={notesSelected}
                            onClick={() => changeStep(-1)}
                          >
                            {!notesSelected && index === 0 ? "Notes" : "Previous step"}
                          </button>
                          <span className="muted">
                            Use left / right arrow keys or swipe
                          </span>
                          <button
                            className="primary"
                            disabled={!notesSelected && index >= strategy.steps.length - 1}
                            onClick={() => changeStep(1)}
                          >
                            {notesSelected ? "Step 1" : "Next step"}
                          </button>
                        </div>
                        <div className="mobile-step-dock" role="navigation" aria-label="Step navigation">
                          <button
                            type="button"
                            className="dock-btn"
                            disabled={notesSelected}
                            onClick={() => changeStep(-1)}
                            aria-label={!notesSelected && index === 0 ? "Go to notes" : "Previous step"}
                          >
                            <Arrow back />
                            <span>{!notesSelected && index === 0 ? "Notes" : "Prev"}</span>
                          </button>
                          <div className="dock-indicator">
                            <span className="dock-step-name">
                              {notesSelected ? "Notes" : `Step ${index + 1}`}
                            </span>
                            {strategy.steps.length > 0 && (
                              <span className="dock-step-count">
                                {notesSelected ? `${strategy.steps.length} steps` : `${index + 1} / ${strategy.steps.length}`}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            className="dock-btn primary"
                            disabled={!notesSelected && index >= strategy.steps.length - 1}
                            onClick={() => changeStep(1)}
                            aria-label={notesSelected ? "Start step 1" : "Next step"}
                          >
                            <span>{notesSelected ? "Step 1" : "Next"}</span>
                            <Arrow />
                          </button>
                        </div>
                      </section>
                    ) : null}
                  </article>
                )}
              </>
            ) : (
              <>
                <div className="library-heading">
                  <h1>
                    {category
                      ? library?.categories.find((item) => item.id === category)
                          ?.name
                      : "Strategies"}
                  </h1>
                </div>
                <div className="filters">
                  <div className="search">
                    <label htmlFor="search">Search strategies and notes</label>
                    <div className="search-input-wrap">
                      <input
                        id="search"
                        type="search"
                        maxLength={200}
                        placeholder="Search names, categories, notes…"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                      />
                      {query.length > 0 && (
                        <button
                          type="button"
                          className="search-clear-btn"
                          onClick={() => setQuery("")}
                          aria-label="Clear search query"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                  <fieldset>
                    <legend>Side</legend>
                    {[
                      ["", "All sides"],
                      ["attack", "Attack"],
                      ["defense", "Defense"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        aria-pressed={side === value}
                        className={side === value ? "active" : ""}
                        onClick={() => setSide(value ?? "")}
                      >
                        {label}
                      </button>
                    ))}
                  </fieldset>
                </div>
                {searchError && (
                  <p className="error" role="alert">
                    {searchError} Clear the search or try another query.
                  </p>
                )}
                <div className="list-heading" aria-live="polite">
                  {searchBusy
                    ? "Searching notes…"
                    : `${visible.length} ${visible.length === 1 ? "strategy" : "strategies"}`}
                </div>
                {!searchBusy &&
                  !searchError &&
                  library &&
                  (visible.length ? (
                    <div className="strategy-list">
                      {visible.map((item) => (
                        <a
                          className="strategy-row"
                          key={item.id}
                          href={`#/strategy/${item.id}`}
                        >
                          <div>
                            <h2>{item.title}</h2>
                          </div>
                          <div className="row-meta">
                            {item.tags.map((tag) => (
                              <span className="tag" key={tag}>
                                {tag}
                              </span>
                            ))}
                            <span>
                              {item.stepCount
                                ? `${item.stepCount} steps`
                                : "Notes only"}
                            </span>
                            <span className="row-open">Open walkthrough <Arrow /></span>
                          </div>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <section className="empty">
                      <h2>
                        {library.strategies.length
                          ? "No matching strategies"
                          : "The playbook is empty"}
                      </h2>
                      <p>
                        {library.strategies.length
                          ? "Try a different search, category, or side."
                          : "No available channels have been published yet. Ask the owner to check the selected Discord categories and bot access."}
                      </p>
                      {library.strategies.length > 0 && (
                        <button
                          onClick={() => {
                            setQuery("");
                            setSide("");
                          }}
                        >
                          Clear search and side
                        </button>
                      )}
                    </section>
                  ))}
              </>
            )}
          </main>
        </div>
      </div>
      <Zoom image={zoom} onClose={() => setZoom(null)} />
    </>
  );
}
createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

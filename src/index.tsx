import {
  PanelSection,
  PanelSectionRow,
  staticClasses,
} from "@decky/ui";
import {
  callable,
  definePlugin,
  toaster,
} from "@decky/api";
import { type CSSProperties, useEffect, useState } from "react";
import {
  FaBolt,
  FaGlobeEurope,
  FaLink,
  FaPlug,
  FaPowerOff,
  FaSyncAlt,
  FaTachometerAlt,
} from "react-icons/fa";

type DelayMap = Record<string, number | null>;

type GroupSummary = {
  name: string;
  type: string;
  current: string;
  proxies: string[];
};

type PluginState = {
  subscription_url: string;
  last_profile_source: string;
  last_refreshed_at: string;
  last_error: string;
  active_group: string;
  groups: GroupSummary[];
  health: Record<string, DelayMap>;
  recommended_proxies: Record<string, string>;
  selected_proxies: Record<string, string>;
  mihomo_version: string;
  core_mode: "controller" | "tun" | "stopped";
  connected: boolean;
  controller_ready: boolean;
  has_profile: boolean;
  binary_ready: boolean;
};

const getState = callable<[], PluginState>("get_state");
const applySubscriptionUrl = callable<[url: string], PluginState>("apply_subscription_url");
const refreshSubscription = callable<[], PluginState>("refresh_subscription");
const importProfileText = callable<[yamlText: string], PluginState>("import_profile_text");
const connectVpn = callable<[], PluginState>("connect");
const disconnectVpn = callable<[], PluginState>("disconnect");
const selectProxy = callable<[groupName: string, proxyName: string], PluginState>("select_proxy");
const checkGroup = callable<[groupName: string], PluginState>("check_group");
const chooseBestProxy = callable<[groupName: string], PluginState>("choose_best_proxy");

const EMPTY_STATE: PluginState = {
  subscription_url: "",
  last_profile_source: "",
  last_refreshed_at: "",
  last_error: "",
  active_group: "",
  groups: [],
  health: {},
  recommended_proxies: {},
  selected_proxies: {},
  mihomo_version: "",
  core_mode: "stopped",
  connected: false,
  controller_ready: false,
  has_profile: false,
  binary_ready: false,
};

const cardStyle: CSSProperties = {
  background: "linear-gradient(160deg, rgba(16,24,40,0.95), rgba(12,18,31,0.88))",
  border: "1px solid rgba(120, 156, 219, 0.2)",
  borderRadius: 16,
  padding: 16,
  width: "100%",
  boxSizing: "border-box",
};

const heroStyle: CSSProperties = {
  ...cardStyle,
  display: "grid",
  gap: 12,
};

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(148, 163, 184, 0.28)",
  background: "rgba(10, 15, 28, 0.9)",
  color: "white",
  fontSize: 14,
};

const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: 140,
  resize: "vertical",
};

const selectStyle: CSSProperties = {
  ...inputStyle,
  appearance: "none",
};

const actionRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
};

const metaTextStyle: CSSProperties = {
  color: "rgba(195, 205, 225, 0.74)",
  fontSize: 12,
  lineHeight: 1.45,
};

const proxyRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 12,
  alignItems: "center",
  padding: 12,
  borderRadius: 14,
  background: "rgba(11, 18, 31, 0.9)",
  border: "1px solid rgba(148, 163, 184, 0.16)",
};

const smallButtonStyle: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 999,
  border: "1px solid rgba(96, 165, 250, 0.28)",
  background: "linear-gradient(180deg, rgba(17,24,39,1), rgba(12,18,30,1))",
  color: "white",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
};

const statusPillBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  borderRadius: 999,
  padding: "8px 12px",
  fontSize: 12,
  fontWeight: 700,
};

function statusLabel(state: PluginState): string {
  if (state.connected) {
    return "Подключено";
  }
  if (state.controller_ready) {
    return "Профиль загружен";
  }
  if (state.has_profile) {
    return "Готов к запуску";
  }
  return "Нет профиля";
}

function statusStyle(state: PluginState): CSSProperties {
  if (state.connected) {
    return {
      ...statusPillBase,
      background: "rgba(22, 163, 74, 0.16)",
      color: "#86efac",
      border: "1px solid rgba(34, 197, 94, 0.32)",
    };
  }
  if (state.controller_ready) {
    return {
      ...statusPillBase,
      background: "rgba(37, 99, 235, 0.16)",
      color: "#93c5fd",
      border: "1px solid rgba(59, 130, 246, 0.32)",
    };
  }
  return {
    ...statusPillBase,
    background: "rgba(148, 163, 184, 0.12)",
    color: "#cbd5e1",
    border: "1px solid rgba(148, 163, 184, 0.2)",
  };
}

function formatTimestamp(value: string): string {
  if (!value) {
    return "ещё не обновлялось";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

function formatDelay(delay: number | null | undefined): string {
  if (delay === undefined) {
    return "не проверен";
  }
  if (delay === null) {
    return "таймаут";
  }
  return `${delay} мс`;
}

function actionButtonStyle(active: boolean): CSSProperties {
  return {
    ...smallButtonStyle,
    opacity: active ? 0.6 : 1,
    cursor: active ? "default" : "pointer",
  };
}

function Content() {
  const [state, setState] = useState<PluginState>(EMPTY_STATE);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [urlDraft, setUrlDraft] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [yamlDraft, setYamlDraft] = useState("");
  const [draftInitialized, setDraftInitialized] = useState(false);

  const applyFreshState = (nextState: PluginState, syncDraft = false) => {
    setState(nextState);
    setSelectedGroup((current) => {
      const known = nextState.groups.some((group) => group.name === current);
      if (known) {
        return current;
      }
      return nextState.active_group || nextState.groups[0]?.name || "";
    });

    if (syncDraft || !draftInitialized) {
      setUrlDraft(nextState.subscription_url || "");
      setDraftInitialized(true);
    }
  };

  const refreshUiState = async (syncDraft = false) => {
    const nextState = await getState();
    applyFreshState(nextState, syncDraft);
  };

  const runAction = async (
    actionKey: string,
    title: string,
    action: () => Promise<PluginState>,
    syncDraft = false,
  ) => {
    setBusyAction(actionKey);
    try {
      const nextState = await action();
      applyFreshState(nextState, syncDraft);
      toaster.toast({ title, body: "Готово" });
    } catch (error) {
      const body = error instanceof Error ? error.message : String(error);
      toaster.toast({ title: "Операция не удалась", body });
      await refreshUiState(false).catch(() => undefined);
    } finally {
      setBusyAction(null);
    }
  };

  useEffect(() => {
    void refreshUiState(true);
    const timer = window.setInterval(() => {
      void refreshUiState(false);
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  const currentGroup =
    state.groups.find((group) => group.name === selectedGroup) || state.groups[0];
  const currentHealth = currentGroup ? state.health[currentGroup.name] || {} : {};
  const recommendedProxy = currentGroup
    ? state.recommended_proxies[currentGroup.name]
    : undefined;

  return (
    <>
      <PanelSection>
        <PanelSectionRow>
          <div style={heroStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 0.2 }}>
                  Decky Mihomo
                </div>
                <div style={metaTextStyle}>
                  Подписка, проверка нод и переключение локаций прямо в игровом режиме.
                </div>
              </div>
              <div style={statusStyle(state)}>
                <FaTachometerAlt />
                {statusLabel(state)}
              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
              <div>
                <div style={{ ...metaTextStyle, marginBottom: 4 }}>Режим ядра</div>
                <div>{state.core_mode === "tun" ? "TUN VPN" : state.controller_ready ? "Controller only" : "Остановлено"}</div>
              </div>
              <div>
                <div style={{ ...metaTextStyle, marginBottom: 4 }}>Mihomo</div>
                <div>{state.mihomo_version || (state.binary_ready ? "готов к запуску" : "скачается при первом запуске")}</div>
              </div>
              <div>
                <div style={{ ...metaTextStyle, marginBottom: 4 }}>Последнее обновление</div>
                <div>{formatTimestamp(state.last_refreshed_at)}</div>
              </div>
            </div>

            <div style={actionRowStyle}>
              <button
                style={actionButtonStyle(busyAction !== null)}
                disabled={busyAction !== null || !state.has_profile}
                onClick={() => void runAction("connect", "VPN подключен", () => connectVpn())}
              >
                <FaPlug style={{ marginRight: 8 }} />
                Подключить
              </button>
              <button
                style={actionButtonStyle(busyAction !== null)}
                disabled={busyAction !== null || !state.connected}
                onClick={() => void runAction("disconnect", "VPN отключен", () => disconnectVpn())}
              >
                <FaPowerOff style={{ marginRight: 8 }} />
                Отключить
              </button>
              <button
                style={actionButtonStyle(busyAction !== null)}
                disabled={busyAction !== null || !currentGroup}
                onClick={() =>
                  currentGroup &&
                  void runAction(
                    "best",
                    "Выбрана лучшая доступная нода",
                    () => chooseBestProxy(currentGroup.name),
                  )
                }
              >
                <FaBolt style={{ marginRight: 8 }} />
                Найти лучшую
              </button>
            </div>
          </div>
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="Подписка">
        <PanelSectionRow>
          <div style={cardStyle}>
            <div style={{ ...metaTextStyle, marginBottom: 8 }}>
              Ссылка хранится только локально на Steam Deck. Сейчас плагин ожидает именно Clash/Mihomo YAML-подписку.
            </div>
            <input
              type="url"
              value={urlDraft}
              placeholder="https://provider.example/subscription"
              onChange={(event) => setUrlDraft(event.currentTarget.value)}
              style={inputStyle}
            />
            <div style={{ ...actionRowStyle, marginTop: 12 }}>
              <button
                style={actionButtonStyle(busyAction !== null)}
                disabled={busyAction !== null || !urlDraft.trim()}
                onClick={() =>
                  void runAction(
                    "apply-url",
                    "Подписка сохранена и обновлена",
                    () => applySubscriptionUrl(urlDraft.trim()),
                    true,
                  )
                }
              >
                <FaLink style={{ marginRight: 8 }} />
                Сохранить и обновить
              </button>
              <button
                style={actionButtonStyle(busyAction !== null)}
                disabled={busyAction !== null || !state.subscription_url}
                onClick={() =>
                  void runAction("refresh", "Подписка обновлена", () => refreshSubscription(), true)
                }
              >
                <FaSyncAlt style={{ marginRight: 8 }} />
                Обновить ещё раз
              </button>
            </div>
          </div>
        </PanelSectionRow>

        <PanelSectionRow>
          <details style={{ width: "100%" }}>
            <summary style={{ cursor: "pointer", marginBottom: 12 }}>
              Резервный импорт YAML
            </summary>
            <div style={cardStyle}>
              <textarea
                value={yamlDraft}
                onChange={(event) => setYamlDraft(event.currentTarget.value)}
                placeholder="Вставь Clash/Mihomo YAML сюда, если подписка не импортируется напрямую."
                style={textareaStyle}
              />
              <div style={{ ...actionRowStyle, marginTop: 12 }}>
                <button
                  style={actionButtonStyle(busyAction !== null)}
                  disabled={busyAction !== null || !yamlDraft.trim()}
                  onClick={() =>
                    void runAction(
                      "import-yaml",
                      "YAML импортирован",
                      async () => {
                        const nextState = await importProfileText(yamlDraft.trim());
                        setYamlDraft("");
                        return nextState;
                      },
                    )
                  }
                >
                  Импортировать YAML
                </button>
              </div>
            </div>
          </details>
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="Ноды">
        <PanelSectionRow>
          <div style={cardStyle}>
            {state.groups.length > 0 ? (
              <>
                <div style={{ ...metaTextStyle, marginBottom: 8 }}>Группа</div>
                <select
                  value={currentGroup?.name || ""}
                  onChange={(event) => setSelectedGroup(event.currentTarget.value)}
                  style={selectStyle}
                >
                  {state.groups.map((group) => (
                    <option key={group.name} value={group.name}>
                      {group.name}
                    </option>
                  ))}
                </select>

                <div style={{ ...actionRowStyle, marginTop: 12 }}>
                  <button
                    style={actionButtonStyle(busyAction !== null)}
                    disabled={busyAction !== null || !currentGroup}
                    onClick={() =>
                      currentGroup &&
                      void runAction(
                        "check-group",
                        "Проверка серверов завершена",
                        () => checkGroup(currentGroup.name),
                      )
                    }
                  >
                    Проверить серверы
                  </button>
                </div>

                <div style={{ ...metaTextStyle, marginTop: 12 }}>
                  Текущая нода: {currentGroup?.current || "не выбрана"}
                </div>
                {recommendedProxy && (
                  <div style={{ ...metaTextStyle, marginTop: 4 }}>
                    Рекомендуемая нода: {recommendedProxy}
                  </div>
                )}

                <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
                  {currentGroup?.proxies.map((proxyName) => {
                    const delay = currentHealth[proxyName];
                    const isCurrent = currentGroup.current === proxyName;
                    const isRecommended = recommendedProxy === proxyName;

                    return (
                      <div key={proxyName} style={proxyRowStyle}>
                        <div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                            <span style={{ fontWeight: 700 }}>{proxyName}</span>
                            {isCurrent && (
                              <span style={statusStyle({ ...state, connected: true, controller_ready: true })}>
                                активна
                              </span>
                            )}
                            {isRecommended && (
                              <span style={statusStyle({ ...state, connected: false, controller_ready: true })}>
                                лучшая
                              </span>
                            )}
                          </div>
                          <div style={{ ...metaTextStyle, marginTop: 6 }}>
                            Задержка: {formatDelay(delay)}
                          </div>
                        </div>
                        <button
                          style={actionButtonStyle(busyAction !== null || isCurrent)}
                          disabled={busyAction !== null || isCurrent}
                          onClick={() =>
                            currentGroup &&
                            void runAction(
                              `select-${proxyName}`,
                              "Нода выбрана",
                              () => selectProxy(currentGroup.name, proxyName),
                            )
                          }
                        >
                          {isCurrent ? "Выбрана" : "Выбрать"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div style={metaTextStyle}>
                После импорта подписки здесь появятся группы и список нод.
              </div>
            )}
          </div>
        </PanelSectionRow>

        {state.last_error && (
          <PanelSectionRow>
            <div
              style={{
                ...cardStyle,
                border: "1px solid rgba(248, 113, 113, 0.32)",
                background: "rgba(45, 12, 20, 0.86)",
                color: "#fecaca",
              }}
            >
              {state.last_error}
            </div>
          </PanelSectionRow>
        )}
      </PanelSection>
    </>
  );
}

export default definePlugin(() => {
  return {
    name: "Decky Mihomo",
    titleView: <div className={staticClasses.Title}>Decky Mihomo</div>,
    content: <Content />,
    icon: <FaGlobeEurope />,
    onDismount() {
      console.log("Decky Mihomo unloaded");
    },
  };
});

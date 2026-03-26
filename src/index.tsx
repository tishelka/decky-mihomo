import {
  ButtonItem,
  DropdownItem,
  Field,
  Navigation,
  PanelSection,
  PanelSectionRow,
  TextField,
  staticClasses,
} from "@decky/ui";
import {
  callable,
  definePlugin,
  routerHook,
  toaster,
} from "@decky/api";
import { type CSSProperties, useEffect, useState } from "react";
import {
  FaBolt,
  FaEdit,
  FaGlobeEurope,
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
  last_notice: string;
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

const EDIT_ROUTE = "/decky-mihomo/subscription";

const getState = callable<[], PluginState>("get_state");
const applySubscriptionUrl = callable<[url: string], PluginState>("apply_subscription_url");
const refreshSubscription = callable<[], PluginState>("refresh_subscription");
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
  last_notice: "",
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

const heroStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: 16,
  borderRadius: 16,
  background: "linear-gradient(160deg, rgba(16,24,40,0.95), rgba(12,18,31,0.88))",
  border: "1px solid rgba(120, 156, 219, 0.2)",
  display: "grid",
  gap: 12,
};

const heroMetaStyle: CSSProperties = {
  color: "rgba(195, 205, 225, 0.74)",
  fontSize: 12,
  lineHeight: 1.45,
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
    return "еще не обновлялось";
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

function SubscriptionEditorPage() {
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [savedValue, setSavedValue] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void getState()
      .then((nextState) => {
        if (cancelled) {
          return;
        }
        setDraft(nextState.subscription_url || "");
        setSavedValue(nextState.subscription_url || "");
        setLoaded(true);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        toaster.toast({
          title: "Не удалось загрузить настройки",
          body: error instanceof Error ? error.message : String(error),
        });
        setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const saveAndRefresh = async () => {
    setBusy(true);
    try {
      const nextState = await applySubscriptionUrl(draft.trim());
      setSavedValue(nextState.subscription_url || draft.trim());
      setDraft(nextState.subscription_url || draft.trim());
      toaster.toast({
        title: nextState.last_error
          ? "Подписка сохранена с предупреждением"
          : nextState.last_notice
            ? "Подписка сохранена в режиме совместимости"
          : "Подписка сохранена",
        body: nextState.last_error
          || nextState.last_notice
          || "Ссылка и YAML-профиль сохранены, можно возвращаться в плагин.",
      });
      Navigation.NavigateBack();
    } catch (error) {
      toaster.toast({
        title: "Не удалось сохранить подписку",
        body: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PanelSection title="Редактор подписки">
        <PanelSectionRow>
          <Field
            label="Почему это отдельная страница"
            description="Так клавиатура Steam Deck открывается поверх обычного экрана, а не конфликтует с боковой шторкой Decky."
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <Field
            label="Сейчас сохранено"
            description={savedValue || "Ссылка еще не сохранена"}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <TextField
            label="URL подписки"
            description="Вставь полную ссылку на Clash/Mihomo-подписку и затем нажми кнопку ниже."
            value={draft}
            mustBeURL
            focusOnMount
            bShowClearAction
            bAlwaysShowClearAction
            disabled={!loaded || busy}
            onChange={(event) => setDraft(event.currentTarget.value)}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            disabled={!loaded || busy || !draft.trim()}
            onClick={() => void saveAndRefresh()}
          >
            Сохранить и обновить подписку
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            disabled={busy}
            onClick={() => Navigation.NavigateBack()}
          >
            Вернуться назад
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>
    </>
  );
}

function Content() {
  const [state, setState] = useState<PluginState>(EMPTY_STATE);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [selectedProxy, setSelectedProxy] = useState("");

  const applyFreshState = (nextState: PluginState) => {
    setState(nextState);
    setSelectedGroup((current) => {
      const exists = nextState.groups.some((group) => group.name === current);
      if (exists) {
        return current;
      }
      return nextState.active_group || nextState.groups[0]?.name || "";
    });
  };

  const refreshUiState = async () => {
    const nextState = await getState();
    applyFreshState(nextState);
  };

  const runAction = async (
    actionKey: string,
    title: string,
    action: () => Promise<PluginState>,
  ) => {
    setBusyAction(actionKey);
    try {
      const nextState = await action();
      applyFreshState(nextState);
      toaster.toast({ title, body: "Готово" });
    } catch (error) {
      toaster.toast({
        title: "Операция не удалась",
        body: error instanceof Error ? error.message : String(error),
      });
      await refreshUiState().catch(() => undefined);
    } finally {
      setBusyAction(null);
    }
  };

  useEffect(() => {
    void refreshUiState();
    const timer = window.setInterval(() => {
      void refreshUiState();
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  const currentGroup = state.groups.find((group) => group.name === selectedGroup) || state.groups[0];

  useEffect(() => {
    if (!currentGroup) {
      setSelectedProxy("");
      return;
    }

    setSelectedProxy((current) => {
      if (currentGroup.proxies.includes(current)) {
        return current;
      }
      return currentGroup.current || currentGroup.proxies[0] || "";
    });
  }, [currentGroup]);

  const currentHealth = currentGroup ? state.health[currentGroup.name] || {} : {};
  const recommendedProxy = currentGroup ? state.recommended_proxies[currentGroup.name] : "";
  const currentDelay = currentGroup?.current ? currentHealth[currentGroup.current] : undefined;

  const groupOptions = state.groups.map((group) => ({
    data: group.name,
    label: group.name,
  }));

  const proxyOptions = (currentGroup?.proxies || []).map((proxyName) => {
    const delay = currentHealth[proxyName];
    const suffix =
      proxyName === currentGroup?.current
        ? " • активна"
        : proxyName === recommendedProxy
          ? " • лучшая"
          : "";

    return {
      data: proxyName,
      label: `${proxyName} • ${formatDelay(delay)}${suffix}`,
    };
  });

  const openSubscriptionEditor = () => {
    Navigation.Navigate(EDIT_ROUTE);
    Navigation.CloseSideMenus();
  };

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
                <div style={heroMetaStyle}>
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
                <div style={{ ...heroMetaStyle, marginBottom: 4 }}>Режим ядра</div>
                <div>
                  {state.core_mode === "tun"
                    ? "TUN VPN"
                    : state.controller_ready
                      ? "Controller only"
                      : "Остановлено"}
                </div>
              </div>
              <div>
                <div style={{ ...heroMetaStyle, marginBottom: 4 }}>Mihomo</div>
                <div>
                  {state.mihomo_version
                    || (state.binary_ready ? "готов к запуску" : "скачается при первом запуске")}
                </div>
              </div>
              <div>
                <div style={{ ...heroMetaStyle, marginBottom: 4 }}>Последнее обновление</div>
                <div>{formatTimestamp(state.last_refreshed_at)}</div>
              </div>
            </div>
          </div>
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="Подписка">
        <PanelSectionRow>
          <Field
            label="Текущий URL подписки"
            description={state.subscription_url || "Ссылка еще не добавлена"}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            disabled={busyAction !== null}
            onClick={openSubscriptionEditor}
          >
            <FaEdit style={{ marginRight: 8 }} />
            Открыть отдельную страницу ввода
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            disabled={busyAction !== null || !state.subscription_url}
            onClick={() =>
              void runAction("refresh", "Подписка обновлена", () => refreshSubscription())
            }
          >
            Обновить текущую подписку
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="Подключение">
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            disabled={busyAction !== null || !state.has_profile}
            onClick={() => void runAction("connect", "VPN подключен", () => connectVpn())}
          >
            <FaPlug style={{ marginRight: 8 }} />
            Подключить VPN
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            disabled={busyAction !== null || !state.connected}
            onClick={() => void runAction("disconnect", "VPN отключен", () => disconnectVpn())}
          >
            <FaPowerOff style={{ marginRight: 8 }} />
            Отключить VPN
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="Группы и ноды">
        {state.groups.length > 0 ? (
          <>
            <PanelSectionRow>
              <DropdownItem
                label="Группа"
                description="Выбери группу нод для текущей проверки и переключения."
                rgOptions={groupOptions}
                selectedOption={currentGroup?.name || ""}
                onChange={(option) => setSelectedGroup(String(option.data))}
              />
            </PanelSectionRow>

            <PanelSectionRow>
              <DropdownItem
                label="Нода"
                description="Список нод в выбранной группе. В подписи видна задержка после проверки."
                rgOptions={proxyOptions}
                selectedOption={selectedProxy}
                disabled={!currentGroup || proxyOptions.length === 0}
                onChange={(option) => setSelectedProxy(String(option.data))}
              />
            </PanelSectionRow>

            <PanelSectionRow>
              <ButtonItem
                layout="below"
                disabled={busyAction !== null || !currentGroup}
                onClick={() =>
                  currentGroup
                  && void runAction(
                    "check-group",
                    "Проверка серверов завершена",
                    () => checkGroup(currentGroup.name),
                  )
                }
              >
                <FaSyncAlt style={{ marginRight: 8 }} />
                Проверить серверы группы
              </ButtonItem>
            </PanelSectionRow>

            <PanelSectionRow>
              <ButtonItem
                layout="below"
                disabled={busyAction !== null || !currentGroup}
                onClick={() =>
                  currentGroup
                  && void runAction(
                    "best",
                    "Выбрана лучшая доступная нода",
                    () => chooseBestProxy(currentGroup.name),
                  )
                }
              >
                <FaBolt style={{ marginRight: 8 }} />
                Найти лучшую ноду
              </ButtonItem>
            </PanelSectionRow>

            <PanelSectionRow>
              <ButtonItem
                layout="below"
                disabled={busyAction !== null || !currentGroup || !selectedProxy}
                onClick={() =>
                  currentGroup
                  && selectedProxy
                  && void runAction(
                    "apply-proxy",
                    "Нода выбрана",
                    () => selectProxy(currentGroup.name, selectedProxy),
                  )
                }
              >
                Применить выбранную ноду
              </ButtonItem>
            </PanelSectionRow>

            <PanelSectionRow>
              <Field
                label="Текущая нода"
                description={currentGroup?.current || "Еще не выбрана"}
              />
            </PanelSectionRow>
            <PanelSectionRow>
              <Field
                label="Рекомендуемая нода"
                description={recommendedProxy || "Сначала запусти проверку"}
              />
            </PanelSectionRow>
            <PanelSectionRow>
              <Field
                label="Задержка текущей ноды"
                description={formatDelay(currentDelay)}
              />
            </PanelSectionRow>
          </>
        ) : (
          <PanelSectionRow>
            <Field
              label="Ноды еще не загружены"
              description="После импорта подписки здесь появятся группы и список нод."
            />
          </PanelSectionRow>
        )}

        {state.last_notice && (
          <PanelSectionRow>
            <Field
              label="Важное замечание"
              description={state.last_notice}
            />
          </PanelSectionRow>
        )}

        {state.last_error && (
          <PanelSectionRow>
            <Field
              label="Последняя ошибка"
              description={state.last_error}
            />
          </PanelSectionRow>
        )}
      </PanelSection>
    </>
  );
}

export default definePlugin(() => {
  routerHook.addRoute(EDIT_ROUTE, SubscriptionEditorPage, {
    exact: true,
  });

  return {
    name: "Decky Mihomo",
    titleView: <div className={staticClasses.Title}>Decky Mihomo</div>,
    content: <Content />,
    icon: <FaGlobeEurope />,
    onDismount() {
      routerHook.removeRoute(EDIT_ROUTE);
      console.log("Decky Mihomo unloaded");
    },
  };
});

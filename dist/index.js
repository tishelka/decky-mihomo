const manifest = {"name":"Decky Mihomo"};
const API_VERSION = 2;
const internalAPIConnection = window.__DECKY_SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED_deckyLoaderAPIInit;
if (!internalAPIConnection) {
    throw new Error('[@decky/api]: Failed to connect to the loader as as the loader API was not initialized. This is likely a bug in Decky Loader.');
}
let api;
try {
    api = internalAPIConnection.connect(API_VERSION, manifest.name);
}
catch {
    api = internalAPIConnection.connect(1, manifest.name);
    console.warn(`[@decky/api] Requested API version ${API_VERSION} but the running loader only supports version 1. Some features may not work.`);
}
if (api._version != API_VERSION) {
    console.warn(`[@decky/api] Requested API version ${API_VERSION} but the running loader only supports version ${api._version}. Some features may not work.`);
}
const callable = api.callable;
const toaster = api.toaster;
const definePlugin = (fn) => {
    return (...args) => {
        return fn(...args);
    };
};

var DefaultContext = {
  color: undefined,
  size: undefined,
  className: undefined,
  style: undefined,
  attr: undefined
};
var IconContext = SP_REACT.createContext && /*#__PURE__*/SP_REACT.createContext(DefaultContext);

var _excluded = ["attr", "size", "title"];
function _objectWithoutProperties(e, t) { if (null == e) return {}; var o, r, i = _objectWithoutPropertiesLoose(e, t); if (Object.getOwnPropertySymbols) { var n = Object.getOwnPropertySymbols(e); for (r = 0; r < n.length; r++) o = n[r], -1 === t.indexOf(o) && {}.propertyIsEnumerable.call(e, o) && (i[o] = e[o]); } return i; }
function _objectWithoutPropertiesLoose(r, e) { if (null == r) return {}; var t = {}; for (var n in r) if ({}.hasOwnProperty.call(r, n)) { if (-1 !== e.indexOf(n)) continue; t[n] = r[n]; } return t; }
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), true).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: true, configurable: true, writable: true }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function Tree2Element(tree) {
  return tree && tree.map((node, i) => /*#__PURE__*/SP_REACT.createElement(node.tag, _objectSpread({
    key: i
  }, node.attr), Tree2Element(node.child)));
}
function GenIcon(data) {
  return props => /*#__PURE__*/SP_REACT.createElement(IconBase, _extends({
    attr: _objectSpread({}, data.attr)
  }, props), Tree2Element(data.child));
}
function IconBase(props) {
  var elem = conf => {
    var {
        attr,
        size,
        title
      } = props,
      svgProps = _objectWithoutProperties(props, _excluded);
    var computedSize = size || conf.size || "1em";
    var className;
    if (conf.className) className = conf.className;
    if (props.className) className = (className ? className + " " : "") + props.className;
    return /*#__PURE__*/SP_REACT.createElement("svg", _extends({
      stroke: "currentColor",
      fill: "currentColor",
      strokeWidth: "0"
    }, conf.attr, attr, svgProps, {
      className: className,
      style: _objectSpread(_objectSpread({
        color: props.color || conf.color
      }, conf.style), props.style),
      height: computedSize,
      width: computedSize,
      xmlns: "http://www.w3.org/2000/svg"
    }), title && /*#__PURE__*/SP_REACT.createElement("title", null, title), props.children);
  };
  return IconContext !== undefined ? /*#__PURE__*/SP_REACT.createElement(IconContext.Consumer, null, conf => elem(conf)) : elem(DefaultContext);
}

// THIS FILE IS AUTO GENERATED
function FaTachometerAlt (props) {
  return GenIcon({"attr":{"viewBox":"0 0 576 512"},"child":[{"tag":"path","attr":{"d":"M288 32C128.94 32 0 160.94 0 320c0 52.8 14.25 102.26 39.06 144.8 5.61 9.62 16.3 15.2 27.44 15.2h443c11.14 0 21.83-5.58 27.44-15.2C561.75 422.26 576 372.8 576 320c0-159.06-128.94-288-288-288zm0 64c14.71 0 26.58 10.13 30.32 23.65-1.11 2.26-2.64 4.23-3.45 6.67l-9.22 27.67c-5.13 3.49-10.97 6.01-17.64 6.01-17.67 0-32-14.33-32-32S270.33 96 288 96zM96 384c-17.67 0-32-14.33-32-32s14.33-32 32-32 32 14.33 32 32-14.33 32-32 32zm48-160c-17.67 0-32-14.33-32-32s14.33-32 32-32 32 14.33 32 32-14.33 32-32 32zm246.77-72.41l-61.33 184C343.13 347.33 352 364.54 352 384c0 11.72-3.38 22.55-8.88 32H232.88c-5.5-9.45-8.88-20.28-8.88-32 0-33.94 26.5-61.43 59.9-63.59l61.34-184.01c4.17-12.56 17.73-19.45 30.36-15.17 12.57 4.19 19.35 17.79 15.17 30.36zm14.66 57.2l15.52-46.55c3.47-1.29 7.13-2.23 11.05-2.23 17.67 0 32 14.33 32 32s-14.33 32-32 32c-11.38-.01-20.89-6.28-26.57-15.22zM480 384c-17.67 0-32-14.33-32-32s14.33-32 32-32 32 14.33 32 32-14.33 32-32 32z"},"child":[]}]})(props);
}function FaSyncAlt (props) {
  return GenIcon({"attr":{"viewBox":"0 0 512 512"},"child":[{"tag":"path","attr":{"d":"M370.72 133.28C339.458 104.008 298.888 87.962 255.848 88c-77.458.068-144.328 53.178-162.791 126.85-1.344 5.363-6.122 9.15-11.651 9.15H24.103c-7.498 0-13.194-6.807-11.807-14.176C33.933 94.924 134.813 8 256 8c66.448 0 126.791 26.136 171.315 68.685L463.03 40.97C478.149 25.851 504 36.559 504 57.941V192c0 13.255-10.745 24-24 24H345.941c-21.382 0-32.09-25.851-16.971-40.971l41.75-41.749zM32 296h134.059c21.382 0 32.09 25.851 16.971 40.971l-41.75 41.75c31.262 29.273 71.835 45.319 114.876 45.28 77.418-.07 144.315-53.144 162.787-126.849 1.344-5.363 6.122-9.15 11.651-9.15h57.304c7.498 0 13.194 6.807 11.807 14.176C478.067 417.076 377.187 504 256 504c-66.448 0-126.791-26.136-171.315-68.685L48.97 471.03C33.851 486.149 8 475.441 8 454.059V320c0-13.255 10.745-24 24-24z"},"child":[]}]})(props);
}function FaPowerOff (props) {
  return GenIcon({"attr":{"viewBox":"0 0 512 512"},"child":[{"tag":"path","attr":{"d":"M400 54.1c63 45 104 118.6 104 201.9 0 136.8-110.8 247.7-247.5 248C120 504.3 8.2 393 8 256.4 7.9 173.1 48.9 99.3 111.8 54.2c11.7-8.3 28-4.8 35 7.7L162.6 90c5.9 10.5 3.1 23.8-6.6 31-41.5 30.8-68 79.6-68 134.9-.1 92.3 74.5 168.1 168 168.1 91.6 0 168.6-74.2 168-169.1-.3-51.8-24.7-101.8-68.1-134-9.7-7.2-12.4-20.5-6.5-30.9l15.8-28.1c7-12.4 23.2-16.1 34.8-7.8zM296 264V24c0-13.3-10.7-24-24-24h-32c-13.3 0-24 10.7-24 24v240c0 13.3 10.7 24 24 24h32c13.3 0 24-10.7 24-24z"},"child":[]}]})(props);
}function FaPlug (props) {
  return GenIcon({"attr":{"viewBox":"0 0 384 512"},"child":[{"tag":"path","attr":{"d":"M320,32a32,32,0,0,0-64,0v96h64Zm48,128H16A16,16,0,0,0,0,176v32a16,16,0,0,0,16,16H32v32A160.07,160.07,0,0,0,160,412.8V512h64V412.8A160.07,160.07,0,0,0,352,256V224h16a16,16,0,0,0,16-16V176A16,16,0,0,0,368,160ZM128,32a32,32,0,0,0-64,0v96h64Z"},"child":[]}]})(props);
}function FaGlobeEurope (props) {
  return GenIcon({"attr":{"viewBox":"0 0 496 512"},"child":[{"tag":"path","attr":{"d":"M248 8C111 8 0 119 0 256s111 248 248 248 248-111 248-248S385 8 248 8zm200 248c0 22.5-3.9 44.2-10.8 64.4h-20.3c-4.3 0-8.4-1.7-11.4-4.8l-32-32.6c-4.5-4.6-4.5-12.1.1-16.7l12.5-12.5v-8.7c0-3-1.2-5.9-3.3-8l-9.4-9.4c-2.1-2.1-5-3.3-8-3.3h-16c-6.2 0-11.3-5.1-11.3-11.3 0-3 1.2-5.9 3.3-8l9.4-9.4c2.1-2.1 5-3.3 8-3.3h32c6.2 0 11.3-5.1 11.3-11.3v-9.4c0-6.2-5.1-11.3-11.3-11.3h-36.7c-8.8 0-16 7.2-16 16v4.5c0 6.9-4.4 13-10.9 15.2l-31.6 10.5c-3.3 1.1-5.5 4.1-5.5 7.6v2.2c0 4.4-3.6 8-8 8h-16c-4.4 0-8-3.6-8-8s-3.6-8-8-8H247c-3 0-5.8 1.7-7.2 4.4l-9.4 18.7c-2.7 5.4-8.2 8.8-14.3 8.8H194c-8.8 0-16-7.2-16-16V199c0-4.2 1.7-8.3 4.7-11.3l20.1-20.1c4.6-4.6 7.2-10.9 7.2-17.5 0-3.4 2.2-6.5 5.5-7.6l40-13.3c1.7-.6 3.2-1.5 4.4-2.7l26.8-26.8c2.1-2.1 3.3-5 3.3-8 0-6.2-5.1-11.3-11.3-11.3H258l-16 16v8c0 4.4-3.6 8-8 8h-16c-4.4 0-8-3.6-8-8v-20c0-2.5 1.2-4.9 3.2-6.4l28.9-21.7c1.9-.1 3.8-.3 5.7-.3C358.3 56 448 145.7 448 256zM130.1 149.1c0-3 1.2-5.9 3.3-8l25.4-25.4c2.1-2.1 5-3.3 8-3.3 6.2 0 11.3 5.1 11.3 11.3v16c0 3-1.2 5.9-3.3 8l-9.4 9.4c-2.1 2.1-5 3.3-8 3.3h-16c-6.2 0-11.3-5.1-11.3-11.3zm128 306.4v-7.1c0-8.8-7.2-16-16-16h-20.2c-10.8 0-26.7-5.3-35.4-11.8l-22.2-16.7c-11.5-8.6-18.2-22.1-18.2-36.4v-23.9c0-16 8.4-30.8 22.1-39l42.9-25.7c7.1-4.2 15.2-6.5 23.4-6.5h31.2c10.9 0 21.4 3.9 29.6 10.9l43.2 37.1h18.3c8.5 0 16.6 3.4 22.6 9.4l17.3 17.3c3.4 3.4 8.1 5.3 12.9 5.3H423c-32.4 58.9-93.8 99.5-164.9 103.1z"},"child":[]}]})(props);
}function FaEdit (props) {
  return GenIcon({"attr":{"viewBox":"0 0 576 512"},"child":[{"tag":"path","attr":{"d":"M402.6 83.2l90.2 90.2c3.8 3.8 3.8 10 0 13.8L274.4 405.6l-92.8 10.3c-12.4 1.4-22.9-9.1-21.5-21.5l10.3-92.8L388.8 83.2c3.8-3.8 10-3.8 13.8 0zm162-22.9l-48.8-48.8c-15.2-15.2-39.9-15.2-55.2 0l-35.4 35.4c-3.8 3.8-3.8 10 0 13.8l90.2 90.2c3.8 3.8 10 3.8 13.8 0l35.4-35.4c15.2-15.3 15.2-40 0-55.2zM384 346.2V448H64V128h229.8c3.2 0 6.2-1.3 8.5-3.5l40-40c7.6-7.6 2.2-20.5-8.5-20.5H48C21.5 64 0 85.5 0 112v352c0 26.5 21.5 48 48 48h352c26.5 0 48-21.5 48-48V306.2c0-10.7-12.9-16-20.5-8.5l-40 40c-2.2 2.3-3.5 5.3-3.5 8.5z"},"child":[]}]})(props);
}function FaBolt (props) {
  return GenIcon({"attr":{"viewBox":"0 0 320 512"},"child":[{"tag":"path","attr":{"d":"M296 160H180.6l42.6-129.8C227.2 15 215.7 0 200 0H56C44 0 33.8 8.9 32.2 20.8l-32 240C-1.7 275.2 9.5 288 24 288h118.7L96.6 482.5c-3.6 15.2 8 29.5 23.3 29.5 8.4 0 16.4-4.4 20.8-12l176-304c9.3-15.9-2.2-36-20.7-36z"},"child":[]}]})(props);
}

const getState = callable("get_state");
const applySubscriptionUrl = callable("apply_subscription_url");
const refreshSubscription = callable("refresh_subscription");
const connectVpn = callable("connect");
const disconnectVpn = callable("disconnect");
const selectProxy = callable("select_proxy");
const checkGroup = callable("check_group");
const chooseBestProxy = callable("choose_best_proxy");
const EMPTY_STATE = {
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
const heroStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: 16,
    borderRadius: 16,
    background: "linear-gradient(160deg, rgba(16,24,40,0.95), rgba(12,18,31,0.88))",
    border: "1px solid rgba(120, 156, 219, 0.2)",
    display: "grid",
    gap: 12,
};
const heroMetaStyle = {
    color: "rgba(195, 205, 225, 0.74)",
    fontSize: 12,
    lineHeight: 1.45,
};
const statusPillBase = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    padding: "8px 12px",
    fontSize: 12,
    fontWeight: 700,
};
function statusLabel(state) {
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
function statusStyle(state) {
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
function formatTimestamp(value) {
    if (!value) {
        return "еще не обновлялось";
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return value;
    }
    return parsed.toLocaleString();
}
function formatDelay(delay) {
    if (delay === undefined) {
        return "не проверен";
    }
    if (delay === null) {
        return "таймаут";
    }
    return `${delay} мс`;
}
function SubscriptionUrlModal(props) {
    const [value, setValue] = SP_REACT.useState(props.initialValue);
    return (SP_JSX.jsx(DFL.ConfirmModal, { strTitle: "URL \u043F\u043E\u0434\u043F\u0438\u0441\u043A\u0438", strDescription: "\u041E\u043A\u043D\u043E \u0432\u0432\u043E\u0434\u0430 \u043E\u0442\u043A\u0440\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u043C modal, \u0447\u0442\u043E\u0431\u044B \u044D\u043A\u0440\u0430\u043D\u043D\u0430\u044F \u043A\u043B\u0430\u0432\u0438\u0430\u0442\u0443\u0440\u0430 Steam Deck \u0440\u0430\u0431\u043E\u0442\u0430\u043B\u0430 \u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u043E \u0438 \u043D\u0435 \u043F\u0440\u044F\u0442\u0430\u043B\u0430\u0441\u044C \u043F\u043E\u0434 \u0431\u043E\u043A\u043E\u0432\u043E\u0439 \u0448\u0442\u043E\u0440\u043A\u043E\u0439.", strOKButtonText: "\u0413\u043E\u0442\u043E\u0432\u043E", strCancelButtonText: "\u041E\u0442\u043C\u0435\u043D\u0430", bAllowFullSize: true, onCancel: props.closeModal, onOK: () => {
            props.onSave(value.trim());
            props.closeModal();
        }, children: SP_JSX.jsx(DFL.TextField, { label: "Clash/Mihomo subscription URL", description: "\u0412\u0441\u0442\u0430\u0432\u044C \u0441\u0441\u044B\u043B\u043A\u0443 \u043F\u043E\u043B\u043D\u043E\u0441\u0442\u044C\u044E. \u041F\u043E\u0441\u043B\u0435 \u0437\u0430\u043A\u0440\u044B\u0442\u0438\u044F \u043C\u043E\u0434\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u043E\u043A\u043D\u0430 \u043D\u0430\u0436\u043C\u0438 \u043D\u0438\u0436\u0435 \u043A\u043D\u043E\u043F\u043A\u0443 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u0438 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F.", value: value, mustBeURL: true, focusOnMount: true, bShowClearAction: true, bAlwaysShowClearAction: true, onChange: (event) => setValue(event.currentTarget.value) }) }));
}
function Content() {
    const [state, setState] = SP_REACT.useState(EMPTY_STATE);
    const [busyAction, setBusyAction] = SP_REACT.useState(null);
    const [urlDraft, setUrlDraft] = SP_REACT.useState("");
    const [selectedGroup, setSelectedGroup] = SP_REACT.useState("");
    const [selectedProxy, setSelectedProxy] = SP_REACT.useState("");
    const [draftInitialized, setDraftInitialized] = SP_REACT.useState(false);
    const applyFreshState = (nextState, syncDraft = false) => {
        setState(nextState);
        setSelectedGroup((current) => {
            const exists = nextState.groups.some((group) => group.name === current);
            if (exists) {
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
    const runAction = async (actionKey, title, action, syncDraft = false) => {
        setBusyAction(actionKey);
        try {
            const nextState = await action();
            applyFreshState(nextState, syncDraft);
            toaster.toast({ title, body: "Готово" });
        }
        catch (error) {
            const body = error instanceof Error ? error.message : String(error);
            toaster.toast({ title: "Операция не удалась", body });
            await refreshUiState(false).catch(() => undefined);
        }
        finally {
            setBusyAction(null);
        }
    };
    SP_REACT.useEffect(() => {
        void refreshUiState(true);
        const timer = window.setInterval(() => {
            void refreshUiState(false);
        }, 5000);
        return () => window.clearInterval(timer);
    }, []);
    const currentGroup = state.groups.find((group) => group.name === selectedGroup) || state.groups[0];
    SP_REACT.useEffect(() => {
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
        const suffix = proxyName === currentGroup?.current
            ? " • активна"
            : proxyName === recommendedProxy
                ? " • лучшая"
                : "";
        return {
            data: proxyName,
            label: `${proxyName} • ${formatDelay(delay)}${suffix}`,
        };
    });
    const openSubscriptionModal = () => {
        let modalHandle;
        modalHandle = DFL.showModal(SP_JSX.jsx(SubscriptionUrlModal, { initialValue: urlDraft, closeModal: () => modalHandle?.Close(), onSave: (nextValue) => setUrlDraft(nextValue) }), window, {
            strTitle: "Decky Mihomo",
            bForcePopOut: true,
            bHideMainWindowForPopouts: true,
            popupWidth: 900,
            popupHeight: 720,
        });
    };
    return (SP_JSX.jsxs(SP_JSX.Fragment, { children: [SP_JSX.jsx(DFL.PanelSection, { children: SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsxs("div", { style: heroStyle, children: [SP_JSX.jsxs("div", { style: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }, children: [SP_JSX.jsxs("div", { children: [SP_JSX.jsx("div", { style: { fontSize: 22, fontWeight: 800, letterSpacing: 0.2 }, children: "Decky Mihomo" }), SP_JSX.jsx("div", { style: heroMetaStyle, children: "\u041F\u043E\u0434\u043F\u0438\u0441\u043A\u0430, \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043D\u043E\u0434 \u0438 \u043F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u043B\u043E\u043A\u0430\u0446\u0438\u0439 \u043F\u0440\u044F\u043C\u043E \u0432 \u0438\u0433\u0440\u043E\u0432\u043E\u043C \u0440\u0435\u0436\u0438\u043C\u0435." })] }), SP_JSX.jsxs("div", { style: statusStyle(state), children: [SP_JSX.jsx(FaTachometerAlt, {}), statusLabel(state)] })] }), SP_JSX.jsxs("div", { style: { display: "flex", flexWrap: "wrap", gap: 18 }, children: [SP_JSX.jsxs("div", { children: [SP_JSX.jsx("div", { style: { ...heroMetaStyle, marginBottom: 4 }, children: "\u0420\u0435\u0436\u0438\u043C \u044F\u0434\u0440\u0430" }), SP_JSX.jsx("div", { children: state.core_mode === "tun"
                                                    ? "TUN VPN"
                                                    : state.controller_ready
                                                        ? "Controller only"
                                                        : "Остановлено" })] }), SP_JSX.jsxs("div", { children: [SP_JSX.jsx("div", { style: { ...heroMetaStyle, marginBottom: 4 }, children: "Mihomo" }), SP_JSX.jsx("div", { children: state.mihomo_version
                                                    || (state.binary_ready ? "готов к запуску" : "скачается при первом запуске") })] }), SP_JSX.jsxs("div", { children: [SP_JSX.jsx("div", { style: { ...heroMetaStyle, marginBottom: 4 }, children: "\u041F\u043E\u0441\u043B\u0435\u0434\u043D\u0435\u0435 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435" }), SP_JSX.jsx("div", { children: formatTimestamp(state.last_refreshed_at) })] })] })] }) }) }), SP_JSX.jsxs(DFL.PanelSection, { title: "\u041F\u043E\u0434\u043F\u0438\u0441\u043A\u0430", children: [SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.Field, { label: "\u0422\u0435\u043A\u0443\u0449\u0438\u0439 URL \u043F\u043E\u0434\u043F\u0438\u0441\u043A\u0438", description: urlDraft || "Ссылка еще не добавлена" }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsxs(DFL.ButtonItem, { layout: "below", disabled: busyAction !== null, onClick: openSubscriptionModal, children: [SP_JSX.jsx(FaEdit, { style: { marginRight: 8 } }), "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043E\u043A\u043D\u043E \u0432\u0432\u043E\u0434\u0430 \u0441\u0441\u044B\u043B\u043A\u0438"] }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", disabled: busyAction !== null || !urlDraft.trim(), onClick: () => void runAction("apply-url", "Подписка сохранена и обновлена", () => applySubscriptionUrl(urlDraft.trim()), true), children: "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0438 \u043E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u043F\u043E\u0434\u043F\u0438\u0441\u043A\u0443" }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", disabled: busyAction !== null || !state.subscription_url, onClick: () => void runAction("refresh", "Подписка обновлена", () => refreshSubscription(), true), children: "\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u0442\u0435\u043A\u0443\u0449\u0443\u044E \u043F\u043E\u0434\u043F\u0438\u0441\u043A\u0443" }) })] }), SP_JSX.jsxs(DFL.PanelSection, { title: "\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435", children: [SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsxs(DFL.ButtonItem, { layout: "below", disabled: busyAction !== null || !state.has_profile, onClick: () => void runAction("connect", "VPN подключен", () => connectVpn()), children: [SP_JSX.jsx(FaPlug, { style: { marginRight: 8 } }), "\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u044C VPN"] }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsxs(DFL.ButtonItem, { layout: "below", disabled: busyAction !== null || !state.connected, onClick: () => void runAction("disconnect", "VPN отключен", () => disconnectVpn()), children: [SP_JSX.jsx(FaPowerOff, { style: { marginRight: 8 } }), "\u041E\u0442\u043A\u043B\u044E\u0447\u0438\u0442\u044C VPN"] }) })] }), SP_JSX.jsxs(DFL.PanelSection, { title: "\u0413\u0440\u0443\u043F\u043F\u044B \u0438 \u043D\u043E\u0434\u044B", children: [state.groups.length > 0 ? (SP_JSX.jsxs(SP_JSX.Fragment, { children: [SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.DropdownItem, { label: "\u0413\u0440\u0443\u043F\u043F\u0430", description: "\u0412\u044B\u0431\u0435\u0440\u0438 \u0433\u0440\u0443\u043F\u043F\u0443 \u043D\u043E\u0434 \u0434\u043B\u044F \u0442\u0435\u043A\u0443\u0449\u0435\u0439 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 \u0438 \u043F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F.", rgOptions: groupOptions, selectedOption: currentGroup?.name || "", onChange: (option) => setSelectedGroup(String(option.data)) }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.DropdownItem, { label: "\u041D\u043E\u0434\u0430", description: "\u0421\u043F\u0438\u0441\u043E\u043A \u043D\u043E\u0434 \u0432 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u0439 \u0433\u0440\u0443\u043F\u043F\u0435. \u0412 \u043F\u043E\u0434\u043F\u0438\u0441\u0438 \u0432\u0438\u0434\u043D\u0430 \u0437\u0430\u0434\u0435\u0440\u0436\u043A\u0430 \u043F\u043E\u0441\u043B\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438.", rgOptions: proxyOptions, selectedOption: selectedProxy, disabled: !currentGroup || proxyOptions.length === 0, onChange: (option) => setSelectedProxy(String(option.data)) }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsxs(DFL.ButtonItem, { layout: "below", disabled: busyAction !== null || !currentGroup, onClick: () => currentGroup
                                        && void runAction("check-group", "Проверка серверов завершена", () => checkGroup(currentGroup.name)), children: [SP_JSX.jsx(FaSyncAlt, { style: { marginRight: 8 } }), "\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u0441\u0435\u0440\u0432\u0435\u0440\u044B \u0433\u0440\u0443\u043F\u043F\u044B"] }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsxs(DFL.ButtonItem, { layout: "below", disabled: busyAction !== null || !currentGroup, onClick: () => currentGroup
                                        && void runAction("best", "Выбрана лучшая доступная нода", () => chooseBestProxy(currentGroup.name)), children: [SP_JSX.jsx(FaBolt, { style: { marginRight: 8 } }), "\u041D\u0430\u0439\u0442\u0438 \u043B\u0443\u0447\u0448\u0443\u044E \u043D\u043E\u0434\u0443"] }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", disabled: busyAction !== null || !currentGroup || !selectedProxy, onClick: () => currentGroup
                                        && selectedProxy
                                        && void runAction("apply-proxy", "Нода выбрана", () => selectProxy(currentGroup.name, selectedProxy)), children: "\u041F\u0440\u0438\u043C\u0435\u043D\u0438\u0442\u044C \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u0443\u044E \u043D\u043E\u0434\u0443" }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.Field, { label: "\u0422\u0435\u043A\u0443\u0449\u0430\u044F \u043D\u043E\u0434\u0430", description: currentGroup?.current || "Еще не выбрана" }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.Field, { label: "\u0420\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0443\u0435\u043C\u0430\u044F \u043D\u043E\u0434\u0430", description: recommendedProxy || "Сначала запусти проверку" }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.Field, { label: "\u0417\u0430\u0434\u0435\u0440\u0436\u043A\u0430 \u0442\u0435\u043A\u0443\u0449\u0435\u0439 \u043D\u043E\u0434\u044B", description: formatDelay(currentDelay) }) })] })) : (SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.Field, { label: "\u041D\u043E\u0434\u044B \u0435\u0449\u0435 \u043D\u0435 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D\u044B", description: "\u041F\u043E\u0441\u043B\u0435 \u0438\u043C\u043F\u043E\u0440\u0442\u0430 \u043F\u043E\u0434\u043F\u0438\u0441\u043A\u0438 \u0437\u0434\u0435\u0441\u044C \u043F\u043E\u044F\u0432\u044F\u0442\u0441\u044F \u0433\u0440\u0443\u043F\u043F\u044B \u0438 \u0441\u043F\u0438\u0441\u043E\u043A \u043D\u043E\u0434." }) })), state.last_error && (SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.Field, { label: "\u041F\u043E\u0441\u043B\u0435\u0434\u043D\u044F\u044F \u043E\u0448\u0438\u0431\u043A\u0430", description: state.last_error }) }))] })] }));
}
var index = definePlugin(() => {
    return {
        name: "Decky Mihomo",
        titleView: SP_JSX.jsx("div", { className: DFL.staticClasses.Title, children: "Decky Mihomo" }),
        content: SP_JSX.jsx(Content, {}),
        icon: SP_JSX.jsx(FaGlobeEurope, {}),
        onDismount() {
            console.log("Decky Mihomo unloaded");
        },
    };
});

export { index as default };
//# sourceMappingURL=index.js.map

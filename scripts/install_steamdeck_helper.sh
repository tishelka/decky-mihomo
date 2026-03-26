#!/usr/bin/env bash
set -euo pipefail

PLUGIN_SLUG="${PLUGIN_SLUG:-decky-mihomo}"
DECK_USER="${DECK_USER:-${SUDO_USER:-deck}}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this script with sudo:"
  echo "  sudo bash $0"
  exit 1
fi

if ! id -u "${DECK_USER}" >/dev/null 2>&1; then
  echo "User '${DECK_USER}' does not exist."
  exit 1
fi

PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DECK_HOME="$(getent passwd "${DECK_USER}" | cut -d: -f6)"
SETTINGS_ROOT="${SETTINGS_ROOT:-${DECK_HOME}/homebrew/settings}"
STABLE_SETTINGS_DIR="${STABLE_SETTINGS_DIR:-${SETTINGS_ROOT}/${PLUGIN_SLUG}}"
BIN_DIR="${STABLE_SETTINGS_DIR}/bin"
LOG_DIR="${STABLE_SETTINGS_DIR}/logs"
BINARY_PATH="${BIN_DIR}/mihomo"
CONFIG_PATH="${STABLE_SETTINGS_DIR}/mihomo-managed.yaml"
LOG_PATH="${LOG_DIR}/mihomo.log"
SERVICE_NAME="${PLUGIN_SLUG}.service"
SERVICE_PATH="/etc/systemd/system/${SERVICE_NAME}"
SUDOERS_PATH="/etc/sudoers.d/${PLUGIN_SLUG}"
SYSTEMCTL_PATH="$(command -v systemctl)"
VISUDO_PATH="$(command -v visudo || true)"

if [[ -z "${SYSTEMCTL_PATH}" ]]; then
  echo "systemctl was not found."
  exit 1
fi

install -d -m 0755 -o "${DECK_USER}" -g "${DECK_USER}" "${STABLE_SETTINGS_DIR}" "${BIN_DIR}" "${LOG_DIR}"
chown -R "${DECK_USER}:${DECK_USER}" "${STABLE_SETTINGS_DIR}"
touch "${LOG_PATH}"
chown root:root "${LOG_PATH}"
chmod 0644 "${LOG_PATH}"

cat >"${SERVICE_PATH}" <<EOF
[Unit]
Description=Decky Mihomo privileged tunnel helper
After=network-online.target NetworkManager.service systemd-networkd.service iwd.service
Wants=network-online.target

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=${STABLE_SETTINGS_DIR}
UMask=0022
LimitNPROC=512
LimitNOFILE=1048576
CapabilityBoundingSet=CAP_NET_ADMIN CAP_NET_RAW CAP_NET_BIND_SERVICE CAP_SYS_TIME CAP_SYS_PTRACE CAP_DAC_READ_SEARCH CAP_DAC_OVERRIDE
AmbientCapabilities=CAP_NET_ADMIN CAP_NET_RAW CAP_NET_BIND_SERVICE CAP_SYS_TIME CAP_SYS_PTRACE CAP_DAC_READ_SEARCH CAP_DAC_OVERRIDE
NoNewPrivileges=no
ExecStartPre=/usr/bin/test -x ${BINARY_PATH}
ExecStartPre=/usr/bin/test -f ${CONFIG_PATH}
ExecStart=${BINARY_PATH} -d ${STABLE_SETTINGS_DIR} -f ${CONFIG_PATH}
ExecReload=/bin/kill -HUP \$MAINPID
Restart=on-failure
RestartSec=2
StandardOutput=append:${LOG_PATH}
StandardError=append:${LOG_PATH}

[Install]
WantedBy=multi-user.target
EOF

cat >"${SUDOERS_PATH}" <<EOF
${DECK_USER} ALL=(root) NOPASSWD: ${SYSTEMCTL_PATH} start ${SERVICE_NAME}
${DECK_USER} ALL=(root) NOPASSWD: ${SYSTEMCTL_PATH} stop ${SERVICE_NAME}
${DECK_USER} ALL=(root) NOPASSWD: ${SYSTEMCTL_PATH} restart ${SERVICE_NAME}
${DECK_USER} ALL=(root) NOPASSWD: ${SYSTEMCTL_PATH} is-active ${SERVICE_NAME}
${DECK_USER} ALL=(root) NOPASSWD: ${SYSTEMCTL_PATH} show ${SERVICE_NAME}
EOF

chmod 0440 "${SUDOERS_PATH}"
if [[ -n "${VISUDO_PATH}" ]]; then
  "${VISUDO_PATH}" -cf "${SUDOERS_PATH}"
fi

"${SYSTEMCTL_PATH}" daemon-reload
"${SYSTEMCTL_PATH}" stop "${SERVICE_NAME}" >/dev/null 2>&1 || true
"${SYSTEMCTL_PATH}" reset-failed "${SERVICE_NAME}" >/dev/null 2>&1 || true

cat <<EOF
Helper installed.

Plugin dir: ${PLUGIN_DIR}
Stable settings dir: ${STABLE_SETTINGS_DIR}
Binary path: ${BINARY_PATH}
Config path: ${CONFIG_PATH}
Service: ${SERVICE_NAME}
Unit: ${SERVICE_PATH}
Sudoers: ${SUDOERS_PATH}

Next steps:
1. Return to Game Mode or restart Steam / Decky Loader.
2. Open Decky Mihomo.
3. Add or refresh the subscription if needed.
4. Press "Подключить VPN".
EOF

from __future__ import annotations

import asyncio
import base64
import getpass
import gzip
import json
import os
import re
import secrets
import shutil
import socket
import ssl
import stat
import subprocess
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import decky

CONTROLLER_HOST = "127.0.0.1"
CONTROLLER_PORT = 16753
HEALTHCHECK_URLS = (
    "http://www.gstatic.com/generate_204",
    "https://www.gstatic.com/generate_204",
    "http://www.msftconnecttest.com/connecttest.txt",
    "http://captive.apple.com/hotspot-detect.html",
)
HEALTHCHECK_TIMEOUT_MS = 8000
MIHOMO_RELEASE_API = "https://api.github.com/repos/MetaCubeX/mihomo/releases/latest"
SUBSCRIPTION_USER_AGENTS = (
    "clash-verge/1.7.7",
    "Clash",
    "Mihomo",
    "DeckyMihomo/0.1 (+https://github.com/SteamDeckHomebrew/decky-loader)",
)
SYSTEM_CA_BUNDLE_CANDIDATES = (
    "/etc/ssl/certs/ca-certificates.crt",
    "/etc/ca-certificates/extracted/tls-ca-bundle.pem",
    "/etc/pki/tls/certs/ca-bundle.crt",
    "/etc/ssl/cert.pem",
)
MANAGED_TOP_LEVEL_KEYS = {
    "bind-address",
    "external-controller",
    "find-process-mode",
    "profile",
    "secret",
    "tun",
}
GROUP_TYPES = {"Selector", "URLTest", "Fallback", "LoadBalance", "Relay"}
SPECIAL_PROXY_NAMES = {"DIRECT", "REJECT", "REJECT-DROP", "PASS", "COMPATIBLE"}


class Plugin:
    async def _main(self) -> None:
        self.loop = asyncio.get_event_loop()
        self.process: asyncio.subprocess.Process | None = None
        self.process_mode: str | None = None
        self.process_log_handle = None
        self.proxy_index: dict[str, dict[str, Any]] = {}
        self.controller_secret = secrets.token_urlsafe(24)
        self.plugin_dir = Path(decky.DECKY_PLUGIN_DIR)
        self.legacy_settings_dir = Path(decky.DECKY_PLUGIN_SETTINGS_DIR)
        self.plugin_slug, self.plugin_version = self._read_plugin_metadata()
        self.settings_dir = self._resolve_stable_settings_dir(self.legacy_settings_dir)
        self.runtime_dir = self.settings_dir
        self.log_dir = self.settings_dir / "logs"
        self.state_path = self.settings_dir / "state.json"
        self.profile_source_path = self.settings_dir / "subscription.yaml"
        self.managed_config_path = self.runtime_dir / "mihomo-managed.yaml"
        self.runtime_bin_dir = self.settings_dir / "bin"
        self.runtime_mihomo_path = self.runtime_bin_dir / "mihomo"
        self.mihomo_log_path = self.log_dir / "mihomo.log"
        self.diagnostics_path = self.log_dir / "diagnostics.txt"
        self.tun_helper_script_path = self.plugin_dir / "scripts" / "install_steamdeck_helper.sh"
        self.service_control_path = Path("/usr/local/bin") / f"{self.plugin_slug}-servicectl"
        self.service_name = f"{self.plugin_slug}.service"
        self.service_unit_path = Path("/etc/systemd/system") / self.service_name
        self.sudoers_path = Path("/etc/sudoers.d") / self.plugin_slug
        self._ensure_directories()
        self._migrate_legacy_settings()
        self.state = self._load_state()
        self.state["last_error"] = ""
        self._save_state()
        decky.logger.info("Decky Mihomo initialized")

    async def _unload(self) -> None:
        await self._stop_core()
        decky.logger.info("Decky Mihomo unloaded")

    async def _uninstall(self) -> None:
        await self._stop_core()
        decky.logger.info("Decky Mihomo uninstalled")

    async def _migration(self) -> None:
        decky.logger.info("No migrations required")

    def _read_plugin_metadata(self) -> tuple[str, str]:
        package_path = self.plugin_dir / "package.json"
        if not package_path.exists():
            return "decky-mihomo", "0.0.0"

        try:
            package_data = json.loads(package_path.read_text(encoding="utf-8"))
        except Exception:
            return "decky-mihomo", "0.0.0"

        name = package_data.get("name")
        version = package_data.get("version")
        safe_name = name.strip() if isinstance(name, str) and name.strip() else "decky-mihomo"
        safe_version = version.strip() if isinstance(version, str) and version.strip() else "0.0.0"
        return safe_name, safe_version

    def _resolve_stable_settings_dir(self, legacy_dir: Path) -> Path:
        parent = legacy_dir.parent
        if not str(parent):
            return legacy_dir
        return parent / self.plugin_slug

    def _migrate_legacy_settings(self) -> None:
        if self.legacy_settings_dir == self.settings_dir or not self.legacy_settings_dir.exists():
            return

        candidates = [
            ("state.json", self.state_path),
            ("subscription.yaml", self.profile_source_path),
            ("mihomo-managed.yaml", self.managed_config_path),
            ("bin/mihomo", self.runtime_mihomo_path),
            ("logs/mihomo.log", self.mihomo_log_path),
        ]
        for relative_name, destination in candidates:
            source = self.legacy_settings_dir / relative_name
            if not source.exists() or destination.exists():
                continue
            destination.parent.mkdir(parents=True, exist_ok=True)
            try:
                shutil.copy2(source, destination)
            except OSError:
                continue

    async def get_state(self) -> dict[str, Any]:
        await asyncio.to_thread(self._refresh_service_state)
        if self.process_mode is not None:
            try:
                await self._sync_from_controller()
            except Exception as exc:  # pragma: no cover - depends on runtime core
                decky.logger.warning("State refresh from controller failed: %s", exc)

        payload = dict(self.state)
        payload["core_mode"] = self.process_mode or "stopped"
        payload["connected"] = self.process_mode == "tun"
        payload["controller_ready"] = (
            await asyncio.to_thread(self._controller_is_ready)
            if self.process_mode is not None
            else False
        )
        payload["has_profile"] = self.profile_source_path.exists()
        payload["binary_ready"] = self._resolve_existing_mihomo() is not None
        payload["helper_installed"] = self._is_helper_installed()
        payload["helper_script_path"] = str(self.tun_helper_script_path)
        payload["helper_install_command"] = self._helper_install_command()
        payload["stable_settings_dir"] = str(self.settings_dir)
        payload["stable_binary_path"] = str(self.runtime_mihomo_path)
        payload["service_name"] = self.service_name
        payload["service_unit_path"] = str(self.service_unit_path)
        return payload

    async def get_diagnostics(self) -> dict[str, Any]:
        await self.get_state()
        return await asyncio.to_thread(self._collect_diagnostics)

    async def apply_subscription_url(self, url: str) -> dict[str, Any]:
        normalized = url.strip()
        if not normalized.startswith(("http://", "https://")):
            raise ValueError("Нужна ссылка формата http:// или https://.")

        self.state["subscription_url"] = normalized
        self.state["last_error"] = ""
        self._save_state()
        return await self.refresh_subscription()

    async def refresh_subscription(self) -> dict[str, Any]:
        subscription_url = (self.state.get("subscription_url") or "").strip()
        if not subscription_url:
            raise ValueError("Сначала добавь ссылку на подписку.")

        try:
            raw_profile, tls_mode = await asyncio.to_thread(self._download_text, subscription_url)
        except Exception as exc:
            self.state["last_error"] = str(exc)
            self.state["last_notice"] = ""
            self._save_state()
            raise

        await asyncio.to_thread(self.profile_source_path.write_text, raw_profile, "utf-8")
        self.state["last_profile_source"] = "subscription"
        self.state["last_refreshed_at"] = self._now_iso()
        self.state["last_error"] = ""
        self.state["last_notice"] = self._subscription_tls_notice(tls_mode)
        self._save_state()

        should_reload_now = await asyncio.to_thread(self._service_is_active)
        if not should_reload_now:
            self._clear_runtime_state()
            self._save_state()
            return await self.get_state()

        try:
            return await self._reload_profile(run_healthcheck=True)
        except Exception as exc:
            self._clear_runtime_state()
            self.state["last_error"] = (
                "Подписка сохранена, но mihomo пока не удалось перезапустить. "
                f"Попробуй нажать 'Подключить VPN' отдельно.\n\n{exc}"
            )
            self._save_state()
            return await self.get_state()

    async def import_profile_text(self, yaml_text: str) -> dict[str, Any]:
        profile_text = yaml_text.strip()
        if not profile_text:
            raise ValueError("YAML пустой.")

        await asyncio.to_thread(self.profile_source_path.write_text, profile_text, "utf-8")
        self.state["last_profile_source"] = "manual"
        self.state["last_error"] = ""
        self.state["last_notice"] = ""
        self._save_state()
        return await self._reload_profile(run_healthcheck=True)

    async def connect(self) -> dict[str, Any]:
        try:
            if not self.profile_source_path.exists():
                if self.state.get("subscription_url"):
                    await self.refresh_subscription()
                else:
                    raise ValueError("Сначала добавь ссылку на подписку или импортируй YAML.")

            await self._ensure_core(tun_enabled=True, force_restart=self.process_mode != "tun")
            await self._sync_from_controller()
            await self._apply_cached_selections()
            await self._sync_from_controller()

            active_group = self._resolve_active_group_name()
            if active_group:
                await self._check_group_internal(active_group, auto_select=False)
                await self._sync_from_controller()

            self.state["last_error"] = ""
            self._save_state()
            return await self.get_state()
        except Exception as exc:
            await self._stop_core()
            self._clear_runtime_state()
            self.state["last_error"] = str(exc)
            self._save_state()
            raise

    async def disconnect(self) -> dict[str, Any]:
        await self._stop_core()
        return await self.get_state()

    async def select_proxy(self, group_name: str, proxy_name: str) -> dict[str, Any]:
        if not group_name or not proxy_name:
            raise ValueError("Нужна группа и нода.")

        started_temporarily = not await asyncio.to_thread(self._service_is_active)
        desired_tun = self.process_mode == "tun"
        await self._ensure_core(tun_enabled=desired_tun)
        await self._set_group_proxy(group_name, proxy_name)
        await self._sync_from_controller()
        self.state.setdefault("selected_proxies", {})[group_name] = proxy_name
        self.state["active_group"] = group_name
        self.state["last_error"] = ""
        self._save_state()

        if started_temporarily:
            await self._stop_core()

        return await self.get_state()

    async def check_group(self, group_name: str) -> dict[str, Any]:
        if not group_name:
            raise ValueError("Выбери группу для проверки.")

        started_temporarily = not await asyncio.to_thread(self._service_is_active)
        desired_tun = self.process_mode == "tun"
        await self._ensure_core(tun_enabled=desired_tun)
        await self._sync_from_controller()
        await self._check_group_internal(group_name, auto_select=False)
        await self._sync_from_controller()

        if started_temporarily:
            await self._stop_core()

        return await self.get_state()

    async def choose_best_proxy(self, group_name: str) -> dict[str, Any]:
        if not group_name:
            raise ValueError("Выбери группу.")

        started_temporarily = not await asyncio.to_thread(self._service_is_active)
        desired_tun = self.process_mode == "tun"
        await self._ensure_core(tun_enabled=desired_tun)
        await self._sync_from_controller()
        await self._check_group_internal(group_name, auto_select=True)
        await self._sync_from_controller()

        if started_temporarily:
            await self._stop_core()

        return await self.get_state()

    async def _reload_profile(self, run_healthcheck: bool) -> dict[str, Any]:
        desired_tun = self.process_mode == "tun"
        started_temporarily = (not await asyncio.to_thread(self._service_is_active)) and not desired_tun
        await self._ensure_core(tun_enabled=desired_tun, force_restart=True)
        await self._sync_from_controller()
        await self._apply_cached_selections()
        await self._sync_from_controller()

        active_group = self._resolve_active_group_name()
        if run_healthcheck and active_group:
            await self._check_group_internal(active_group, auto_select=False)
            await self._sync_from_controller()

        self.state["last_refreshed_at"] = self._now_iso()
        self.state["last_error"] = ""
        self._save_state()

        if started_temporarily:
            await self._stop_core()

        return await self.get_state()

    async def _apply_cached_selections(self) -> None:
        selected_proxies = dict(self.state.get("selected_proxies") or {})
        if not selected_proxies:
            return

        groups_by_name = {group["name"]: group for group in self.state.get("groups", [])}
        changed = False
        for group_name, proxy_name in selected_proxies.items():
            group = groups_by_name.get(group_name)
            if not group or proxy_name not in group.get("proxies", []):
                continue
            if group.get("current") == proxy_name:
                continue
            await self._set_group_proxy(group_name, proxy_name)
            changed = True

        if changed:
            await self._sync_from_controller()

    async def _ensure_core(self, tun_enabled: bool, force_restart: bool = False) -> None:
        target_mode = "tun" if tun_enabled else "controller"
        await asyncio.to_thread(self._refresh_service_state)
        if self.process_mode == target_mode and not force_restart:
            return

        if not self.profile_source_path.exists():
            raise ValueError("Профиль не найден. Сначала импортируй подписку или YAML.")

        await asyncio.to_thread(self._ensure_mihomo_available)
        managed_config = await asyncio.to_thread(self._build_managed_config, tun_enabled)
        await asyncio.to_thread(self.managed_config_path.write_text, managed_config, "utf-8")
        decky.logger.info("Starting mihomo service in %s mode", target_mode)
        await asyncio.to_thread(self._ensure_helper_ready)
        await asyncio.to_thread(self._restart_service)
        self.process = None
        self.process_mode = target_mode
        self.state["service_mode"] = target_mode
        self._save_state()
        await self._wait_for_controller()
        if tun_enabled:
            await asyncio.to_thread(self._validate_tun_runtime)

    async def _stop_core(self) -> None:
        await asyncio.to_thread(self._stop_service)
        self.process = None
        self.process_mode = None
        self.state["service_mode"] = "stopped"
        self._save_state()

    async def _wait_for_controller(self) -> None:
        for _ in range(30):
            await asyncio.to_thread(self._refresh_service_state)
            if self.process_mode is None:
                raise RuntimeError(
                    "mihomo завершился раньше времени.\n\n"
                    f"Лог:\n{self._tail_log()}"
                )

            try:
                version_data = await self._controller_request("GET", "/version")
                self.state["mihomo_version"] = (
                    version_data.get("version")
                    or version_data.get("meta")
                    or version_data.get("Mihomo")
                    or "unknown"
                )
                self._save_state()
                return
            except Exception:
                await asyncio.sleep(0.5)

        raise RuntimeError(
            "Не удалось дождаться controller API mihomo.\n\n"
            f"Лог:\n{self._tail_log()}"
        )

    def _systemctl_path(self) -> str | None:
        return shutil.which("systemctl")

    def _service_control_command(self, action: str) -> list[str]:
        if self.service_control_path.exists():
            return [str(self.service_control_path), action]
        systemctl_path = self._systemctl_path()
        if not systemctl_path:
            raise RuntimeError("systemctl не найден в системе SteamOS.")
        return [systemctl_path, action, self.service_name]

    def _run_service_control(self, action: str) -> str:
        command = self._service_control_command(action)
        if hasattr(os, "geteuid") and os.geteuid() == 0:
            return self._run_command(command)
        return self._run_command(["sudo", "-n", *command])

    def _run_command(self, command: list[str], timeout: int = 20) -> str:
        try:
            completed = subprocess.run(
                command,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=timeout,
                check=False,
            )
        except subprocess.TimeoutExpired as exc:
            raise RuntimeError(f"Команда завершилась по таймауту: {' '.join(command)}") from exc
        except OSError as exc:
            raise RuntimeError(f"Не удалось выполнить команду {' '.join(command)}: {exc}") from exc

        stdout = completed.stdout.strip()
        stderr = completed.stderr.strip()
        if completed.returncode == 0:
            return stdout or stderr

        combined = "\n".join(item for item in [stdout, stderr] if item).strip()
        raise RuntimeError(combined or f"Команда {' '.join(command)} завершилась с кодом {completed.returncode}.")

    def _service_is_active(self) -> bool:
        try:
            output = self._run_service_control("is-active")
        except RuntimeError:
            return False
        return output.strip() == "active"

    def _controller_is_ready(self) -> bool:
        if self.process_mode is None:
            return False
        try:
            self._http_json(
                f"http://{CONTROLLER_HOST}:{CONTROLLER_PORT}/version",
                "GET",
                {"Authorization": f"Bearer {self.controller_secret}"},
                None,
            )
        except Exception:
            return False
        return True

    def _refresh_service_state(self) -> None:
        if self._service_is_active():
            mode = str(self.state.get("service_mode") or "")
            self.process_mode = mode if mode in {"tun", "controller"} else "controller"
        else:
            self.process_mode = None

    def _is_helper_installed(self) -> bool:
        if (
            not self.service_unit_path.exists()
            or not self.sudoers_path.exists()
            or not self.service_control_path.exists()
        ):
            return False
        systemctl_path = self._systemctl_path()
        if not systemctl_path:
            return False
        return True

    def _helper_install_command(self) -> str:
        return f"sudo bash '{self.tun_helper_script_path}'"

    def _build_helper_install_message(self) -> str:
        return (
            "Для системного VPN на Steam Deck нужен одноразовый helper с root systemd-сервисом.\n\n"
            "Перейди в Desktop Mode и один раз выполни:\n"
            f"{self._helper_install_command()}\n\n"
            f"Скрипт: {self.tun_helper_script_path}\n"
            f"Стабильная папка данных: {self.settings_dir}\n"
            f"Сервис: {self.service_name}\n\n"
            "После установки helper перезапусти Steam или Decky Loader и снова попробуй подключение."
        )

    def _ensure_helper_ready(self) -> None:
        if self._is_helper_installed():
            return
        raise RuntimeError(self._build_helper_install_message())

    def _helper_install_message(self) -> str:
        return (
            "Для системного VPN на Steam Deck нужен одноразовый helper с root systemd-сервисом.\n\n"
            "Перейди в Desktop Mode и выполни install helper из репозитория плагина.\n\n"
            f"Скрипт: {self.tun_helper_script_path}\n"
            f"Стабильная папка данных: {self.settings_dir}\n"
            f"Сервис: {self.service_name}\n\n"
            "После установки helper перезапусти Steam или Decky Loader и снова попробуй подключение."
        )

    def _restart_service(self) -> None:
        if self._service_is_active():
            self._run_service_control("restart")
            return
        self._run_service_control("start")

    def _stop_service(self) -> None:
        if not self._is_helper_installed():
            return
        try:
            self._run_service_control("stop")
        except RuntimeError:
            return

    async def _sync_from_controller(self) -> None:
        response = await self._controller_request("GET", "/proxies")
        proxies = response.get("proxies")
        if not isinstance(proxies, dict):
            raise RuntimeError("mihomo вернул неожиданный ответ по /proxies.")

        self.proxy_index = {
            name: info for name, info in proxies.items() if isinstance(info, dict)
        }

        groups: list[dict[str, Any]] = []
        for name, info in self.proxy_index.items():
            if not self._is_group(info):
                continue
            group_entry = {
                "name": name,
                "type": info.get("type", "Unknown"),
                "current": info.get("now") or "",
                "proxies": [item for item in info.get("all", []) if isinstance(item, str)],
            }
            groups.append(group_entry)

        current_group_names = {group["name"] for group in groups}
        selected_proxies = dict(self.state.get("selected_proxies") or {})
        selected_proxies = {
            group_name: proxy_name
            for group_name, proxy_name in selected_proxies.items()
            if group_name in current_group_names
        }

        health = dict(self.state.get("health") or {})
        recommended_proxies = dict(self.state.get("recommended_proxies") or {})
        for group in groups:
            group_name = group["name"]
            current_candidates = set(group["proxies"])
            current_health = {
                proxy_name: value
                for proxy_name, value in (health.get(group_name) or {}).items()
                if proxy_name in current_candidates
            }
            if current_health:
                health[group_name] = current_health
            elif group_name in health:
                health.pop(group_name, None)

            if recommended_proxies.get(group_name) not in current_candidates:
                recommended_proxies.pop(group_name, None)

            if group.get("current"):
                selected_proxies[group_name] = group["current"]

        active_group = self.state.get("active_group") or ""
        if active_group not in current_group_names and groups:
            active_group = groups[0]["name"]

        self.state["active_group"] = active_group
        self.state["groups"] = groups
        self.state["selected_proxies"] = selected_proxies
        self.state["health"] = {
            group_name: data for group_name, data in health.items() if group_name in current_group_names
        }
        self.state["recommended_proxies"] = {
            group_name: proxy_name
            for group_name, proxy_name in recommended_proxies.items()
            if group_name in current_group_names
        }
        self._save_state()

    async def _check_group_internal(self, group_name: str, auto_select: bool) -> None:
        group = self._get_group(group_name)
        if not group:
            raise ValueError(f"Группа '{group_name}' не найдена.")

        candidates = [
            proxy_name
            for proxy_name in group.get("proxies", [])
            if self._is_leaf_proxy(proxy_name)
        ]
        if not candidates:
            candidates = [
                proxy_name
                for proxy_name in group.get("proxies", [])
                if proxy_name not in SPECIAL_PROXY_NAMES
            ]
        if not candidates:
            raise RuntimeError("В группе нет нод, которые можно проверить.")

        delays = await self._collect_group_delays(group_name, candidates)
        self.state.setdefault("health", {})[group_name] = delays

        best_proxy = None
        best_delay = None
        for proxy_name, delay in delays.items():
            if delay is None:
                continue
            if best_delay is None or delay < best_delay:
                best_proxy = proxy_name
                best_delay = delay

        if best_proxy:
            self.state.setdefault("recommended_proxies", {})[group_name] = best_proxy
            if auto_select:
                await self._set_group_proxy(group_name, best_proxy)
                self.state.setdefault("selected_proxies", {})[group_name] = best_proxy
        else:
            self.state.setdefault("recommended_proxies", {}).pop(group_name, None)

        self.state["active_group"] = group_name
        self.state["last_error"] = ""
        self._save_state()

    async def _collect_group_delays(
        self,
        group_name: str,
        candidates: list[str],
    ) -> dict[str, int | None]:
        delays = await self._group_delay_request(group_name, candidates)
        missing = [proxy_name for proxy_name in candidates if proxy_name not in delays]
        if missing:
            delays.update(await self._delay_each_proxy(missing))
        return {proxy_name: delays.get(proxy_name) for proxy_name in candidates}

    async def _group_delay_request(
        self,
        group_name: str,
        candidates: list[str],
    ) -> dict[str, int | None]:
        best_effort: dict[str, int | None] = {}
        for healthcheck_url in HEALTHCHECK_URLS:
            try:
                response = await self._controller_request(
                    "GET",
                    f"/group/{urllib.parse.quote(group_name, safe='')}/delay",
                    params={
                        "url": healthcheck_url,
                        "timeout": str(HEALTHCHECK_TIMEOUT_MS),
                    },
                )
            except Exception:
                continue

            discovered = self._extract_delays(response, set(candidates))
            if not discovered:
                continue
            if any(delay is not None for delay in discovered.values()):
                return discovered
            if not best_effort:
                best_effort = discovered

        return best_effort

    async def _delay_each_proxy(self, proxy_names: list[str]) -> dict[str, int | None]:
        semaphore = asyncio.Semaphore(6)

        async def _probe(proxy_name: str) -> tuple[str, int | None]:
            async with semaphore:
                for healthcheck_url in HEALTHCHECK_URLS:
                    try:
                        response = await self._controller_request(
                            "GET",
                            f"/proxies/{urllib.parse.quote(proxy_name, safe='')}/delay",
                            params={
                                "url": healthcheck_url,
                                "timeout": str(HEALTHCHECK_TIMEOUT_MS),
                            },
                        )
                    except Exception:
                        continue

                    delay = response.get("delay")
                    if isinstance(delay, int) and delay > 0:
                        return proxy_name, delay
                return proxy_name, None

        results = await asyncio.gather(*[_probe(proxy_name) for proxy_name in proxy_names])
        return dict(results)

    def _extract_delays(
        self,
        payload: Any,
        candidates: set[str],
    ) -> dict[str, int | None]:
        delays: dict[str, int | None] = {}

        def _walk(node: Any) -> None:
            if isinstance(node, dict):
                for key, value in node.items():
                    if key in candidates and isinstance(value, int):
                        delays[key] = value if value > 0 else None
                    else:
                        _walk(value)
            elif isinstance(node, list):
                for item in node:
                    _walk(item)

        _walk(payload)
        return delays

    async def _set_group_proxy(self, group_name: str, proxy_name: str) -> None:
        group = self._get_group(group_name)
        if not group:
            raise ValueError(f"Группа '{group_name}' не найдена.")
        if proxy_name not in group.get("proxies", []):
            raise ValueError(f"Нода '{proxy_name}' не входит в группу '{group_name}'.")

        await self._controller_request(
            "PUT",
            f"/proxies/{urllib.parse.quote(group_name, safe='')}",
            payload={"name": proxy_name},
        )
        self.state.setdefault("selected_proxies", {})[group_name] = proxy_name
        self.state["active_group"] = group_name
        self._save_state()

    async def _controller_request(
        self,
        method: str,
        path: str,
        params: dict[str, str] | None = None,
        payload: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        query = f"?{urllib.parse.urlencode(params)}" if params else ""
        url = f"http://{CONTROLLER_HOST}:{CONTROLLER_PORT}{path}{query}"
        data = None
        headers = {
            "Authorization": f"Bearer {self.controller_secret}",
            "Accept": "application/json",
        }
        if payload is not None:
            data = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"

        return await asyncio.to_thread(self._http_json, url, method, headers, data)

    def _http_json(
        self,
        url: str,
        method: str,
        headers: dict[str, str],
        data: bytes | None,
    ) -> dict[str, Any]:
        request = urllib.request.Request(url, method=method, headers=headers, data=data)
        with urllib.request.urlopen(request, timeout=20) as response:
            body = response.read()
        if not body:
            return {}
        return json.loads(body.decode("utf-8"))

    def _download_text(self, url: str) -> tuple[str, str]:
        attempts: list[str] = []
        for user_agent in SUBSCRIPTION_USER_AGENTS:
            try:
                text, tls_mode = self._download_text_once(url, user_agent)
            except RuntimeError as exc:
                attempts.append(f"{user_agent}: {exc}")
                continue

            normalized_text, format_error = self._normalize_subscription_text(text)
            if normalized_text is not None:
                decky.logger.info("Subscription downloaded with User-Agent %s", user_agent)
                return normalized_text, tls_mode

            attempts.append(f"{user_agent}: {format_error}")

        details = "\n".join(f"- {item}" for item in attempts[:4])
        suffix = f"\n\nПроверенные варианты:\n{details}" if details else ""
        raise RuntimeError(
            "Не удалось получить рабочую Clash/Mihomo-подписку по этой ссылке. "
            "Провайдер, вероятно, отдает разный ответ в зависимости от клиента."
            f"{suffix}"
        )

    def _download_text_once(self, url: str, user_agent: str) -> tuple[str, str]:
        headers = {
            "User-Agent": user_agent,
            "Accept": "application/x-yaml, text/yaml, text/plain, */*",
        }
        try:
            return self._download_text_with_context(url, headers, context=None), "verified"
        except urllib.error.HTTPError as exc:
            raise RuntimeError(f"HTTP {exc.code}") from exc
        except urllib.error.URLError as exc:
            if not self._is_certificate_verification_failure(exc.reason):
                raise RuntimeError(f"network error: {exc.reason}") from exc

        for bundle_path in self._existing_ca_bundle_paths():
            try:
                custom_context = ssl.create_default_context(cafile=str(bundle_path))
                decky.logger.warning(
                    "Retrying subscription download with explicit CA bundle %s for %s",
                    bundle_path,
                    user_agent,
                )
                return self._download_text_with_context(url, headers, context=custom_context), "system-ca"
            except urllib.error.HTTPError as exc:
                raise RuntimeError(f"HTTP {exc.code}") from exc
            except urllib.error.URLError as exc:
                if not self._is_certificate_verification_failure(exc.reason):
                    raise RuntimeError(f"network error: {exc.reason}") from exc

        try:
            decky.logger.warning(
                "Retrying subscription download without TLS verification for %s",
                user_agent,
            )
            insecure_context = ssl._create_unverified_context()
            return self._download_text_with_context(url, headers, context=insecure_context), "insecure"
        except urllib.error.HTTPError as exc:
            raise RuntimeError(f"HTTP {exc.code}") from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f"network error: {exc.reason}") from exc

    def _download_text_with_context(
        self,
        url: str,
        headers: dict[str, str],
        context: ssl.SSLContext | None,
    ) -> str:
        body = self._download_bytes_with_context(url, headers, context=context, timeout=25)

        try:
            return body.decode("utf-8")
        except UnicodeDecodeError:
            return body.decode("utf-8-sig", errors="replace")

    def _download_bytes_with_context(
        self,
        url: str,
        headers: dict[str, str],
        context: ssl.SSLContext | None,
        timeout: int,
    ) -> bytes:
        request = urllib.request.Request(url, headers=headers, method="GET")
        with urllib.request.urlopen(request, timeout=timeout, context=context) as response:
            return response.read()

    def _download_bytes_tls_compat(
        self,
        url: str,
        headers: dict[str, str],
        timeout: int,
        label: str,
        allow_insecure: bool = True,
    ) -> tuple[bytes, str]:
        try:
            return self._download_bytes_with_context(url, headers, context=None, timeout=timeout), "verified"
        except urllib.error.HTTPError as exc:
            raise RuntimeError(f"{label}: HTTP {exc.code}") from exc
        except urllib.error.URLError as exc:
            if not self._is_certificate_verification_failure(exc.reason):
                raise RuntimeError(f"{label}: network error: {exc.reason}") from exc

        for bundle_path in self._existing_ca_bundle_paths():
            try:
                custom_context = ssl.create_default_context(cafile=str(bundle_path))
                decky.logger.warning(
                    "Retrying %s with explicit CA bundle %s",
                    label,
                    bundle_path,
                )
                return (
                    self._download_bytes_with_context(
                        url,
                        headers,
                        context=custom_context,
                        timeout=timeout,
                    ),
                    "system-ca",
                )
            except urllib.error.HTTPError as exc:
                raise RuntimeError(f"{label}: HTTP {exc.code}") from exc
            except urllib.error.URLError as exc:
                if not self._is_certificate_verification_failure(exc.reason):
                    raise RuntimeError(f"{label}: network error: {exc.reason}") from exc

        if not allow_insecure:
            raise RuntimeError(f"{label}: TLS certificate verification failed")

        try:
            decky.logger.warning("Retrying %s without TLS verification", label)
            insecure_context = ssl._create_unverified_context()
            return (
                self._download_bytes_with_context(
                    url,
                    headers,
                    context=insecure_context,
                    timeout=timeout,
                ),
                "insecure",
            )
        except urllib.error.HTTPError as exc:
            raise RuntimeError(f"{label}: HTTP {exc.code}") from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f"{label}: network error: {exc.reason}") from exc

    def _existing_ca_bundle_paths(self) -> list[Path]:
        return [Path(path) for path in SYSTEM_CA_BUNDLE_CANDIDATES if Path(path).exists()]

    def _is_certificate_verification_failure(self, reason: Any) -> bool:
        if isinstance(reason, ssl.SSLCertVerificationError):
            return True

        if isinstance(reason, ssl.SSLError):
            text = str(reason).upper()
            return "CERTIFICATE_VERIFY_FAILED" in text

        return "CERTIFICATE_VERIFY_FAILED" in str(reason).upper()

    def _subscription_tls_notice(self, tls_mode: str) -> str:
        if tls_mode == "system-ca":
            return (
                "Подписка скачана через системный CA bundle SteamOS. "
                "Если провайдер обновит сертификаты, этот обход может больше не понадобиться."
            )
        if tls_mode == "insecure":
            return (
                "Подписка скачана в режиме совместимости TLS без проверки цепочки сертификатов. "
                "Это менее безопасно, чем обычный HTTPS, поэтому используй только доверенную ссылку."
            )
        return ""

    def _normalize_subscription_text(self, text: str) -> tuple[str | None, str]:
        normalized = text.strip().lstrip("\ufeff")
        if self._looks_like_clash_yaml(normalized):
            return f"{normalized}\n", ""

        decoded = self._try_decode_base64_text(normalized)
        if decoded:
            decoded = decoded.strip().lstrip("\ufeff")
            if self._looks_like_clash_yaml(decoded):
                return f"{decoded}\n", ""
            if self._looks_like_link_subscription(decoded):
                return None, "вернулся base64-список VLESS/VMess ссылок, а не Clash YAML"

        if self._looks_like_link_subscription(normalized):
            return None, "вернулся список VLESS/VMess ссылок, а не Clash YAML"

        return None, "ответ не похож на Clash/Mihomo YAML"

    def _looks_like_clash_yaml(self, text: str) -> bool:
        return "proxies:" in text and ("proxy-groups:" in text or "rules:" in text)

    def _looks_like_link_subscription(self, text: str) -> bool:
        link_prefixes = (
            "vless://",
            "vmess://",
            "trojan://",
            "ss://",
            "ssr://",
            "tuic://",
            "hysteria://",
        )
        return any(text.startswith(prefix) for prefix in link_prefixes)

    def _try_decode_base64_text(self, text: str) -> str | None:
        compact = "".join(text.split())
        if len(compact) < 32:
            return None

        padding = "=" * (-len(compact) % 4)
        try:
            decoded = base64.b64decode(f"{compact}{padding}", validate=True)
        except Exception:
            return None

        try:
            return decoded.decode("utf-8")
        except UnicodeDecodeError:
            return decoded.decode("utf-8-sig", errors="replace")

    def _ensure_mihomo_available(self) -> Path:
        bundled_binary_path = self.plugin_dir / "bin" / "mihomo"
        if bundled_binary_path.exists():
            return bundled_binary_path

        cached_runtime_version = str(self.state.get("runtime_mihomo_plugin_version") or "")
        if self.runtime_mihomo_path.exists() and cached_runtime_version == self.plugin_version:
            return self.runtime_mihomo_path

        system_path = shutil.which("mihomo")
        if system_path and not self.runtime_mihomo_path.exists():
            return Path(system_path)

        release_data = self._download_release_metadata()
        asset = self._pick_mihomo_asset(release_data)
        if asset is None:
            raise RuntimeError("Не удалось подобрать подходящий mihomo binary для Steam Deck.")

        download_url = asset["browser_download_url"]
        decky.logger.info("Downloading mihomo asset %s", asset["name"])
        headers = {
            "User-Agent": "DeckyMihomo/0.1",
            "Accept": "application/octet-stream, */*",
        }
        compressed_binary, _tls_mode = self._download_bytes_tls_compat(
            download_url,
            headers=headers,
            timeout=60,
            label="mihomo binary",
        )

        binary = gzip.decompress(compressed_binary)
        self.runtime_bin_dir.mkdir(parents=True, exist_ok=True)
        self.runtime_mihomo_path.write_bytes(binary)
        current_mode = self.runtime_mihomo_path.stat().st_mode
        self.runtime_mihomo_path.chmod(current_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
        self.state["runtime_mihomo_plugin_version"] = self.plugin_version
        self.state["runtime_mihomo_asset_name"] = asset["name"]
        self._save_state()
        return self.runtime_mihomo_path

    def _resolve_existing_mihomo(self) -> Path | None:
        candidates = [
            self.plugin_dir / "bin" / "mihomo",
            self.runtime_mihomo_path,
        ]
        for candidate in candidates:
            if candidate.exists():
                return candidate

        system_path = shutil.which("mihomo")
        if system_path:
            return Path(system_path)

        return None

    def _download_release_metadata(self) -> dict[str, Any]:
        body, _tls_mode = self._download_bytes_tls_compat(
            MIHOMO_RELEASE_API,
            headers={
                "Accept": "application/vnd.github+json",
                "User-Agent": "DeckyMihomo/0.1",
            },
            timeout=25,
            label="GitHub release metadata",
        )
        return json.loads(body.decode("utf-8"))

    def _pick_mihomo_asset(self, release_data: dict[str, Any]) -> dict[str, Any] | None:
        assets = release_data.get("assets")
        if not isinstance(assets, list):
            return None

        priorities = (
            "mihomo-linux-amd64-v1-",
            "mihomo-linux-amd64-v1.",
            "mihomo-linux-amd64-compatible",
            "mihomo-linux-amd64-",
            "mihomo-linux-amd64.",
        )

        for prefix in priorities:
            for asset in assets:
                name = asset.get("name")
                if isinstance(name, str) and name.startswith(prefix) and name.endswith(".gz"):
                    return asset
        return None

    def _detect_default_interface(self) -> str | None:
        route_path = Path("/proc/net/route")
        if not route_path.exists():
            return None

        try:
            lines = route_path.read_text(encoding="utf-8").splitlines()
        except OSError:
            return None

        for line in lines[1:]:
            parts = line.split()
            if len(parts) < 4:
                continue
            interface_name, destination_hex, _gateway_hex, flags_hex = parts[:4]
            if interface_name == "lo" or destination_hex != "00000000":
                continue
            try:
                flags = int(flags_hex, 16)
            except ValueError:
                continue
            if flags & 0x2:
                return interface_name

        return None

    def _build_managed_config(self, tun_enabled: bool) -> str:
        source = self.profile_source_path.read_text(encoding="utf-8")
        sanitized_source = self._strip_top_level_keys(source, MANAGED_TOP_LEVEL_KEYS).rstrip()
        tun_flag = "true" if tun_enabled else "false"
        managed_block = f"""

bind-address: '*'
external-controller: {CONTROLLER_HOST}:{CONTROLLER_PORT}
secret: {self.controller_secret}
find-process-mode: strict
tcp-concurrent: true
profile:
  store-selected: true
  store-fake-ip: true
tun:
  enable: {tun_flag}
  stack: system
  mtu: 1400
  auto-route: true
  auto-redirect: false
  auto-detect-interface: true
  dns-hijack:
    - any:53
    - tcp://any:53
  strict-route: true
"""
        return f"{sanitized_source}{managed_block}\n"

    def _strip_top_level_keys(self, text: str, keys_to_strip: set[str]) -> str:
        result: list[str] = []
        skipping = False
        for line in text.splitlines():
            stripped = line.strip()
            is_top_level = bool(line) and not line.startswith((" ", "\t"))

            if skipping:
                if is_top_level:
                    skipping = False
                else:
                    continue

            if is_top_level:
                key = line.split(":", 1)[0].strip()
                if key in keys_to_strip:
                    skipping = True
                    continue

            if stripped == "---":
                continue
            result.append(line)

        return "\n".join(result).strip()

    def _ensure_directories(self) -> None:
        self.settings_dir.mkdir(parents=True, exist_ok=True)
        self.runtime_dir.mkdir(parents=True, exist_ok=True)
        self.log_dir.mkdir(parents=True, exist_ok=True)
        self.runtime_bin_dir.mkdir(parents=True, exist_ok=True)

    def _default_state(self) -> dict[str, Any]:
        return {
            "subscription_url": "",
            "last_profile_source": "",
            "last_refreshed_at": "",
            "last_error": "",
            "last_notice": "",
            "service_mode": "stopped",
            "active_group": "",
            "groups": [],
            "health": {},
            "recommended_proxies": {},
            "selected_proxies": {},
            "mihomo_version": "",
        }

    def _clear_runtime_state(self) -> None:
        self.state["active_group"] = ""
        self.state["groups"] = []
        self.state["health"] = {}
        self.state["recommended_proxies"] = {}
        self.state["selected_proxies"] = {}

    def _load_state(self) -> dict[str, Any]:
        if not self.state_path.exists():
            return self._default_state()

        try:
            loaded = json.loads(self.state_path.read_text(encoding="utf-8"))
        except Exception:
            decky.logger.warning("Failed to read state file, resetting it")
            return self._default_state()

        state = self._default_state()
        if isinstance(loaded, dict):
            state.update(loaded)
        return state

    def _save_state(self) -> None:
        self.state_path.write_text(
            json.dumps(self.state, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def _now_iso(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def _tail_log(self, limit: int = 30) -> str:
        if not self.mihomo_log_path.exists():
            return "Лог ещё не создан."
        lines = self.mihomo_log_path.read_text(encoding="utf-8", errors="replace").splitlines()
        return "\n".join(lines[-limit:]).strip() or "Лог пуст."

    def _validate_tun_runtime(self) -> None:
        log_tail = self._tail_log(limit=80)
        lowered_log = log_tail.lower()
        if "start tun listening error" in lowered_log or "configure tun interface: operation not permitted" in lowered_log:
            raise RuntimeError(self._build_tun_permission_error_message(log_tail))

        route_table = self._run_diagnostic_command(["ip", "route", "show", "table", "2022"])
        ip_rules = self._run_diagnostic_command(["ip", "rule", "show"])
        if "fib table does not exist" in route_table.lower() or "lookup 2022" not in ip_rules:
            raise RuntimeError(
                "mihomo запустил controller API, но TUN-маршруты не появились.\n\n"
                f"{self._build_tun_permission_error_message(log_tail)}\n\n"
                f"ip rule show:\n{ip_rules}\n\n"
                f"ip route show table 2022:\n{route_table}"
            )

    def _build_tun_permission_error_message(self, log_tail: str) -> str:
        helper_hint = ""
        if self.tun_helper_script_path.exists():
            helper_hint = (
                "\n\nВ Desktop Mode выполни helper-скрипт:\n"
                f"{self._helper_install_command()}"
            )

        return (
            "Steam Deck не дал Mihomo права на создание TUN-интерфейса и настройку маршрутов. "
            "Поэтому controller API поднялся, но системный VPN не работает."
            f"{helper_hint}\n\n"
            "После этого полностью перезапусти Steam или Decky Loader и попробуй подключиться снова.\n\n"
            f"Хвост лога:\n{log_tail}"
        )

    def _tun_permission_error_message(self, log_tail: str) -> str:
        helper_hint = ""
        if self.tun_helper_script_path.exists():
            helper_hint = (
                "\n\nВ Desktop Mode выполни helper-скрипт:\n"
                f"chmod +x '{self.tun_helper_script_path}'\n"
                f"'{self.tun_helper_script_path}'"
            )

        binary_hint = (
            "\n\nЛибо выдай capability вручную:\n"
            f"sudo setcap cap_net_admin,cap_net_raw,cap_net_bind_service=+ep '{self.runtime_mihomo_path}'"
        )

        return (
            "Steam Deck не дал Mihomo права на создание TUN-интерфейса и настройку маршрутов. "
            "Поэтому controller API поднялся, но системный VPN не работает."
            f"{helper_hint}{binary_hint}\n\n"
            "После этого полностью перезапусти Steam или Decky Loader и попробуй подключиться снова.\n\n"
            f"Хвост лога:\n{log_tail}"
        )

    def _collect_diagnostics(self) -> dict[str, Any]:
        active_group = self.state.get("active_group") or ""
        active_proxy = ""
        group = self._get_group(active_group) if active_group else None
        if group:
            active_proxy = (
                group.get("current")
                or (self.state.get("selected_proxies") or {}).get(active_group, "")
            )

        binary_path = self._resolve_existing_mihomo()
        source_profile = self._read_text_file(self.profile_source_path, max_chars=6000)
        managed_config = self._read_text_file(self.managed_config_path, max_chars=8000)
        mihomo_log = self._tail_file(self.mihomo_log_path, limit=160, max_chars=12000)
        connectivity_checks = self._run_connectivity_checks()
        network_snapshot = self._collect_network_snapshot()

        payload = {
            "generated_at": self._now_iso(),
            "plugin_version": self.plugin_version,
            "effective_user": getpass.getuser(),
            "effective_uid": os.geteuid() if hasattr(os, "geteuid") else -1,
            "core_mode": self.process_mode or "stopped",
            "connected": self.process_mode == "tun",
            "controller_ready": self._controller_is_ready(),
            "process_returncode": self.process.returncode if self.process is not None else None,
            "mihomo_version": self.state.get("mihomo_version") or "",
            "binary_path": str(binary_path) if binary_path is not None else "",
            "binary_asset_name": str(self.state.get("runtime_mihomo_asset_name") or ""),
            "runtime_binary_plugin_version": str(self.state.get("runtime_mihomo_plugin_version") or ""),
            "binary_capabilities": self._read_binary_capabilities(binary_path),
            "helper_installed": self._is_helper_installed(),
            "helper_script_path": str(self.tun_helper_script_path),
            "helper_install_command": self._helper_install_command(),
            "service_name": self.service_name,
            "service_unit_path": str(self.service_unit_path),
            "sudoers_path": str(self.sudoers_path),
            "stable_settings_dir": str(self.settings_dir),
            "stable_binary_path": str(self.runtime_mihomo_path),
            "default_interface": self._detect_default_interface() or "",
            "active_group": active_group,
            "active_proxy": active_proxy,
            "last_error": str(self.state.get("last_error") or ""),
            "last_notice": str(self.state.get("last_notice") or ""),
            "diagnostics_path": str(self.diagnostics_path),
            "connectivity_checks": self._mask_sensitive_text(connectivity_checks),
            "source_profile": self._mask_sensitive_text(source_profile),
            "managed_config": self._mask_sensitive_text(managed_config),
            "mihomo_log": self._mask_sensitive_text(mihomo_log),
            "network_snapshot": self._mask_sensitive_text(network_snapshot),
        }
        payload["summary"] = self._build_diagnostics_summary_v2(payload)
        self.diagnostics_path.write_text(
            self._render_diagnostics_report(payload),
            encoding="utf-8",
        )
        return payload

    def _build_diagnostics_summary_v2(self, payload: dict[str, Any]) -> str:
        summary_lines = [
            f"Создано: {payload['generated_at']}",
            f"Версия плагина: {payload['plugin_version']}",
            f"Пользователь backend: {payload['effective_user']} (uid={payload['effective_uid']})",
            f"Режим ядра: {payload['core_mode']}",
            f"Controller готов: {'да' if payload['controller_ready'] else 'нет'}",
            f"Helper установлен: {'да' if payload['helper_installed'] else 'нет'}",
            f"Mihomo: {payload['mihomo_version'] or 'неизвестно'}",
            f"Бинарь: {payload['binary_path'] or 'не найден'}",
            f"Asset: {payload['binary_asset_name'] or 'неизвестно'}",
            f"Версия cached core: {payload['runtime_binary_plugin_version'] or 'неизвестно'}",
            f"Capability на бинаре: {payload['binary_capabilities'] or 'не заданы'}",
            f"Helper-скрипт: {payload['helper_script_path']}",
            f"Команда helper: {payload['helper_install_command']}",
            f"Systemd unit: {payload['service_unit_path']}",
            f"Sudoers: {payload['sudoers_path']}",
            f"Стабильная папка: {payload['stable_settings_dir']}",
            f"Интерфейс по умолчанию: {payload['default_interface'] or 'не определён'}",
            f"Активная группа: {payload['active_group'] or 'нет'}",
            f"Активная нода: {payload['active_proxy'] or 'нет'}",
        ]
        if payload["last_error"]:
            summary_lines.extend(["", "Последняя ошибка:", payload["last_error"]])
        if payload["last_notice"]:
            summary_lines.extend(["", "Последнее предупреждение:", payload["last_notice"]])
        return "\n".join(summary_lines).strip()

    def _build_diagnostics_summary(self, payload: dict[str, Any]) -> str:
        summary_lines = [
            f"Создано: {payload['generated_at']}",
            f"Версия плагина: {payload['plugin_version']}",
            f"Пользователь backend: {payload['effective_user']} (uid={payload['effective_uid']})",
            f"Режим ядра: {payload['core_mode']}",
            f"Controller готов: {'да' if payload['controller_ready'] else 'нет'}",
            f"Mihomo: {payload['mihomo_version'] or 'неизвестно'}",
            f"Бинарь: {payload['binary_path'] or 'не найден'}",
            f"Asset: {payload['binary_asset_name'] or 'неизвестно'}",
            f"Версия cached core: {payload['runtime_binary_plugin_version'] or 'неизвестно'}",
            f"Capability на бинаре: {payload['binary_capabilities'] or 'не заданы'}",
            f"Интерфейс по умолчанию: {payload['default_interface'] or 'не определён'}",
            f"Активная группа: {payload['active_group'] or 'нет'}",
            f"Активная нода: {payload['active_proxy'] or 'нет'}",
        ]
        if payload["last_error"]:
            summary_lines.extend(["", "Последняя ошибка:", payload["last_error"]])
        if payload["last_notice"]:
            summary_lines.extend(["", "Последнее предупреждение:", payload["last_notice"]])
        return "\n".join(summary_lines).strip()

    def _render_diagnostics_report(self, payload: dict[str, Any]) -> str:
        sections = [
            ("Сводка", payload["summary"]),
            ("Managed config", payload["managed_config"]),
            ("Исходный профиль", payload["source_profile"]),
            ("Mihomo log", payload["mihomo_log"]),
            ("Сетевой снимок", payload["network_snapshot"]),
        ]
        rendered = []
        for title, body in sections:
            rendered.append(f"=== {title} ===\n{body or 'Пусто.'}")
        return "\n\n".join(rendered).strip() + "\n"

    def _read_text_file(self, path: Path, max_chars: int = 12000) -> str:
        if not path.exists():
            return f"Файл не найден: {path}"
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError as exc:
            return f"Не удалось прочитать {path}: {exc}"
        return self._truncate_text(text, max_chars=max_chars)

    def _tail_file(self, path: Path, limit: int = 120, max_chars: int = 12000) -> str:
        if not path.exists():
            return f"Файл не найден: {path}"
        try:
            lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
        except OSError as exc:
            return f"Не удалось прочитать {path}: {exc}"
        text = "\n".join(lines[-limit:]).strip() or "Лог пуст."
        return self._truncate_text(text, max_chars=max_chars)

    def _truncate_text(self, text: str, max_chars: int) -> str:
        if len(text) <= max_chars:
            return text
        omitted = len(text) - max_chars
        return f"{text[:max_chars]}\n\n...[truncated {omitted} chars]..."

    def _collect_network_snapshot(self) -> str:
        sections: list[str] = []
        commands = [
            ("ip rule show", ["ip", "rule", "show"]),
            ("ip route show table main", ["ip", "route", "show", "table", "main"]),
            ("ip route show table 2022", ["ip", "route", "show", "table", "2022"]),
            ("ip addr show", ["ip", "addr", "show"]),
            ("nft list ruleset", ["nft", "list", "ruleset"]),
        ]
        for title, command in commands:
            sections.append(f"$ {title}\n{self._run_diagnostic_command(command)}")

        resolv_conf = self._read_text_file(Path("/etc/resolv.conf"), max_chars=4000)
        sections.append(f"$ cat /etc/resolv.conf\n{resolv_conf}")
        return "\n\n".join(sections).strip()

    def _run_diagnostic_command(self, command: list[str], timeout: int = 8) -> str:
        executable = shutil.which(command[0])
        if not executable:
            return f"Команда недоступна: {command[0]}"
        try:
            completed = subprocess.run(
                [executable, *command[1:]],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=timeout,
                check=False,
            )
        except subprocess.TimeoutExpired:
            return "Команда завершилась по таймауту."
        except OSError as exc:
            return f"Не удалось выполнить команду: {exc}"

        stdout = completed.stdout.strip()
        stderr = completed.stderr.strip()
        chunks = []
        if stdout:
            chunks.append(stdout)
        if stderr:
            chunks.append(f"[stderr]\n{stderr}")
        if not chunks:
            chunks.append("(пустой вывод)")
        rendered = "\n\n".join(chunks)
        rendered = self._truncate_text(rendered, max_chars=16000)
        if completed.returncode != 0:
            rendered += f"\n\n[exit code: {completed.returncode}]"
        return rendered

    def _read_binary_capabilities(self, binary_path: Path | None) -> str:
        if binary_path is None:
            return ""
        output = self._run_diagnostic_command(["getcap", str(binary_path)])
        if "Команда недоступна" in output or output == "(пустой вывод)":
            return ""
        return output

    def _mask_sensitive_text(self, text: str) -> str:
        if not text:
            return text

        redacted = text
        if self.controller_secret:
            redacted = redacted.replace(self.controller_secret, "<redacted-controller-secret>")

        subscription_url = str(self.state.get("subscription_url") or "").strip()
        if subscription_url:
            redacted = redacted.replace(subscription_url, "<redacted-subscription-url>")

        redacted = re.sub(
            r"^(\s*(?:uuid|password|secret|token|short-id|private-key|client-secret)\s*:\s*).*$",
            r"\1<redacted>",
            redacted,
            flags=re.IGNORECASE | re.MULTILINE,
        )
        redacted = re.sub(
            r"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b",
            "<redacted-uuid>",
            redacted,
        )
        return redacted

    def _run_connectivity_checks(self) -> str:
        checks = [
            ("DNS example.com", self._dns_probe("example.com")),
            ("DNS api.ipify.org", self._dns_probe("api.ipify.org")),
            ("HTTP http://connectivitycheck.gstatic.com/generate_204", self._http_probe("http://connectivitycheck.gstatic.com/generate_204")),
            ("HTTPS https://www.gstatic.com/generate_204", self._http_probe("https://www.gstatic.com/generate_204")),
            ("HTTPS https://api.ipify.org", self._http_probe("https://api.ipify.org")),
        ]
        return "\n".join(f"- {title}: {result}" for title, result in checks)

    def _dns_probe(self, host: str) -> str:
        try:
            answers = socket.getaddrinfo(host, 443, proto=socket.IPPROTO_TCP)
        except OSError as exc:
            return f"ERROR {exc}"

        addresses = []
        for answer in answers[:4]:
            sockaddr = answer[4]
            if sockaddr and sockaddr[0] not in addresses:
                addresses.append(sockaddr[0])
        if not addresses:
            return "OK (no addresses returned)"
        return "OK " + ", ".join(addresses)

    def _http_probe(self, url: str) -> str:
        request = urllib.request.Request(
            url,
            method="GET",
            headers={"User-Agent": "DeckyMihomoDiag/0.1"},
        )
        try:
            with urllib.request.urlopen(request, timeout=8) as response:
                body = response.read(160)
                body_text = body.decode("utf-8", errors="replace").strip()
                body_text = body_text[:80] if body_text else "(empty body)"
                return f"HTTP {response.status}; body={body_text}"
        except Exception as exc:
            return f"ERROR {exc}"

    def _render_diagnostics_report(self, payload: dict[str, Any]) -> str:
        sections = [
            ("Сводка", payload["summary"]),
            ("Проверки связности", payload["connectivity_checks"]),
            ("Mihomo log", payload["mihomo_log"]),
            ("Сетевой снимок", payload["network_snapshot"]),
            ("Managed config", payload["managed_config"]),
            ("Исходный профиль", payload["source_profile"]),
        ]
        rendered = []
        for title, body in sections:
            rendered.append(f"=== {title} ===\n{body or 'Пусто.'}")
        return "\n\n".join(rendered).strip() + "\n"

    def _is_group(self, proxy_data: dict[str, Any]) -> bool:
        proxy_type = proxy_data.get("type")
        if isinstance(proxy_type, str) and proxy_type in GROUP_TYPES:
            return True
        return isinstance(proxy_data.get("all"), list)

    def _is_leaf_proxy(self, proxy_name: str) -> bool:
        if proxy_name in SPECIAL_PROXY_NAMES:
            return False
        proxy_info = self.proxy_index.get(proxy_name)
        if not isinstance(proxy_info, dict):
            return True
        return not self._is_group(proxy_info)

    def _get_group(self, group_name: str) -> dict[str, Any] | None:
        for group in self.state.get("groups", []):
            if group.get("name") == group_name:
                return group
        return None

    def _resolve_active_group_name(self) -> str:
        configured = self.state.get("active_group") or ""
        if configured and self._get_group(configured):
            return configured

        groups = self.state.get("groups", [])
        return groups[0]["name"] if groups else ""

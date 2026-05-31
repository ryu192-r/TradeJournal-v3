"""SSRF protections for user-configurable AI provider URLs."""

from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse


class AIBaseURLValidationError(ValueError):
    """Raised when an AI provider base URL is unsafe."""


_BLOCKED_HOSTNAMES = {
    "localhost",
    "host.docker.internal",
    "gateway.docker.internal",
    "docker.for.mac.localhost",
    "docker.for.win.localhost",
}

_BLOCKED_HOST_SUFFIXES = (
    ".localhost",
    ".local",
    ".internal",
)

_METADATA_IPS = {
    ipaddress.ip_address("169.254.169.254"),
    ipaddress.ip_address("fd00:ec2::254"),
}


def local_ai_urls_allowed() -> bool:
    from app.core.config import settings

    return bool(settings.DEBUG or settings.ALLOW_LOCAL_AI_URLS)


def validate_ai_base_url(base_url: str) -> str:
    """Return a normalized URL or raise if it can target local/internal hosts."""
    normalized = (base_url or "").strip().rstrip("/")
    if not normalized:
        raise AIBaseURLValidationError("AI provider base_url is required")

    parsed = urlparse(normalized)
    if parsed.scheme not in {"http", "https"}:
        raise AIBaseURLValidationError("AI provider base_url must use http or https")
    if parsed.username or parsed.password:
        raise AIBaseURLValidationError("AI provider base_url must not include credentials")
    if not parsed.hostname:
        raise AIBaseURLValidationError("AI provider base_url must include a host")

    allow_local = local_ai_urls_allowed()
    host_is_local = _is_local_or_internal_host(parsed.hostname)

    if parsed.scheme != "https":
        if not allow_local:
            raise AIBaseURLValidationError("AI provider base_url must use https")
        if not host_is_local:
            raise AIBaseURLValidationError("HTTP AI provider URLs are only allowed for local providers")

    if host_is_local and not allow_local:
        raise AIBaseURLValidationError("AI provider base_url cannot target local or internal hosts")

    return normalized


def _is_local_or_internal_host(hostname: str) -> bool:
    host = hostname.rstrip(".").lower()
    if host in _BLOCKED_HOSTNAMES or any(host.endswith(suffix) for suffix in _BLOCKED_HOST_SUFFIXES):
        return True

    try:
        return _is_blocked_ip(ipaddress.ip_address(host))
    except ValueError:
        pass

    for ip in _resolve_host(host):
        if _is_blocked_ip(ip):
            return True
    return False


def _resolve_host(hostname: str) -> list[ipaddress.IPv4Address | ipaddress.IPv6Address]:
    try:
        infos = socket.getaddrinfo(hostname, None, type=socket.SOCK_STREAM)
    except socket.gaierror:
        return []

    addresses: list[ipaddress.IPv4Address | ipaddress.IPv6Address] = []
    for info in infos:
        sockaddr = info[4]
        if not sockaddr:
            continue
        try:
            addresses.append(ipaddress.ip_address(sockaddr[0]))
        except ValueError:
            continue
    return addresses


def _is_blocked_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    return (
        ip in _METADATA_IPS
        or ip.is_loopback
        or ip.is_private
        or ip.is_link_local
        or ip.is_unspecified
        or ip.is_multicast
        or ip.is_reserved
    )

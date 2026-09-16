"""Real clinics and hospitals near a point, from OpenStreetMap.

The patient's Facilities screen asks for places near a location the patient
chose. OpenStreetMap's Overpass API answers that for anywhere in India with no
API key. The public servers are shared and sometimes busy (HTTP 429) or slow,
so a mirror is tried next, and answers are cached per ~1 km square for a day.

This is separate from MedLink's own facility list (app.seed), which doctors
use for stock, referrals and the dashboard.
"""

import logging
import math
import threading
import time
from collections import OrderedDict

import requests

logger = logging.getLogger("medlink.nearby")

OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
# (server index, timeout in seconds). The main server is fast but sometimes
# briefly overloaded (429/504), the mirror is slow but steady, so the main
# server gets one short second try. The worst case stays under the app's
# 100 s wait.
_ATTEMPTS = [(0, 25), (1, 45), (0, 15)]
_RETRY_PAUSE_SECONDS = 2
# Overpass asks clients to identify themselves.
USER_AGENT = "MedLink/1.0 (rural health app; patient facility finder)"

RADIUS_KM = 25
MAX_RESULTS = 50
_CACHE_SECONDS = 24 * 60 * 60
_CACHE_LIMIT = 200
# Two tagged points for the same place (a building and its entrance).
_DUPLICATE_METRES = 50

_cache: OrderedDict[tuple[float, float, int], tuple[float, list[dict]]] = OrderedDict()
_lock = threading.Lock()


class NearbyUnavailable(RuntimeError):
    """OpenStreetMap could not be reached or gave an unusable answer."""


def _query(lat: float, lng: float, radius_km: float) -> str:
    """Nodes and ways in the square around the point. A bounding box is far
    cheaper for Overpass than a circle; the circle is applied afterwards."""
    d_lat = radius_km / 111.32
    d_lng = radius_km / (111.32 * max(math.cos(math.radians(lat)), 0.01))
    box = f"({lat - d_lat:.5f},{lng - d_lng:.5f},{lat + d_lat:.5f},{lng + d_lng:.5f})"
    return (
        "[out:json][timeout:25];("
        f'nw["amenity"~"^(hospital|clinic|doctors)$"]{box};'
        f'nw["healthcare"~"^(hospital|clinic|centre|doctor)$"]{box};'
        ");out center tags 400;"
    )


def _distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance (haversine)."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lng2 - lng1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 6371.0088 * 2 * math.asin(math.sqrt(a))


def _kind(tags: dict) -> str:
    amenity = tags.get("amenity", "")
    healthcare = tags.get("healthcare", "")
    if "hospital" in (amenity, healthcare):
        return "hospital"
    if healthcare == "centre":
        return "health_centre"
    return "clinic"


def _address(tags: dict) -> str | None:
    parts = [
        tags.get(key, "").strip()
        for key in ("addr:street", "addr:suburb", "addr:city", "addr:district", "addr:postcode")
    ]
    seen: list[str] = []
    for part in parts:
        if part and part not in seen:
            seen.append(part)
    return ", ".join(seen) or None


def _fetch(query: str) -> list[dict]:
    last_error: Exception | None = None
    for attempt, (server, timeout) in enumerate(_ATTEMPTS):
        url = OVERPASS_URLS[server % len(OVERPASS_URLS)]
        if attempt and server == _ATTEMPTS[0][0]:
            time.sleep(_RETRY_PAUSE_SECONDS)
        try:
            response = requests.post(
                url,
                data={"data": query},
                headers={"User-Agent": USER_AGENT},
                timeout=timeout,
            )
            response.raise_for_status()
            return response.json()["elements"]
        except requests.HTTPError as error:
            last_error = error
            logger.warning("Overpass %s answered %s, trying next", url, error.response.status_code)
        except (requests.RequestException, KeyError, TypeError, ValueError) as error:
            last_error = error
            logger.warning("Overpass %s failed (%r), trying next", url, error)
    raise NearbyUnavailable("No Overpass server answered") from last_error


def _places(elements: list[dict], lat: float, lng: float, radius_km: float) -> list[dict]:
    places: list[dict] = []
    for element in elements:
        tags = element.get("tags") or {}
        name = (tags.get("name") or "").strip()
        if not name:
            continue
        point = element if "lat" in element else element.get("center") or {}
        if "lat" not in point or "lon" not in point:
            continue
        distance = _distance_km(lat, lng, point["lat"], point["lon"])
        if distance > radius_km:
            continue
        places.append(
            {
                "id": f"osm:{element.get('type', 'node')}/{element.get('id')}",
                "name": name,
                "kind": _kind(tags),
                "distance_km": round(distance, 1),
                "latitude": point["lat"],
                "longitude": point["lon"],
                "address": _address(tags),
            }
        )

    places.sort(key=lambda place: place["distance_km"])
    unique: list[dict] = []
    for place in places:
        duplicate = any(
            kept["name"].casefold() == place["name"].casefold()
            and _distance_km(kept["latitude"], kept["longitude"], place["latitude"], place["longitude"])
            * 1000
            < _DUPLICATE_METRES
            for kept in unique
        )
        if not duplicate:
            unique.append(place)
        if len(unique) >= MAX_RESULTS:
            break
    return unique


def find_nearby(lat: float, lng: float, radius_km: int = RADIUS_KM) -> list[dict]:
    """Named clinics, hospitals and health centres within ``radius_km``, nearest first."""
    key = (round(lat, 2), round(lng, 2), radius_km)
    now = time.monotonic()
    with _lock:
        cached = _cache.get(key)
        if cached and now - cached[0] < _CACHE_SECONDS:
            _cache.move_to_end(key)
            hit = cached[1]
        else:
            hit = None
    if hit is not None:
        # Cached for the square; distances are from the point asked about now.
        return _places_from_cached(hit, lat, lng, radius_km)

    elements = _fetch(_query(lat, lng, radius_km))
    places = _places(elements, lat, lng, radius_km)
    with _lock:
        _cache[key] = (now, places)
        while len(_cache) > _CACHE_LIMIT:
            _cache.popitem(last=False)
    return places


def _places_from_cached(places: list[dict], lat: float, lng: float, radius_km: float) -> list[dict]:
    """Recompute distances for a point inside a cached square."""
    moved = []
    for place in places:
        distance = _distance_km(lat, lng, place["latitude"], place["longitude"])
        if distance <= radius_km:
            moved.append({**place, "distance_km": round(distance, 1)})
    moved.sort(key=lambda place: place["distance_km"])
    return moved


# --- Typed places ---------------------------------------------------------------
#
# A patient can type a village, town or PIN code instead of sharing their
# location. OpenStreetMap's Nominatim turns that into a point. It works
# without location permission, unlike the phone's own geocoder on Android.
# Its usage policy asks for at most one request a second and for caching.

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
# Nominatim ranks places from country (4) down to houses (30). Below 12 is a
# whole district, whose centre can be far from the town of the same name.
_MIN_PLACE_RANK = 12

_places_cache: OrderedDict[str, tuple[float, dict | None]] = OrderedDict()
_nominatim_lock = threading.Lock()
_last_nominatim = 0.0


def _label(result: dict) -> str:
    address = result.get("address") or {}
    first = (result.get("name") or result.get("display_name", "").split(",")[0]).strip()
    parts: list[str] = []
    for part in (first, address.get("state_district") or address.get("county"), address.get("state")):
        if part and part not in parts:
            parts.append(part)
    return ", ".join(parts)


def locate(query: str) -> dict | None:
    """A typed place in India -> {latitude, longitude, label}, or None."""
    text = " ".join(query.split())
    key = text.casefold()
    now = time.monotonic()
    with _lock:
        cached = _places_cache.get(key)
    if cached and now - cached[0] < _CACHE_SECONDS:
        return cached[1]

    global _last_nominatim
    with _nominatim_lock:
        wait = 1.0 - (time.monotonic() - _last_nominatim)
        if wait > 0:
            time.sleep(wait)
        try:
            response = requests.get(
                NOMINATIM_URL,
                params={
                    "q": text,
                    "countrycodes": "in",
                    "format": "jsonv2",
                    "addressdetails": 1,
                    "limit": 5,
                },
                headers={"User-Agent": USER_AGENT},
                timeout=20,
            )
            response.raise_for_status()
            results = response.json()
        except (requests.RequestException, ValueError) as error:
            logger.warning("Nominatim failed for %r: %r", text, error)
            raise NearbyUnavailable("Place search is unavailable") from error
        finally:
            _last_nominatim = time.monotonic()

    chosen = next(
        (r for r in results if int(r.get("place_rank") or 0) >= _MIN_PLACE_RANK),
        results[0] if results else None,
    )
    place = (
        {
            "latitude": float(chosen["lat"]),
            "longitude": float(chosen["lon"]),
            "label": _label(chosen) or text,
        }
        if chosen
        else None
    )
    with _lock:
        _places_cache[key] = (now, place)
        while len(_places_cache) > _CACHE_LIMIT:
            _places_cache.popitem(last=False)
    return place

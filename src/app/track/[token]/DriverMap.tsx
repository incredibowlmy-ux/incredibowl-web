"use client";

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Emoji divIcons — Leaflet's default PNG marker breaks under bundlers
// (bad asset paths), and emoji matches the site's visual language anyway.
const driverIcon = L.divIcon({
    html: '<div style="font-size:26px;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))">🛵</div>',
    className: '',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
});
const destIcon = L.divIcon({
    html: '<div style="font-size:24px;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))">📍</div>',
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 22],
});

interface DriverMapProps {
    driver: { lat: number; lng: number };
    dest: { lat: number; lng: number } | null;
}

export default function DriverMap({ driver, dest }: DriverMapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const driverMarkerRef = useRef<L.Marker | null>(null);

    // Init once
    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;
        const map = L.map(containerRef.current, { zoomControl: false, attributionControl: true });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);
        L.control.zoom({ position: 'bottomright' }).addTo(map);

        driverMarkerRef.current = L.marker([driver.lat, driver.lng], { icon: driverIcon }).addTo(map);
        if (dest) {
            L.marker([dest.lat, dest.lng], { icon: destIcon }).addTo(map);
            map.fitBounds(L.latLngBounds([driver.lat, driver.lng], [dest.lat, dest.lng]), { padding: [40, 40] });
        } else {
            map.setView([driver.lat, driver.lng], 15);
        }
        mapRef.current = map;
        return () => { map.remove(); mapRef.current = null; driverMarkerRef.current = null; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Each poll: move the driver marker only (keep viewport where the user panned it)
    useEffect(() => {
        driverMarkerRef.current?.setLatLng([driver.lat, driver.lng]);
    }, [driver.lat, driver.lng]);

    return <div ref={containerRef} className="h-56 rounded-2xl overflow-hidden z-0" />;
}

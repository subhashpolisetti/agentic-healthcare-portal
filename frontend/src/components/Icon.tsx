import React from "react";

export type IconName =
  | "arrow_right" | "chev_right" | "chev_down" | "chev_up"
  | "check" | "x" | "search" | "eye" | "eye_off" | "plus"
  | "calendar" | "clock" | "pin" | "video" | "sparkle"
  | "heart" | "activity" | "droplet" | "thermo" | "lungs"
  | "bell" | "grid" | "list" | "user" | "stetho" | "flag"
  | "bed" | "file_text" | "upload" | "download" | "refresh"
  | "alert" | "info" | "logout" | "filter" | "send" | "pill"
  | "shield" | "chat" | "waveform" | "sliders" | "sun" | "moon" | "flame";

interface IconProps {
  name: IconName;
  size?: number;
  stroke?: number;
  color?: string;
}

const paths: Record<IconName, React.ReactNode> = {
  arrow_right: <path d="M5 12h14M13 6l6 6-6 6"/>,
  chev_right:  <path d="M9 6l6 6-6 6"/>,
  chev_down:   <path d="M6 9l6 6 6-6"/>,
  chev_up:     <path d="M6 15l6-6 6 6"/>,
  check:       <path d="M5 12.5l4.2 4.2L19 7"/>,
  x:           <path d="M6 6l12 12M18 6L6 18"/>,
  search:      <><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></>,
  eye:         <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
  eye_off:     <><path d="M3 3l18 18"/><path d="M10.6 6.1A11 11 0 0 1 12 6c6.5 0 10 6 10 6a14 14 0 0 1-3.2 3.8M6.1 6.1C3.6 7.8 2 12 2 12s3.5 7 10 7c1.6 0 3.1-.4 4.4-1"/><path d="M9.5 9.6a3 3 0 0 0 4.2 4.3"/></>,
  plus:        <path d="M12 5v14M5 12h14"/>,
  calendar:    <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></>,
  clock:       <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  pin:         <><path d="M12 22s7-7 7-12a7 7 0 1 0-14 0c0 5 7 12 7 12Z"/><circle cx="12" cy="10" r="2.5"/></>,
  video:       <><rect x="3" y="6" width="14" height="12" rx="2"/><path d="M17 10l4-2v8l-4-2z"/></>,
  sparkle:     <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.8 2.8M14.9 14.9l2.8 2.8M17.7 6.3l-2.8 2.8M9.1 14.9l-2.8 2.8"/>,
  heart:       <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.7A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z"/>,
  activity:    <path d="M3 12h4l2.5-7 4 14L16 12h5"/>,
  droplet:     <path d="M12 3s6 7 6 11a6 6 0 1 1-12 0c0-4 6-11 6-11Z"/>,
  thermo:      <><path d="M10 4a2 2 0 1 1 4 0v9a4 4 0 1 1-4 0V4Z"/><path d="M12 4v10"/></>,
  lungs:       <><path d="M12 4v8"/><path d="M12 12c0-2 -1-4 -3-5 -3-1 -5 1 -5 5v3a4 4 0 0 0 6 3.5"/><path d="M12 12c0-2 1-4 3-5 3-1 5 1 5 5v3a4 4 0 0 1-6 3.5"/></>,
  bell:        <><path d="M5 17h14l-1.4-1.4A4 4 0 0 1 16.5 13V10a4.5 4.5 0 0 0-9 0v3a4 4 0 0 1-1.1 2.6L5 17Z"/><path d="M10 20a2 2 0 0 0 4 0"/></>,
  grid:        <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  list:        <><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></>,
  user:        <><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></>,
  stetho:      <><path d="M5 4v6a4 4 0 0 0 8 0V4"/><path d="M9 14v3a4 4 0 0 0 8 0v-1"/><circle cx="17" cy="14" r="2"/></>,
  flag:        <><path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/></>,
  bed:         <><path d="M3 18V8m18 10v-4a3 3 0 0 0-3-3H3"/><circle cx="8" cy="10" r="2"/></>,
  file_text:   <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></>,
  upload:      <><path d="M12 16V4"/><path d="M6 10l6-6 6 6"/><path d="M4 20h16"/></>,
  download:    <><path d="M12 4v12"/><path d="M6 12l6 6 6-6"/><path d="M4 20h16"/></>,
  refresh:     <><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></>,
  alert:       <><path d="M12 3l10 18H2L12 3Z"/><path d="M12 10v4M12 18v.01"/></>,
  info:        <><circle cx="12" cy="12" r="9"/><path d="M12 8v.01M11 12h1v5h1"/></>,
  logout:      <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8"/><path d="M16 16l4-4-4-4M20 12H10"/></>,
  filter:      <path d="M3 5h18l-7 9v6l-4-2v-4L3 5Z"/>,
  send:        <><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7Z"/></>,
  pill:        <><rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-30 12 12)"/><path d="M8.5 7.5l8 8"/></>,
  shield:      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z"/>,
  chat:        <><path d="M21 12a8 8 0 1 1-3.5-6.6L21 4l-1 4.5A8 8 0 0 1 21 12Z"/></>,
  waveform:    <><path d="M3 12h2l2-6 3 12 3-9 2 5h6"/></>,
  sliders:     <><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="#fff"/><circle cx="15" cy="12" r="2" fill="#fff"/><circle cx="7" cy="18" r="2" fill="#fff"/></>,
  sun:         <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
  moon:        <path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10Z"/>,
  flame:       <path d="M12 22c4 0 7-3 7-7 0-3-2-5-3-7-1 1-2 2-3 2-1-3-3-5-5-7-1 3 0 5-1 7-2 1-3 4-3 7 0 4 3 5 8 5Z"/>,
};

export function Icon({ name, size = 16, stroke = 1.6, color = "currentColor" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? null}
    </svg>
  );
}

/* ============================================================
   icons.js  —  Cohesive inline-SVG icon set (loaded before ui.js)

   Replaces the OS-dependent emoji used in the sidebar with a single
   crisp, consistent line-icon family that renders identically on
   every platform and inherits the active/hover colour via
   `stroke="currentColor"`.
   ============================================================ */
const ICON_ATTRS = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';

const ICON_PATHS = {
  dashboard:    '<rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"/>',
  market:       '<path d="M4 4v15.5a.5.5 0 0 0 .5.5H20"/><path d="M7.5 14.5 11 11l2.5 2 4.5-5"/><path d="M18.5 8h-3M18.5 8v3"/>',
  portfolio:    '<rect x="3" y="7.5" width="18" height="12.5" rx="2.2"/><path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5"/><path d="M3 12.5h18"/>',
  boosts:       '<path d="M13 2 5.5 13H10l-1.5 9L18.5 10H13.5z"/>',
  startups:     '<path d="M12 3c2.8 1.8 4.5 4.8 4.5 8.5L14 14.5h-4L7.5 11.5C7.5 7.8 9.2 4.8 12 3z"/><circle cx="12" cy="9.5" r="1.5"/><path d="M10 14.5 7.5 17M14 14.5 16.5 17M9.6 18.4c.8.8 1.6 1.1 2.4 1.1s1.6-.3 2.4-1.1"/>',
  ipos:         '<path d="M6 16.5v-5a6 6 0 0 1 12 0v5l1.7 1.7a.4.4 0 0 1-.3.8H4.6a.4.4 0 0 1-.3-.8z"/><path d="M9.7 19.6a2.3 2.3 0 0 0 4.6 0"/>',
  deals:        '<circle cx="12" cy="9" r="5.5"/><path d="M9.2 13.5 8 21l4-2.2 4 2.2-1.2-7.5"/><path d="m12 6.5 1 2 2.2.2-1.6 1.5.5 2.1L12 12.2l-2.1 1.1.5-2.1L8.8 8.7l2.2-.2z" stroke-width="1"/>',
  acquisitions: '<rect x="5" y="3" width="14" height="18" rx="1.4"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/><path d="M10.5 21v-3h3v3"/>',
  hedgefund:    '<path d="M3.5 9 12 4.2 20.5 9"/><path d="M5.5 9.8v7.4M9.2 9.8v7.4M14.8 9.8v7.4M18.5 9.8v7.4"/><path d="M3.5 20.5h17"/>',
  empire:       '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.5 2.3 4 5.4 4 8.5s-1.5 6.2-4 8.5c-2.5-2.3-4-5.4-4-8.5s1.5-6.2 4-8.5z"/>',
  legacy:       '<path d="M19.5 12a7.5 7.5 0 1 1-2.1-5.2"/><path d="M19.8 3.8v3.6h-3.6"/>',
  rankings:     '<path d="M4 8.5 7.4 17h9.2L20 8.5l-4.6 3.6L12 5.2 8.6 12.1z"/><path d="M6.5 20h11"/>',
  achievements: '<path d="M8 4h8v4.5a4 4 0 0 1-8 0z"/><path d="M8 5.5H5.6a2 2 0 0 0 0 4H7.2M16 5.5h2.4a2 2 0 0 1 0 4H16.8"/><path d="M12 12.5V16M9.2 20h5.6M10.3 20l.5-4M13.7 20l-.5-4"/>',
};

function svgIcon(key){
  return ICON_PATHS[key] ? `<svg ${ICON_ATTRS}>${ICON_PATHS[key]}</svg>` : '';
}

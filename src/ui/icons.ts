const paths: Record<string,string> = {
  energy:'<path d="m13 2-8 11h6l-1 9 9-13h-6l1-7Z"/>',
  teleport:'<path d="M7 4H4v3m13-3h3v3M4 17v3h3m13-3v3h-3"/><path d="m12 6 6 6-6 6-6-6 6-6Z"/>',
  shockwave:'<circle cx="12" cy="12" r="3"/><path d="M6 6a8.5 8.5 0 0 0 0 12m12-12a8.5 8.5 0 0 1 0 12M3 3a13 13 0 0 0 0 18M21 3a13 13 0 0 1 0 18"/>',
  reconstruct:'<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 9 8-4.5M12 12 4 7.5M12 12v9"/><path d="m8 5 8 4.5"/>',
  giant:'<path d="M7 10V4h6m4 10v6h-6M7 4l5 5m5 11-5-5"/><circle cx="16" cy="6" r="2"/><path d="M6 18h.01"/>',
  clone:'<path d="m9 7 7 4v8l-7 4-7-4v-8l7-4Z"/><path d="m9 3 4-2 9 5v10l-3 2"/>',
  temporal:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2M4 4l-2-2m18 2 2-2"/>',
  map:'<path d="m3 5 6-3 6 3 6-3v17l-6 3-6-3-6 3V5Zm6-3v17m6-14v17"/>',
  settings:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="16" cy="17" r="3"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l1.5 1.5m13 13L20 20M4 20l1.5-1.5m13-13L20 4"/>',
  flight:'<path d="m12 2 8 19-8-5-8 5 8-19Z"/><path d="M12 16V8"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  sound:'<path d="m11 4-6 5H2v6h3l6 5V4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 2.8V15m-1 3h.01"/>',
  pin:'<path d="M19 9c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 14 0Z"/><circle cx="12" cy="9" r="2"/>',
};
export const icon=(name:string,size=22)=>`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]??paths.energy}</svg>`;
export const POWERS=[['energy','Emissão','1'],['teleport','Translocar','E'],['shockwave','Onda','Q'],['reconstruct','Reconstruir','R'],['giant','Magnitude','G'],['clone','Ecos','C'],['temporal','Temporal','T'],['laser','Laser','L']] as const;

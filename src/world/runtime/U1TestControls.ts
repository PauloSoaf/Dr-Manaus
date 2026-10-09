/** Explicit QA opt-in for built browser fixtures; ordinary production sessions expose no arrival. */
export function u1TestControlsEnabled():boolean {
  return !!import.meta.env?.DEV || (typeof location!=='undefined' && new URLSearchParams(location.search).get('u1test')==='1');
}

export function u2TestControlsEnabled():boolean {return !!import.meta.env?.DEV || typeof location!=='undefined' && new URLSearchParams(location.search).get('u2test')==='1';}

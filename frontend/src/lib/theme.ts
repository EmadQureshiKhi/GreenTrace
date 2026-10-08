export const THEME_STORAGE_KEY = 'greentrace-theme';

/** Runs before first paint (inlined in the root layout) so the page never flashes the wrong theme. */
export const themeInitScript = `try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

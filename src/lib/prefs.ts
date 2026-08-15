// UI preferences that have to be known *before* the first paint (theme, whether
// the Done column starts collapsed) live in cookies rather than localStorage:
// the server can read a cookie while rendering, so the HTML it sends already
// matches what the browser will show. localStorage can only be read after
// hydration, which means either a flash or a hydration mismatch.

export const THEME_COOKIE = 'theme'
export const ARCHIVE_COOKIE = 'archive-collapsed'

const ONE_YEAR = 60 * 60 * 24 * 365

/** Write a preference cookie from the browser. */
export function setPrefCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${ONE_YEAR}; samesite=lax`
}

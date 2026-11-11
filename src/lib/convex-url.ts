import { browser, dev } from '$app/environment';
import { PUBLIC_CONVEX_URL } from '$env/static/public';

// Keep local browser traffic on the app's origin so VM access and HTTPS work.
// Server-side queries can still reach the backend directly over loopback.
const localBackend = ['localhost', '127.0.0.1', '[::1]'].includes(
	new URL(PUBLIC_CONVEX_URL).hostname
);

export const convexUrl =
	browser && dev && localBackend ? `${window.location.origin}/__convex` : PUBLIC_CONVEX_URL;

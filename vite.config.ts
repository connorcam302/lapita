import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), 'PUBLIC_');
	const backend = env.PUBLIC_CONVEX_URL;
	const localBackend =
		backend && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(backend).hostname);

	return {
		server: {
			host: '0.0.0.0',
			proxy: localBackend
				? {
						'/__convex': {
							target: backend,
							ws: true,
							changeOrigin: true,
							rewrite: (path) => path.replace(/^\/__convex/, '')
						}
					}
				: undefined
		},
		plugins: [tailwindcss(), sveltekit()],
		ssr: {
			noExternal: ['svelte-sonner']
		}
	};
});

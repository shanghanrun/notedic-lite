import adapter from '@sveltejs/adapter-cloudflare'; // 여기를 변경!
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    // adapter-auto 대신 설치한 cloudflare 어댑터를 연결합니다.
    adapter: adapter()
  }
};

export default config;
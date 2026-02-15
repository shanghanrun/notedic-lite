import adapter from '@sveltejs/adapter-cloudflare'; // 여기를 변경!
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  compilerOptions: {
    // 경고 때문에 로그가 너무 지저분하면 아래 줄을 추가해서 무시하세요.
    warningFilter: (warning) => !warning.code.startsWith('a11y-')
  },
  preprocess: vitePreprocess(),
  kit: {
    // adapter-auto 대신 설치한 cloudflare 어댑터를 연결합니다.
    adapter: adapter()
  }
};

export default config;
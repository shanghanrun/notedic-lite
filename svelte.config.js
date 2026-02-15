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
    // 이 부분이 중요합니다!
		adapter: adapter({
			// 빌드 결과물이 저장될 폴더를 명시적으로 지정
			pages: 'build', 
			assets: 'build',
			fallback: 'index.html' // SPA 모드일 경우 필요
		})
  }
};

export default config;
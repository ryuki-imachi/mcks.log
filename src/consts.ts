// Place any global data in this file.
// You can import this data from anywhere in your site by using the `import` keyword.

export const SITE_TITLE = 'mcks.log';
export const SITE_DESCRIPTION = '予定通り、フラフラしています。';

// コレクションのキーと表示名・説明（ナビ・トップのカード・一覧ページで使う）
export const SECTIONS = {
	tech: 'Tech',
	travel: 'Travel',
	memo: 'Memo',
	stream: 'Stream',
} as const;

export const SECTION_DESCRIPTIONS = {
	tech: 'AWSと生成AIを中心にした技術の学び',
	travel: 'JAWS-UG各支部巡り（と国内旅行）の記録',
	memo: '技術メモ / 調査の走り書き',
	stream: '考えごとの垂れ流し',
} as const;

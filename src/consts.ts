// Place any global data in this file.
// You can import this data from anywhere in your site by using the `import` keyword.

export const SITE_TITLE = 'mcks.log';
export const SITE_DESCRIPTION = '技術の学びと旅の記録';

// コレクションのキーと表示名・説明（ナビ・トップのカード・一覧ページで使う）
export const SECTIONS = {
	tech: 'Tech',
	memo: 'Memo',
	travel: 'Travel',
	others: 'Others',
} as const;

export const SECTION_DESCRIPTIONS = {
	tech: 'AWSと生成AIを中心にした技術の学び。Qiitaからの移行記事もここに入ります。',
	memo: '技術メモと調査の走り書き。記事にするほどでもない小ネタの置き場。',
	travel: '国内旅行とJAWS-UG各支部巡りの記録。',
	others: '分類しない雑記。考えごとの垂れ流し。',
} as const;

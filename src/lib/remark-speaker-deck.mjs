// Speaker DeckのプレイヤーURLをiframeへ変換するremarkプラグイン。
//
//   https://speakerdeck.com/player/<id>
//
// のようにURLだけの行を書くと、レスポンシブなプレイヤーとして表示する。
// 通常のSpeaker DeckページURL（/ユーザー名/スラッグ）は既存のリンクカードを
// そのまま使えるようにし、埋め込みたい場所だけプレイヤーURLを明示する。

const SPEAKER_DECK_HOSTS = new Set(['speakerdeck.com', 'www.speakerdeck.com']);
const PLAYER_PATH_RE = /^\/player\/([^/]+)\/?$/;

function playerUrlFrom(value) {
	try {
		const url = new URL(value);
		if (url.protocol !== 'https:' || !SPEAKER_DECK_HOSTS.has(url.hostname)) return null;
		const match = url.pathname.match(PLAYER_PATH_RE);
		if (!match) return null;
		return `https://speakerdeck.com/player/${match[1]}${url.search}`;
	} catch {
		return null;
	}
}

function urlFromParagraph(node) {
	if (node.type !== 'paragraph' || node.children.length !== 1) return null;
	const child = node.children[0];
	if (child.type === 'text' && /^https?:\/\/\S+$/.test(child.value)) return child.value;
	// Markdown側のautolink拡張で、裸URLがlinkノードになっている場合もある
	if (
		child.type === 'link' &&
		child.children.length === 1 &&
		child.children[0].type === 'text' &&
		child.children[0].value === child.url
	) {
		return child.url;
	}
	return null;
}

function text(value) {
	return { type: 'text', value };
}

function makeEmbed(sourceUrl, playerUrl) {
	return {
		type: 'speakerDeckEmbed',
		data: {
			hName: 'div',
			hProperties: { className: ['speakerdeck-embed'] },
		},
		children: [
			{
				type: 'speakerDeckIframe',
				data: {
					hName: 'iframe',
					hProperties: {
						src: playerUrl,
						title: 'Speaker Deckのプレゼンテーション',
						loading: 'lazy',
						frameBorder: 0,
						allowFullScreen: true,
					},
				},
				children: [],
			},
			{
				type: 'speakerDeckSource',
				data: {
					hName: 'p',
					hProperties: { className: ['speakerdeck-source'] },
				},
				children: [
					{
						type: 'link',
						url: sourceUrl,
						children: [text('Speaker Deckで開く')],
					},
				],
			},
		],
	};
}

export default function remarkSpeakerDeck() {
	return (tree) => {
		for (let i = 0; i < tree.children.length; i++) {
			const node = tree.children[i];
			const sourceUrl = urlFromParagraph(node);
			if (!sourceUrl) continue;
			const playerUrl = playerUrlFrom(sourceUrl);
			if (!playerUrl) continue;
			tree.children[i] = makeEmbed(sourceUrl, playerUrl);
		}
	};
}

// stream の対話ログ形式（frontmatter: format: dialogue）用のremarkプラグイン。
//
//   @ryuki: おはよう
//
//   @claude: おはようございます
//
// のように「@speaker: 」で始まる段落を発言の開始とし、次の発言開始までの
// ブロック全体（複数段落・コードブロック・箇条書き等を含む）を1発言として
// div.dialogue-turn に包む。最初の発言より前のノードは通常のMarkdownのまま
// 出力する（導入文用）。@note: は地の文（ナレーション）扱いで、ラベルを
// 付けずCSS側で控えめな見た目にする。見た目は global.css 参照。
//
// 制約: 発言の開始は「トップレベル段落の先頭」のみ判定する。段落の途中の
// 行にある @xxx: は本文扱い。コードブロック内の @xxx: 行は段落ではないため
// 誤検知しない。

const SPEAKER_RE = /^@([a-zA-Z0-9_-]+):[ \t]*/;

// ノードが発言開始の段落ならspeaker名を返す
function speakerOf(node) {
	if (node.type !== 'paragraph') return null;
	const first = node.children[0];
	if (!first || first.type !== 'text') return null;
	const m = first.value.match(SPEAKER_RE);
	return m ? m[1] : null;
}

// 発言開始の段落から @speaker: マーカーを取り除く
function stripMarker(paragraph) {
	const first = paragraph.children[0];
	first.value = first.value.replace(SPEAKER_RE, '');
	if (first.value === '') paragraph.children.shift();
}

function makeTurn(speaker, children) {
	const label = {
		type: 'dialogueSpeaker',
		data: {
			hName: 'div',
			hProperties: { className: ['dialogue-speaker'] },
		},
		children: [{ type: 'text', value: `@${speaker}` }],
	};
	const body = {
		type: 'dialogueBody',
		data: {
			hName: 'div',
			hProperties: { className: ['dialogue-body'] },
		},
		children,
	};
	return {
		type: 'dialogueTurn',
		data: {
			hName: 'div',
			hProperties: { className: ['dialogue-turn'], 'data-speaker': speaker },
		},
		children: speaker === 'note' ? [body] : [label, body],
	};
}

export default function remarkDialogue() {
	return (tree, file) => {
		// frontmatterで format: dialogue を宣言した記事だけ変換する
		const frontmatter = file?.data?.astro?.frontmatter;
		if (!frontmatter || frontmatter.format !== 'dialogue') return;

		const nodes = tree.children;
		const result = [];
		let i = 0;
		// 最初の発言より前（導入文）はそのまま通す
		while (i < nodes.length && speakerOf(nodes[i]) === null) {
			result.push(nodes[i]);
			i++;
		}
		while (i < nodes.length) {
			const speaker = speakerOf(nodes[i]);
			stripMarker(nodes[i]);
			const content = nodes[i].children.length > 0 ? [nodes[i]] : [];
			let j = i + 1;
			while (j < nodes.length && speakerOf(nodes[j]) === null) {
				content.push(nodes[j]);
				j++;
			}
			result.push(makeTurn(speaker, content));
			i = j;
		}
		tree.children = result;
	};
}

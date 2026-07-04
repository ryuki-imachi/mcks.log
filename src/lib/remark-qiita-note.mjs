// Qiita互換の :::note 記法をビルド時に色付きボックスへ変換するremarkプラグイン。
//
//   :::note          → info（既定）
//   :::note warn     → 警告
//   :::note alert    → 重要
//   本文
//   :::
//
// remark-directiveは「:::note warn」のようなスペース区切りをディレクティブとして
// 解釈できないため、mdastの段落ノードを直接走査してQiitaと同じ書き味を実現する。
// 制約: トップレベルの記法のみ対応（ネストは非対応）。閉じ忘れは変換せずそのまま出力する。

const OPEN_RE = /^:::note(?:[ \t]+(info|warn|alert))?[ \t]*(?:\n|$)/;
const CLOSE_SAME_RE = /\n?:::[ \t]*$/;

function isText(node) {
	return node && node.type === 'text';
}

// 段落の先頭テキストが :::note で始まるか。始まるなら variant を返しつつマーカーを除去する
function stripOpenMarker(paragraph) {
	const first = paragraph.children[0];
	if (!isText(first)) return null;
	const m = first.value.match(OPEN_RE);
	if (!m) return null;
	const variant = m[1] || 'info';
	first.value = first.value.slice(m[0].length);
	if (first.value === '') paragraph.children.shift();
	return variant;
}

// 段落の末尾テキストが ::: で終わるか。終わるなら除去してtrueを返す
function stripCloseMarker(paragraph) {
	const last = paragraph.children[paragraph.children.length - 1];
	if (!isText(last)) return false;
	if (!CLOSE_SAME_RE.test(last.value)) return false;
	last.value = last.value.replace(CLOSE_SAME_RE, '');
	if (last.value === '') paragraph.children.pop();
	return true;
}

// 段落が「:::」のみの閉じ行か
function isCloseParagraph(node) {
	return (
		node.type === 'paragraph' &&
		node.children.length === 1 &&
		isText(node.children[0]) &&
		/^:::[ \t]*$/.test(node.children[0].value)
	);
}

function makeNote(variant, children) {
	return {
		type: 'qiitaNote',
		data: {
			hName: 'div',
			hProperties: { className: ['qiita-note', `qiita-note-${variant}`] },
		},
		children,
	};
}

export default function remarkQiitaNote() {
	return (tree) => {
		const result = [];
		const nodes = tree.children;
		let i = 0;
		while (i < nodes.length) {
			const node = nodes[i];
			if (node.type !== 'paragraph') {
				result.push(node);
				i++;
				continue;
			}
			const variant = stripOpenMarker(node);
			if (variant === null) {
				result.push(node);
				i++;
				continue;
			}
			// 同一段落内で閉じているケース（:::note〜:::の間に空行なし）
			if (stripCloseMarker(node)) {
				result.push(makeNote(variant, node.children.length > 0 ? [node] : []));
				i++;
				continue;
			}
			// 後続ノードから閉じ行を探すケース（間に空行あり）
			const content = node.children.length > 0 ? [node] : [];
			let j = i + 1;
			let closed = false;
			while (j < nodes.length) {
				const candidate = nodes[j];
				if (isCloseParagraph(candidate)) {
					closed = true;
					j++;
					break;
				}
				if (candidate.type === 'paragraph' && stripCloseMarker(candidate)) {
					if (candidate.children.length > 0) content.push(candidate);
					closed = true;
					j++;
					break;
				}
				content.push(candidate);
				j++;
			}
			if (closed) {
				result.push(makeNote(variant, content));
				i = j;
			} else {
				// 閉じ忘れ: 変換せず元のまま出力（マーカーは復元）
				node.children.unshift({ type: 'text', value: `:::note ${variant}\n` });
				result.push(node);
				i++;
			}
		}
		tree.children = result;
	};
}

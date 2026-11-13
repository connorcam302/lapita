import assert from 'node:assert/strict';
import { test } from 'node:test';
import { copyRecapImage, imageCopyErrorMessage } from './recap-image';

class TestClipboardItem {
	constructor(readonly items: Record<string, Blob | Promise<Blob>>) {}
}
const Item = TestClipboardItem as unknown as typeof ClipboardItem;

test('copy writes the original PNG blob as an image clipboard item', async () => {
	const blob = new Blob(['png fixture'], { type: 'image/png' });
	let written: ClipboardItem[] = [];
	await copyRecapImage(
		blob,
		{
			async write(items) {
				written = items;
			}
		},
		Item
	);
	assert.equal(written.length, 1);
	const item = written[0] as unknown as TestClipboardItem;
	assert.deepEqual(Object.keys(item.items), ['image/png']);
	assert.equal(await item.items['image/png'], blob);
});

test('copy reports unsupported browsers without pretending to succeed', async () => {
	await assert.rejects(copyRecapImage(new Blob(), undefined, Item), /unavailable/);
});

test('copy propagates permission failures so the UI can report them', async () => {
	await assert.rejects(
		copyRecapImage(
			new Blob(),
			{
				async write() {
					throw new Error('Permission denied');
				}
			},
			Item
		),
		/Permission denied/
	);
});

test('copy remains pending until the clipboard confirms the image was written', async () => {
	let finish: () => void = () => {};
	let copied = false;
	const task = copyRecapImage(
		new Blob(),
		{
			write() {
				return new Promise<void>((resolve) => {
					finish = resolve;
				});
			}
		},
		Item
	).then(() => {
		copied = true;
	});
	await Promise.resolve();
	assert.equal(copied, false);
	finish();
	await task;
	assert.equal(copied, true);
});

test('copy errors distinguish insecure pages, embedded policy, support, permission and busy clipboard', () => {
	const context = { secure: true, supported: true, policyAllowed: true };
	assert.match(
		imageCopyErrorMessage(new Error(), { ...context, secure: false }),
		/HTTPS or localhost/
	);
	assert.match(
		imageCopyErrorMessage(new Error(), { ...context, policyAllowed: false }),
		/embedded view/
	);
	assert.match(
		imageCopyErrorMessage(new Error(), { ...context, supported: false }),
		/cannot copy images directly/
	);
	assert.match(
		imageCopyErrorMessage(new DOMException('Denied', 'NotAllowedError'), context),
		/blocked clipboard access/
	);
	assert.match(
		imageCopyErrorMessage(new DOMException('Busy', 'AbortError'), context),
		/clipboard is busy/
	);
});

test('copy requests clipboard access synchronously during the click, before promises settle', async () => {
	let requested = false;
	const task = copyRecapImage(
		new Blob(),
		{
			async write() {
				requested = true;
			}
		},
		Item
	);
	assert.equal(requested, true);
	await task;
});

test('recap PNG renders most-used pairs, ties and missing choices within the image', async () => {
	const { createCanvas } = await import('@napi-rs/canvas');
	const { buildRecap } = await import('./gp-recap');
	const { buildGpComboFit } = await import('./gp-combo-fit');
	const { renderRecapImage, recapImageSize } = await import('./recap-image');
	const races = ['bike', 'sled'].map((kartId, order) => ({
		_id: `race${order}`,
		order,
		trackStartId: 'track',
		trackEndId: 'track',
		results: [
			{ userId: 'a', position: 1, characterId: 'mario', kartId },
			{ userId: 'b', position: 2 }
		]
	}));
	const recap = buildRecap(['a', 'b'], races);
	const comboRatings = buildGpComboFit(['a', 'b'], races, {
		tracks: [{ _id: 'track', name: 'Peach Stadium' }],
		characters: [{ _id: 'mario', name: 'Mario' }],
		karts: [
			{ _id: 'bike', name: 'Standard Bike' },
			{ _id: 'sled', name: 'Stellar Sled' }
		]
	});
	const canvas = createCanvas(1, 1);
	const ctx = canvas.getContext('2d');
	const drawn: { text: string; y: number }[] = [];
	const original = ctx.fillText.bind(ctx);
	ctx.fillText = (text, x, y) => {
		drawn.push({ text, y });
		original(text, x, y);
	};
	renderRecapImage(canvas as unknown as HTMLCanvasElement, 61, recap, (id) => id, {
		comparisons: [],
		startingPlayers: [],
		comboRatings
	});
	const labels = drawn.map(({ text }) => text).join(' ');
	assert.ok(labels.includes('Mario · Standard Bike / Stellar Sled (tied)'));
	assert.ok(drawn.some(({ text }) => text === '—'));
	assert.ok(drawn.every(({ y }) => y < canvas.height));
	assert.deepEqual({ width: canvas.width, height: canvas.height }, recapImageSize(recap));
});

test('recap PNG keeps race wins in the podium boxes after a Knockout win', async () => {
	const { createCanvas } = await import('@napi-rs/canvas');
	const { buildRecap } = await import('./gp-recap');
	const { renderRecapImage } = await import('./recap-image');
	const recap = buildRecap(
		['a', 'b'],
		[
			{
				_id: 'race',
				order: 0,
				results: [
					{ userId: 'a', position: 4 },
					{ userId: 'b', position: 5 }
				]
			}
		],
		undefined,
		'b'
	);
	const canvas = createCanvas(1, 1);
	const ctx = canvas.getContext('2d');
	const labels: string[] = [];
	const original = ctx.fillText.bind(ctx);
	ctx.fillText = (text, x, y) => {
		labels.push(text);
		original(text, x, y);
	};
	renderRecapImage(canvas as unknown as HTMLCanvasElement, 1, recap, (id) => id);
	assert.ok(!labels.includes('Knockout winner'));
	assert.equal(labels.filter((label) => label === '0 wins').length, 2);
	assert.equal(labels.filter((label) => label === '9').length, 4);
	assert.deepEqual(
		recap.standings.map((row) => [row.userId, row.rank, row.points, row.wins]),
		[
			['b', 1, 9, 0],
			['a', 2, 9, 0]
		]
	);
});

test('recap PNG includes Driver of the Day and its supporting metrics', async () => {
	const { createCanvas } = await import('@napi-rs/canvas');
	const { buildRecap } = await import('./gp-recap');
	const { renderRecapImage, recapImageSize } = await import('./recap-image');
	const recap = buildRecap(
		['a', 'b'],
		[
			{
				_id: 'r',
				order: 0,
				results: [
					{ userId: 'a', position: 1 },
					{ userId: 'b', position: 2 }
				]
			}
		]
	);
	const canvas = createCanvas(1, 1);
	const ctx = canvas.getContext('2d');
	const labels: string[] = [];
	const original = ctx.fillText.bind(ctx);
	ctx.fillText = (text, x, y) => {
		labels.push(text);
		assert.ok(y < canvas.height);
		original(text, x, y);
	};
	renderRecapImage(canvas as unknown as HTMLCanvasElement, 1, recap, (id) => id, {
		awardComparisons: [
			{ userId: 'a', difference: 3, expectedWins: 0.25 },
			{ userId: 'b', difference: -3, expectedWins: 0.75 }
		],
		comparisons: [
			{ userId: 'a', expected: 12, difference: 3 },
			{ userId: 'b', expected: 15, difference: -3 }
		],
		startingPlayers: [],
		comboRatings: []
	});
	assert.ok(labels.includes('Driver of the Day'));
	assert.ok(labels.includes('+3'));
	assert.ok(labels.includes('Points above expected'));
	assert.ok(labels.includes('+0.75'));
	assert.ok(labels.includes('Wins above expected'));
	assert.ok(labels.indexOf('Driver of the Day') > labels.indexOf('Standings'));
	assert.deepEqual({ width: canvas.width, height: canvas.height }, recapImageSize(recap));
});

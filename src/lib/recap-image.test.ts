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

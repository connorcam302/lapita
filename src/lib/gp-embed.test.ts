import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildRecap } from './gp-recap';
import { gpEmbedTags, gpShareMetadata } from './gp-embed';
import { recapImageSize } from './recap-image';

const complete = buildRecap(
	['a', 'b'],
	[
		{
			_id: 'race',
			order: 0,
			results: [
				{ userId: 'a', position: 1 },
				{ userId: 'b', position: 2 }
			]
		}
	]
);
const gp = { _id: 'actual-gp-id', order: 61 };

test('GP and recap have their own URL and title but share the same absolute PNG', () => {
	const base = { gp, recap: complete };
	const details = gpShareMetadata(
		base,
		new URL('https://lapita.example/grandprix/actual-gp-id?track=race'),
		false
	);
	const recap = gpShareMetadata(
		base,
		new URL('https://lapita.example/grandprix/actual-gp-id/recap'),
		true
	);
	assert.equal(details.url, 'https://lapita.example/grandprix/actual-gp-id');
	assert.equal(recap.url, 'https://lapita.example/grandprix/actual-gp-id/recap');
	assert.equal(details.image, 'https://lapita.example/grandprix/actual-gp-id/recap.png');
	assert.equal(recap.image, details.image);
	assert.equal(details.title, 'Grand Prix 61 · Lapita');
	assert.equal(recap.title, 'Grand Prix 61 recap · Lapita');
	assert.deepEqual({ width: recap.width, height: recap.height }, recapImageSize(complete));
});

test('manual completion remains explicit in preview text', () => {
	const partial = buildRecap(
		['a', 'b'],
		[{ _id: 'race', order: 0, results: [{ userId: 'a', position: 1 }] }],
		1
	);
	const embed = gpShareMetadata({ gp, recap: partial }, new URL('https://lapita.example'), true);
	assert.match(embed.description, /Manually completed; 1 missing finish/);
	assert.match(embed.imageAlt, /incomplete race history/);
	assert.ok(embed.image.endsWith('/recap.png'));
});

test('unfinished GPs use the Lapita logo instead of inventing a completed recap', () => {
	const pending = buildRecap(['a'], [{ _id: 'race', order: 0, results: [] }]);
	const embed = gpShareMetadata({ gp, recap: pending }, new URL('https://lapita.example'), false);
	assert.equal(embed.image, 'https://lapita.example/lapita-logo.png');
	assert.equal(embed.height, 680);
	assert.doesNotMatch(embed.description, /Final standings/);
});

test('metadata supports large image cards and escapes every attribute value', () => {
	const embed = gpShareMetadata({ gp, recap: complete }, new URL('https://lapita.example'), true);
	const tags = gpEmbedTags({
		...embed,
		title: '"><script>alert(1)</script>&',
		description: 'Test "quotes" & data'
	});
	assert.ok(tags.includes('name="twitter:card" content="summary_large_image"'));
	assert.ok(tags.includes('property="og:image:type" content="image/png"'));
	assert.ok(tags.includes('&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;&amp;'));
	assert.ok(tags.includes('Test &quot;quotes&quot; &amp; data'));
	assert.ok(!tags.includes('<script>'));
});

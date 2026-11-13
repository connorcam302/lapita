import { Plus } from 'lucide';
import {
	recapDriversOfTheDay,
	signedRecapMetric,
	type RecapAwardComparison,
	type Recap
} from './gp-recap';
import type { GpComboFit } from './gp-combo-fit';

export type RecapImageExtras = {
	awardComparisons?: readonly RecapAwardComparison[];
	comparisons: readonly { userId: string; expected: number | null; difference: number | null }[];
	startingPlayers: readonly { userId: string; winChance: number | null }[];
	comboRatings: GpComboFit;
};
const emptyExtras: RecapImageExtras = { comparisons: [], startingPlayers: [], comboRatings: [] };
const standingsRowHeight = 92;
const colours = {
	background: '#171717',
	surface: '#262626',
	alternate: '#202020',
	foreground: '#fafafa',
	muted: '#bdbdbd',
	border: '#404040',
	yellow: '#f5cc24',
	gold: '#f5cc24',
	silver: '#d4d4d4',
	bronze: '#d9a16d',
	positive: '#86efac',
	negative: '#fca5a5'
};

/** Keep social-image metadata and both renderers on the same dimensions. */
export function recapImageSize(recap: Recap) {
	return {
		width: 1200,
		height:
			360 +
			Math.ceil(recap.podium.length / 3) * 154 +
			76 +
			recap.standings.length * standingsRowHeight +
			48
	};
}

/** Shared deterministic renderer, also used to verify the downloaded composition outside the browser. */
export function renderRecapImage(
	canvas: HTMLCanvasElement,
	order: number,
	recap: Recap,
	name: (id: string) => string,
	extras: RecapImageExtras = emptyExtras,
	logo?: CanvasImageSource
) {
	const podiumRows = Math.ceil(recap.podium.length / 3);
	const standingsTop = 210 + podiumRows * 154;
	const tableTop = standingsTop + 76;
	const awardTop = tableTop + recap.standings.length * standingsRowHeight + 24;
	const size = recapImageSize(recap);
	canvas.width = size.width;
	canvas.height = size.height;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Image export is unavailable in this browser.');
	ctx.textBaseline = 'alphabetic';
	const rect = (x: number, y: number, width: number, height: number, colour: string) => {
		ctx.fillStyle = colour;
		ctx.fillRect(x, y, width, height);
	};
	const text = (
		value: string,
		x: number,
		y: number,
		size = 24,
		colour: string = colours.foreground,
		weight = 400,
		align: CanvasTextAlign = 'left',
		font = 'Inter'
	) => {
		ctx.fillStyle = colour;
		ctx.textAlign = align;
		ctx.font = `${weight} ${size}px ${font}, sans-serif`;
		ctx.fillText(value, x, y);
	};
	const fittedText = (
		value: string,
		x: number,
		y: number,
		width: number,
		size: number,
		colour: string = colours.foreground,
		weight = 600,
		font = 'Inter'
	) => {
		let fitted = value;
		ctx.font = `${weight} ${size}px ${font}, sans-serif`;
		while (ctx.measureText(fitted).width > width && size > 19) {
			size--;
			ctx.font = `${weight} ${size}px ${font}, sans-serif`;
		}
		if (ctx.measureText(fitted).width > width) {
			while (fitted.length && ctx.measureText(`${fitted}…`).width > width)
				fitted = fitted.slice(0, -1);
			fitted += '…';
		}
		text(fitted, x, y, size, colour, weight, 'left', font);
	};
	const badge = (rank: number, x: number, y: number, size: number) => {
		const colour = rank === 1 ? colours.gold : rank === 2 ? colours.silver : colours.bronze;
		ctx.fillStyle = colour;
		ctx.beginPath();
		ctx.roundRect(x, y, size, size, 5);
		ctx.fill();
		text(
			String(rank),
			x + size / 2,
			y + size * 0.73,
			size * 0.57,
			colours.background,
			700,
			'center'
		);
	};
	rect(0, 0, canvas.width, canvas.height, colours.background);
	rect(0, 0, 1200, 190, colours.yellow);
	ctx.fillStyle = colours.surface;
	ctx.beginPath();
	ctx.moveTo(1020, 0);
	ctx.lineTo(1200, 0);
	ctx.lineTo(1200, 190);
	ctx.lineTo(925, 190);
	ctx.closePath();
	ctx.fill();
	text('LAPITA', 56, 56, 26, colours.background, 400, 'left', 'Bungee');
	fittedText(`Grand Prix ${order}`, 56, 121, 855, 52, colours.background, 400, 'Bungee');
	text(
		`${recap.raceCount} ${recap.raceCount === 1 ? 'race' : 'races'} · ${recap.standings.length} ${recap.standings.length === 1 ? 'racer' : 'racers'}`,
		58,
		159,
		22,
		colours.background,
		500
	);
	if (logo) ctx.drawImage(logo, 1000, 10, 170, 170);

	// Render the same Lucide Plus paths used by the score marker in the app.
	const drawPlus = (x: number, y: number, size: number) => {
		ctx.save();
		ctx.translate(x, y);
		ctx.scale(size / 24, size / 24);
		ctx.strokeStyle = colours.foreground;
		ctx.lineWidth = 2.5;
		ctx.lineCap = 'round';
		ctx.beginPath();
		for (const [, attributes] of Plus) {
			const path = String(attributes.d);
			const [startX, startY, length] = path.match(/\d+(?:\.\d+)?/g)!.map(Number);
			ctx.moveTo(startX, startY);
			ctx.lineTo(
				startX + (path.includes('h') ? length : 0),
				startY + (path.includes('v') ? length : 0)
			);
		}
		ctx.stroke();
		ctx.restore();
	};

	for (const [index, racer] of recap.podium.entries()) {
		const x = 56 + (index % 3) * 368;
		const y = 222 + Math.floor(index / 3) * 154;
		ctx.fillStyle = colours.surface;
		ctx.beginPath();
		ctx.roundRect(x, y, 352, 134, 6);
		ctx.fill();
		badge(racer.rank, x + 18, y + 18, 34);
		fittedText(name(racer.userId), x + 66, y + 44, 268, 26);
		text(String(racer.points), x + 18, y + 105, 40, colours.foreground, 700);
		const pointsWidth = ctx.measureText(String(racer.points)).width;
		const knockout = recap.knockoutWinnerId === racer.userId;
		if (knockout) drawPlus(x + 21 + pointsWidth, y + 77, 18);
		text('pts', x + 28 + pointsWidth + (knockout ? 21 : 0), y + 104, 20, colours.muted);
		text(
			`${racer.wins} ${racer.wins === 1 ? 'win' : 'wins'}`,
			x + 334,
			y + 104,
			20,
			colours.muted,
			400,
			'right'
		);
	}

	text('Standings', 56, standingsTop + 36, 26, colours.foreground, 600);
	if (!recap.fullHistory)
		text(
			`Manually completed · ${recap.missing} missing ${recap.missing === 1 ? 'finish' : 'finishes'}`,
			230,
			standingsTop + 35,
			19,
			colours.yellow
		);

	text('Ratings /100', 1144, standingsTop + 36, 19, colours.muted, 500, 'right');
	for (const [label, x] of [
		['Racer', 128],
		['Points', 472],
		['Wins', 548],
		['xPoints', 710],
		['Win chance', 846],
		['Kart', 940],
		['Char.', 1032],
		['Combo', 1126]
	] as const) {
		text(label, x, tableTop - 16, 17, colours.muted, 500, label === 'Racer' ? 'left' : 'right');
	}
	rect(56, tableTop - 1, 1088, 1, colours.border);
	for (const [index, racer] of recap.standings.entries()) {
		const y = tableTop + index * standingsRowHeight;
		rect(56, y, 1088, standingsRowHeight, index % 2 ? colours.alternate : colours.surface);
		if (racer.rank <= 3) badge(racer.rank, 72, y + (standingsRowHeight - 42) / 2, 42);
		else {
			ctx.textBaseline = 'middle';
			text(String(racer.rank), 93, y + standingsRowHeight / 2, 30, colours.muted, 600, 'center');
			ctx.textBaseline = 'alphabetic';
		}
		ctx.textBaseline = 'middle';
		text(
			String(racer.points),
			472,
			y + standingsRowHeight / 2,
			28,
			colours.foreground,
			700,
			'right'
		);
		if (recap.knockoutWinnerId === racer.userId) drawPlus(476, y + standingsRowHeight / 2 - 13, 18);
		text(String(racer.wins), 548, y + standingsRowHeight / 2, 23, colours.foreground, 400, 'right');
		const comparison = extras.comparisons.find((row) => row.userId === racer.userId);
		const difference = comparison?.difference;
		const differenceText = difference == null ? '' : ` (${difference > 0 ? '+' : ''}${difference})`;
		ctx.font = '400 19px Inter, sans-serif';
		const differenceWidth = ctx.measureText(differenceText).width;
		text(
			comparison?.expected == null ? '—' : String(comparison.expected),
			710 - differenceWidth,
			y + standingsRowHeight / 2,
			23,
			colours.foreground,
			400,
			'right'
		);
		text(
			differenceText,
			710,
			y + standingsRowHeight / 2,
			19,
			difference == null || difference === 0
				? colours.muted
				: difference > 0
					? colours.positive
					: colours.negative,
			400,
			'right'
		);
		const chance = extras.startingPlayers.find((row) => row.userId === racer.userId)?.winChance;
		text(
			chance == null ? '—' : `${chance.toFixed(1)}%`,
			846,
			y + standingsRowHeight / 2,
			23,
			colours.foreground,
			400,
			'right'
		);
		const rating = extras.comboRatings.find((row) => row.userId === racer.userId);
		const combos = rating?.mostUsed ?? [];
		const characters = new Map<string, string[]>();
		for (const combo of combos) {
			const karts = characters.get(combo.characterName) ?? [];
			karts.push(combo.kartName);
			characters.set(combo.characterName, karts);
		}
		const comboText = combos.length
			? [...characters]
					.map(([character, karts]) => `${character} · ${karts.join(' / ')}`)
					.join('   ·   ') + (combos.length > 1 ? ' (tied)' : '')
			: '—';
		ctx.textBaseline = 'alphabetic';
		ctx.font = '400 18px Inter, sans-serif';
		const lines: string[] = [];
		let line = '';
		for (const word of comboText.split(' ')) {
			const next = line ? `${line} ${word}` : word;
			if (line && ctx.measureText(next).width > 280) {
				lines.push(line);
				line = word;
			} else line = next;
		}
		if (line) lines.push(line);
		const nameY = lines.length > 1 ? 29 : 38;
		fittedText(name(racer.userId), 128, y + nameY, 280, 25);
		fittedText(lines[0], 128, y + nameY + 25, 280, 18, colours.muted, 400);
		if (lines.length > 1)
			fittedText(lines.slice(1).join(' '), 128, y + nameY + 47, 280, 18, colours.muted, 400);
		ctx.textBaseline = 'middle';
		text(
			rating?.kartScore?.toFixed(1) ?? '—',
			940,
			y + standingsRowHeight / 2,
			23,
			colours.muted,
			400,
			'right'
		);
		text(
			rating?.characterScore?.toFixed(1) ?? '—',
			1032,
			y + standingsRowHeight / 2,
			23,
			colours.muted,
			400,
			'right'
		);
		text(
			rating?.score?.toFixed(1) ?? '—',
			1126,
			y + standingsRowHeight / 2,
			23,
			colours.yellow,
			600,
			'right'
		);
		ctx.textBaseline = 'alphabetic';
	}

	const drivers = recapDriversOfTheDay(recap, extras.awardComparisons ?? []);
	ctx.fillStyle = colours.surface;
	ctx.beginPath();
	ctx.roundRect(56, awardTop, 1088, 148, 6);
	ctx.fill();
	text('Driver of the Day', 80, awardTop + 40, 24, colours.yellow, 600);
	if (drivers?.length) {
		ctx.textBaseline = 'middle';
		fittedText(drivers.map((racer) => name(racer.userId)).join(' · '), 80, awardTop + 96, 438, 46);
		ctx.textBaseline = 'alphabetic';
		if (drivers.length > 1)
			text('Shared award · Metrics in racer order', 80, awardTop + 124, 18, colours.muted);
		rect(550, awardTop + 24, 1, 100, colours.border);
		for (const [metric, digits, label, x] of [
			['difference', 0, 'Points above expected', 582],
			['winDifference', 2, 'Wins above expected', 870]
		] as const) {
			const values = drivers.map((racer) => signedRecapMetric(racer[metric], digits)).join(' / ');
			const colour = drivers.every((racer) => racer[metric] >= 0)
				? colours.positive
				: colours.foreground;
			fittedText(values, x, awardTop + 70, 250, 38, colour, 600);
			text(label, x, awardTop + 106, 19, colours.muted);
		}
	} else {
		fittedText(
			drivers === null
				? 'Award unavailable · Complete finishes and pre-GP expectations required for every racer'
				: 'No racer had a positive award score',
			80,
			awardTop + 87,
			1040,
			20,
			colours.muted,
			400
		);
	}

	return canvas;
}

/** Generate a local PNG for preview, clipboard copy or download. */
export async function createRecapImage(
	order: number,
	recap: Recap,
	name: (id: string) => string,
	extras: RecapImageExtras = emptyExtras
) {
	const logo = new Image();
	logo.src = '/lapita-logo.png';
	await Promise.all([
		logo.decode(),
		Promise.allSettled([
			document.fonts.load('400 52px Bungee'),
			document.fonts.load('400 24px Inter'),
			document.fonts.load('600 24px Inter'),
			document.fonts.load('700 28px Inter')
		])
	]);
	const canvas = renderRecapImage(
		document.createElement('canvas'),
		order,
		recap,
		name,
		extras,
		logo
	);
	return await new Promise<Blob>((resolve, reject) =>
		canvas.toBlob(
			(value) => (value ? resolve(value) : reject(new Error('Could not create the recap image.'))),
			'image/png'
		)
	);
}

/** Write the PNG itself, not its object URL. Invoke directly from a user click. */
export async function copyRecapImage(
	blob: Blob,
	clipboard: Pick<Clipboard, 'write'> | undefined = typeof navigator === 'undefined'
		? undefined
		: navigator.clipboard,
	Item: typeof ClipboardItem | undefined = typeof ClipboardItem === 'undefined'
		? undefined
		: ClipboardItem
) {
	if (!clipboard?.write || !Item) throw new Error('Image copying is unavailable in this browser.');
	await clipboard.write([new Item({ 'image/png': Promise.resolve(blob) })]);
}

/** Explain environment restrictions without treating an unperformed copy as a success. */
export function imageCopyErrorMessage(
	error: unknown,
	context: { secure: boolean; supported: boolean; policyAllowed: boolean }
) {
	if (!context.secure)
		return 'Copying images requires HTTPS or localhost. Use Download, or open Lapita over HTTPS.';
	if (!context.policyAllowed)
		return 'This embedded view blocks clipboard access. Open Lapita directly in your browser to copy.';
	if (!context.supported)
		return 'This browser cannot copy images directly. Right-click or press and hold the image, then choose Copy image.';
	const name = error instanceof Error ? error.name : '';
	if (name === 'NotAllowedError' || name === 'SecurityError')
		return 'The browser blocked clipboard access. Check this site’s clipboard permission, then try again. You can also right-click the image to copy it.';
	if (name === 'AbortError') return 'The clipboard is busy. Try copying again.';
	return 'Could not copy the PNG. Right-click or press and hold the image to copy it, or use Download.';
}

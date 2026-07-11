import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDirectory = path.join(__dirname, '..', 'docs', 'screenshots');
mkdirSync(outputDirectory, { recursive: true });

const placeholderActivities = [
	'osu!', 'Deadlock', 'Walk', 'Journal', 'League of Legends', 'REPO', 'Invincible', 'Balatro',
	'The Boys', 'Paper Mario: Origami King', 'Ori and the Blind Forest', 'Futurama', 'CS:GO',
	'Celeste', 'Factorio', 'Phasmophobia', 'Minecraft', 'Hollow Knight', 'Hollow Knight: Silksong',
	'Read a book', 'Cook dinner', 'Learn guitar', 'Stardew Valley', 'The Legend of Zelda: Tears of the Kingdom',
	'Cyberpunk 2077', 'It\'s Always Sunny in Philadelphia', 'Clean the apartment', 'Terraria', 'Slay the Spire',
];

const tagsByActivity = {
	'osu!': 'Game', 'Deadlock': 'Game', 'League of Legends': 'Game', 'REPO': 'Game', 'Balatro': 'Game',
	'Paper Mario: Origami King': 'Game', 'Ori and the Blind Forest': 'Game', 'CS:GO': 'Game', 'Celeste': 'Game',
	'Factorio': 'Game', 'Phasmophobia': 'Game', 'Minecraft': 'Game', 'Hollow Knight': 'Game',
	'Hollow Knight: Silksong': 'Game', 'Stardew Valley': 'Game', 'The Legend of Zelda: Tears of the Kingdom': 'Game',
	'Cyberpunk 2077': 'Game', 'Terraria': 'Game', 'Slay the Spire': 'Game',
	'Invincible': 'Show', 'The Boys': 'Show', 'Futurama': 'Show', 'It\'s Always Sunny in Philadelphia': 'Show',
	'Walk': 'Life', 'Journal': 'Life', 'Read a book': 'Life', 'Cook dinner': 'Life', 'Learn guitar': 'Life',
	'Clean the apartment': 'Life',
};

async function addActivity(page, name) {
	const input = page.getByPlaceholder('Add an activity (e.g. Play Celeste)');
	await input.fill(name);
	await page.getByRole('button', { name: 'Add', exact: true }).click();
	await page.waitForTimeout(80);
}

async function tagLandedActivity(page, tagName) {
	await page.getByText('Add a tag?').click();
	const tagInput = page.getByPlaceholder('Tag name…');
	await tagInput.fill(tagName);
	await page.getByRole('button', { name: 'Add', exact: true }).click();
	await page.waitForTimeout(150);
}

async function main() {
	const browser = await chromium.launch();
	const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, colorScheme: 'dark' });
	const page = await context.newPage();

	await page.goto('http://localhost:5173/activity-wheel/');
	await page.waitForTimeout(500);

	for (const name of placeholderActivities) {
		await addActivity(page, name);
	}

	console.log('Activities added.');

	// Tag whichever activity we land on, for a handful of spins, so the tag
	// filter bar has a realistic mix by the time we screenshot it.
	for (let spinNumber = 0; spinNumber < 8; spinNumber++) {
		await page.getByRole('button', { name: /^Spin the wheel|^Spin again/ }).click();
		await page.waitForTimeout(1400);
		const landedName = (
			await page
				.getByText('LANDED ON')
				.locator('xpath=following-sibling::*[1]')
				.textContent()
				.catch(() => '')
		).trim();
		const tagName = tagsByActivity[landedName] ?? 'Other';
		await tagLandedActivity(page, tagName).catch(() => {});
		await page.getByRole('button', { name: 'Reset session' }).click().catch(() => {});
		await page.waitForTimeout(200);
	}

	console.log('Tagging pass complete.');

	// Hero shot: wheel + tag filter bar + activity list.
	await page.screenshot({ path: path.join(outputDirectory, 'wheel-and-activities.png') });

	// Spin + post-spin actions.
	await page.getByRole('button', { name: /^Spin the wheel|^Spin again/ }).click();
	await page.waitForTimeout(1500);
	await page.screenshot({ path: path.join(outputDirectory, 'spin-result.png') });
	await page.getByRole('button', { name: 'Reset session' }).click().catch(() => {});
	await page.waitForTimeout(200);

	// Tag filter bar close-up.
	const tagFilterInput = page.getByPlaceholder('Filter tags…');
	await tagFilterInput.scrollIntoViewIfNeeded();
	await page.screenshot({ path: path.join(outputDirectory, 'tag-filter-bar.png'), clip: await boundingBoxFor(tagFilterInput, 40) });

	// Debug panel.
	await page.getByText('Debug', { exact: true }).click();
	await page.waitForTimeout(200);
	await page.getByText('Show weights').click();
	await page.getByText('Show probabilities').click();
	await page.waitForTimeout(200);
	await page.locator('text=Debug').first().scrollIntoViewIfNeeded();
	await page.screenshot({ path: path.join(outputDirectory, 'debug-panel.png') });

	// Backup & restore panel.
	await page.getByText('Backup & restore', { exact: true }).click();
	await page.waitForTimeout(200);
	await page.locator('text=Backup & restore').first().scrollIntoViewIfNeeded();
	await page.screenshot({ path: path.join(outputDirectory, 'backup-restore-panel.png') });

	await browser.close();
	console.log('Done. Screenshots written to', outputDirectory);
}

async function boundingBoxFor(locator, padding) {
	const box = await locator.boundingBox();
	if (!box) return undefined;
	return {
		x: Math.max(0, box.x - padding),
		y: Math.max(0, box.y - padding),
		width: box.width + padding * 2,
		height: box.height + padding * 4,
	};
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { characters, grandPrix, races, results, tracks, users } from '../src/lib/server/db/schema';
import * as schema from '../src/lib/server/db/schema';
import { and, asc, eq, inArray } from 'drizzle-orm';
import Papa from 'papaparse';
import fs from 'fs';
import dotenv from 'dotenv';
import { allTracks } from "../src/lib/data/allTracks";

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
	throw new Error('DATABASE_URL is not set in .env file');
}

const client = postgres(databaseUrl);
const db = drizzle(client, { schema });

async function loadData() {
	await db.delete(results);
	await db.delete(races);
	await db.delete(grandPrix);
	await db.delete(users);
	await db.delete(characters);
	await db.delete(tracks);

	const gpCharactersFile = fs.readFileSync('sample/gp-characters/gp-characters.csv', 'utf8');
	const gpCharactersData = Papa.parse(gpCharactersFile, { header: true, skipEmptyLines: true }).data as {
		Player: string;
		Character: string;
		'GP Number': string;
	}[];

	const racesFile = fs.readFileSync('sample/results/results.csv', 'utf8');
	const racesData = Papa.parse(racesFile, { header: true, skipEmptyLines: true }).data as {
		Track: string;
		Player: string;
		Placement: string;
		'GP Number': string;
	}[];

	const usersFile = fs.readFileSync('sample/users/users.csv', 'utf8');
	const usersData = Papa.parse(usersFile, { header: true, skipEmptyLines: true }).data as { id: string; name: string }[]
	await db.insert(users).values(
		usersData.map((u) => ({
			id: parseInt(u.id),
			name: u.name
		}))
	);

	const charactersFile = fs.readFileSync('sample/characters/characters.csv', 'utf8');
	const charactersData = Papa.parse(charactersFile, { header: true, skipEmptyLines: true }).data as {
		id: string;
		name: string;
	}[];
	await db.insert(characters).values(charactersData);

	const tracksFile = fs.readFileSync('sample/tracks/tracks.csv', 'utf8');
	const tracksData = Papa.parse(tracksFile, { header: true, skipEmptyLines: true }).data as { id: string; name: string }[];
	await db.insert(tracks).values(tracksData);


	const racesByGp = racesData.reduce((acc, row) => {
		const gpNumber = parseInt(row['GP Number']);
		if (!acc[gpNumber]) {
			acc[gpNumber] = [];
		}
		acc[gpNumber].push(row);
		return acc;
	}, {});

	const gps = Object.values(
		gpCharactersData.reduce(
			(acc, row) => {
				const gpNumber = parseInt(row['GP Number']);
				if (!acc[gpNumber]) {
					acc[gpNumber] = {
						id: gpNumber,
						order: gpNumber,
						participants: []
					};
				}

				const playerId = usersData.find((u) => u.name === row.Player).id;
				acc[gpNumber].participants.push(Number(playerId));
				acc[gpNumber].participants.sort();
				return acc;
			},
			{}
		)
	);
	for (const gp of gps) {
		await db.insert(grandPrix).values(gp);
	}


	for (const gpObject of Object.entries(racesByGp)) {
		const [gpId, racesList] = gpObject
		let order = 0;

		// Group races by track to handle multiple players per race
		const racesByTrack = racesList.reduce((acc, race) => {
			const trackKey = race.Track;
			if (!acc[trackKey]) {
				acc[trackKey] = [];
			}
			acc[trackKey].push(race);
			return acc;
		}, {});

		for (const [trackName, playersInRace] of Object.entries(racesByTrack)) {
			const transition = trackName.includes(' -> ');
			let trackStart, trackEnd;
			if (transition) {
				[trackStart, trackEnd] = trackName.split(' -> ');
			} else {
				trackStart = trackName;
				trackEnd = trackName;
			}

			const trackStartId = allTracks.find((t) => t.name === trackStart).id;
			const trackEndId = allTracks.find((t) => t.name === trackEnd).id;

			let raceId;
			const existingRace = await db.select().from(races).where(
				and(
					eq(races.grandPrixId, parseInt(gpId)),
					eq(races.trackStartId, trackStartId),
					eq(races.trackEndId, trackEndId)
				)).limit(1);

			if (existingRace.length > 0) {
				raceId = existingRace[0].id;
			} else {
				const newRace = await db.insert(races).values({
					order,
					grandPrixId: parseInt(gpId),
					trackStartId,
					trackEndId,
					transition
				}).returning();
				raceId = newRace[0].id;
			}

			// Insert results for ALL players in this race
			for (const playerRace of playersInRace) {
				const position = Number(playerRace.Placement) ?? null;

				// Find user ID with error handling
				const user = usersData.find((u) => u.name === playerRace.Player);
				if (!user) {
					throw new Error(`User not found: ${playerRace.Player}`);
				}
				const userId = user.id;

				// Find character with error handling
				const gpCharacter = gpCharactersData.find((gpc) =>
					gpc.Player === playerRace.Player &&
					parseInt(gpc['GP Number']) === parseInt(gpId)
				);

				if (!gpCharacter) {
					throw new Error(`GP character not found for player: ${playerRace.Player}, GP: ${gpId}`);
				}

				const character = charactersData.find((c) => c.name === gpCharacter.Character);
				if (!character) {
					throw new Error(`Character not found: ${gpCharacter.Character}`);
				}
				const characterId = character.id;

				await db.insert(results).values({
					userId: userId,
					characterId: characterId,
					position,
					raceId: raceId
				});
			}

			order++;
		}
	}

	console.log('Data loaded successfully!');
	await client.end();
	process.exit(0);
}

loadData();

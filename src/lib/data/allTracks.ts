export const validTracks = [
	{ id: 'acorn-heights', name: 'Acorn Heights' },
	{ id: 'airship-fortress', name: 'Airship Fortress' },
	{ id: 'boo-cinema', name: 'Boo Cinema' },
	{ id: 'bowsers-castle', name: "Bowser's Castle" },
	{ id: 'cheep-cheep-falls', name: 'Cheep Cheep Falls' },
	{ id: 'choco-mountain', name: 'Choco Mountain' },
	{ id: 'crown-city', name: 'Crown City' },
	{ id: 'dandelion-depths', name: 'Dandelion Depths' },
	{ id: 'desert-hills', name: 'Desert Hills' },
	{ id: 'dino-dino-jungle', name: 'Dino Dino Jungle' },
	{ id: 'dk-pass', name: 'DK Pass' },
	{ id: 'dk-spaceport', name: 'DK Spaceport' },
	{ id: 'dry-bones-burnout', name: 'Dry Bones Burnout' },
	{ id: 'faraway-oasis', name: 'Faraway Oasis' },
	{ id: 'great-block-ruins', name: 'Great ? Block Ruins' },
	{ id: 'koopa-troopa-beach', name: 'Koopa Troopa Beach' },
	{ id: 'mario-bros-circuit', name: 'Mario Bros. Circuit' },
	{ id: 'mario-circuit', name: 'Mario Circuit' },
	{ id: 'moo-moo-meadows', name: 'Moo Moo Meadows' },
	{ id: 'peach-beach', name: 'Peach Beach' },
	{ id: 'peach-stadium', name: 'Peach Stadium' },
	{ id: 'salty-salty-speedway', name: 'Salty Salty Speedway' },
	{ id: 'shy-guy-bazaar', name: 'Shy Guy Bazaar' },
	{ id: 'sky-high-sundae', name: 'Sky-High Sundae' },
	{ id: 'starview-peak', name: 'Starview Peak' },
	{ id: 'toads-factory', name: "Toad's Factory" },
	{ id: 'wario-stadium', name: 'Wario Stadium' },
	{ id: 'warios-galleon', name: "Wario's Galleon" },
	{ id: 'whistlestop-summit', name: 'Whistlestop Summit' }
];

export const allTracks = [...validTracks, { id: 'rainbow-road', name: 'Rainbow Road' }];

export type Track = {
	id: string;
	name: string;
};

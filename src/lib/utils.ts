import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, 'child'> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, 'children'> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };

export const addNumberSuffix = (num: number): string => {
	const lastDigit = num % 10;
	const lastTwoDigits = num % 100;

	// Handle special cases for 11th, 12th, 13th
	if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
		return num + 'th';
	}

	// Handle regular cases
	switch (lastDigit) {
		case 1:
			return num + 'st';
		case 2:
			return num + 'nd';
		case 3:
			return num + 'rd';
		default:
			return num + 'th';
	}
};

export const placementToPoints: Record<number, number> = {
	1: 15,
	2: 12,
	3: 10,
	4: 9,
	5: 9,
	6: 8,
	7: 8,
	8: 7,
	9: 7,
	10: 6,
	11: 6,
	12: 6,
	13: 5,
	14: 5,
	15: 5,
	16: 4,
	17: 4,
	18: 4,
	19: 3,
	20: 3,
	21: 3,
	22: 2,
	23: 2,
	24: 1
};

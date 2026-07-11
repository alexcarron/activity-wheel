/** Which backend a wheel's activities/tags should be read from and written to. */

export type WheelSource =
	| { kind: 'local' }
	| { kind: 'cloud'; userId: string }
	| { kind: 'shared'; sharedWheelId: string };

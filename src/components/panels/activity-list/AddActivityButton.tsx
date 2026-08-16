interface Props {
	formID: string;
	disabled: boolean;
}

export function AddActivityButton({ formID, disabled }: Props) {
	return (
		<button type="submit" form={formID} className="btn btn-primary" disabled={disabled}>
			Add
		</button>
	);
}
